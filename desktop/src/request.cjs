// Electron net.fetch does not consistently populate Response.url. Source
// plugins use the final URL to detect login/captcha redirects, so track it
// through ClientRequest rather than pretending it is the original URL.
const { validateNetworkUrl } = require('./networkPolicy.cjs');

// Only used by the isolated CI source-matrix runs. Never log URLs (which can
// contain tokens), cookies or response bodies.
const diagnose = (url, sourceId, status, bytes, challenge = false) => {
  if (process.env.LNREADER_SOURCE_DIAGNOSTICS !== '1') return;
  let host = 'invalid-host';
  try { host = new URL(url).hostname; } catch {}
  console.info(
    '[source-http]',
    JSON.stringify({
      source: typeof sourceId === 'string' ? sourceId : 'repository',
      host,
      status,
      bytes,
      challenge,
    }),
  );
};
function requestHTTP(
  net,
  url,
  init = {},
  { signal, timeoutMs = 38000, maxBytes = 20 * 1024 * 1024, allowPrivate = false, requestSession } = {},
) {
  return new Promise((resolve, reject) => {
    let finalUrl;
    try {
      finalUrl = validateNetworkUrl(url, { allowPrivate });
    } catch (error) {
      reject(error);
      return;
    }
    let request;
    let settled = false;
    let timer;
    let chunks = [];
    const abort = () => finish(new Error('Conexão com a fonte cancelada.'));
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      chunks.length = 0;
      if (error) {
        diagnose(finalUrl || url, init.sourceId, 'ERROR:' + (error.code || error.name || 'unknown'), 0);
        reject(error);
        try {
          request?.abort();
        } catch {
          /* The socket may already be closed. */
        }
      } else resolve(result);
    };
    try {
      if (signal?.aborted) {
        finish(new Error('Conexão com a fonte cancelada.'));
        return;
      }
      request = net.request({
        url: finalUrl,
        method: init.method || 'GET',
        useSessionCookies: true,
        ...(requestSession ? { session: requestSession } : {}),
        redirect: 'manual',
      });
      timer = setTimeout(
        () =>
          finish(
            new Error('A fonte demorou mais de 38 segundos para responder.'),
          ),
        timeoutMs,
      );
      signal?.addEventListener('abort', abort, { once: true });
      let redirects = 0;
      request.on('redirect', (_status, _method, target) => {
        if (settled) return;
        try {
          const redirected = new URL(target, finalUrl);
          if (++redirects > 20) {
            finish(new Error('Redirecionamento inválido da fonte.'));
            return;
          }
          finalUrl = validateNetworkUrl(redirected.href, { allowPrivate });
          request.followRedirect();
        } catch (error) {
          finish(error);
        }
      });
      request.on('error', error => finish(error));
      request.on('abort', () =>
        finish(new Error('Conexão com a fonte cancelada.')),
      );
      request.on('response', response => {
        response.on('error', error => finish(error));
        if (settled) return;
        let size = 0;
        response.on('data', chunk => {
          if (settled) return;
          size += chunk.length;
          if (size > maxBytes) finish(new Error('Resposta excede 20 MB'));
          else chunks.push(Buffer.from(chunk));
        });
        response.on('aborted', () =>
          finish(new Error('A fonte interrompeu a resposta.')),
        );
        response.on('end', () => {
          if (settled) return;
          const prefix = Buffer.concat(chunks.slice(0, 2)).subarray(0, 4096).toString('utf8');
          const challenge = /<title[^>]*>[^<]*(just a moment|bot verification|checking your browser|attention required)/i.test(prefix) ||
            /cf-chl-|challenge-platform/i.test(prefix);
          diagnose(finalUrl, init.sourceId, response.statusCode, size, challenge);
          finish(null, {
            status: response.statusCode,
            statusText: response.statusMessage || '',
            headers: Object.entries(response.headers).flatMap(
              ([name, values]) =>
                (Array.isArray(values) ? values : [values]).map(value => [
                  name,
                  String(value),
                ]),
            ),
            body: Buffer.concat(chunks).toString('base64'),
            url: finalUrl,
          });
        });
      });
      // Keep the same browser identity used during interactive login, unless
      // the original extension explicitly sets its own User-Agent.
      const headers = init.headers || {};
      if (requestSession && !Object.keys(headers).some(name => name.toLowerCase() === 'user-agent')) {
        const userAgent = requestSession.getUserAgent?.();
        if (userAgent) request.setHeader('User-Agent', userAgent);
      }
      for (const [name, value] of Object.entries(headers)) {
        if (
          !['connection', 'host', 'content-length', 'accept-encoding'].includes(
            name.toLowerCase(),
          )
        )
          request.setHeader(name, value);
      }
      if (init.body !== undefined && init.body !== null)
        request.write(Buffer.from(init.body));
      request.end();
    } catch (error) {
      finish(error);
    }
  });
}

class RequestPool {
  constructor(net, concurrency = 8, queueLimit = 128, options = {}) {
    this.net = net;
    this.options = options;
    this.concurrency = concurrency;
    this.queueLimit = queueLimit;
    this.active = 0;
    this.queue = [];
    this.entries = new Map();
  }
  run(url, init = {}) {
    if (this.entries.size >= this.queueLimit)
      return Promise.reject(
        new Error('Muitas requisições simultâneas. Aguarde a fila das fontes.'),
      );
    if (init.body?.byteLength > 8 * 1024 * 1024)
      return Promise.reject(new Error('Envio à fonte excede 8 MB.'));
    const id = init.requestId || require('node:crypto').randomUUID();
    if (this.entries.has(id))
      return Promise.reject(new Error('Requisição duplicada.'));
    return new Promise((resolve, reject) => {
      const entry = {
        id,
        url,
        init,
        resolve,
        reject,
        controller: new AbortController(),
        started: false,
      };
      entry.timer = setTimeout(() => this.cancel(id), 38000);
      this.entries.set(id, entry);
      this.queue.push(entry);
      this.drain();
    });
  }
  cancel(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    if (entry.started) entry.controller.abort();
    else {
      this.entries.delete(id);
      this.queue = this.queue.filter(item => item !== entry);
      entry.reject(new Error('Conexão com a fonte cancelada.'));
    }
  }
  cancelAll() {
    for (const id of this.entries.keys()) this.cancel(id);
  }
  drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const entry = this.queue.shift();
      entry.started = true;
      this.active++;
      clearTimeout(entry.timer);
      // Session resolution can fail (e.g. invalid plugin metadata). An
      // exception must reject this request and free the queue slot instead
      // of leaving every subsequent source request stuck forever.
      Promise.resolve()
        .then(() =>
          requestHTTP(this.net, entry.url, entry.init, {
            signal: entry.controller.signal,
            ...this.options,
            requestSession: this.options.sessionForSource?.(entry.init.sourceId),
          }),
        )
        .then(entry.resolve, entry.reject)
        .finally(() => {
          this.active--;
          this.entries.delete(entry.id);
          this.drain();
        });
    }
  }
}
module.exports = { requestHTTP, RequestPool };
