const { t } = require('../i18n.cjs');
// Bounded, private, best-effort diagnostics. No application state is stored here.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_QUEUED = 256;
const REPEAT_WINDOW_MS = 60 * 1000;
const LEVELS = new Set(['info', 'warning', 'error']);
const OPERATIONS = new Set(['app', 'backup', 'restore', 'storage', 'source', 'reader', 'interface', 'network']);

function redact(value) {
  let text = String(value ?? '').slice(0, 8192);
  text = text.replace(/\b(?:https?|wss?):\/\/[^\s<>"'`]+/gi, '[URL]');
  text = text.replace(/\bfile:\/\/[^\s<>\"'`]+/gi, '[PATH]');
  text = text.replace(/\b(authorization|proxy-authorization)\s*[:=]\s*(?:basic|bearer|token|digest)\s+[^\s,;]+/gi, '$1=[REDACTED]');
  text = text.replace(/\b(?:bearer\s+)[\w.\-+/=]+/gi, 'Bearer [REDACTED]');
  text = text.replace(/\b(authorization|cookie|set-cookie|password|passwd|token|access_token|refresh_token|api[_-]?key|secret|session(?:id)?)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[REDACTED]');
  text = text.replace(/\\\\(?:[^\\\s]+\\)+[^\\\s]+/g, '[PATH]');
  text = text.replace(/\b[A-Z]:\\(?:[^\s\\]+\\)*[^\s\\]*/gi, '[PATH]');
  // Paths must be redacted regardless of mount or operating-system layout.
  // URLs were removed above so these are local filesystem paths.
  text = text.replace(/(^|[\s(=:'"])(\/(?!\/)[^\s<>"'`\\]+)/g, '$1[PATH]');
  text = text.replace(/\b[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}\b/g, '[EMAIL]');
  return text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').slice(0, 1500);
}

function normalize(input, now) {
  const level = LEVELS.has(input?.level) ? input.level : 'error';
  const operation = OPERATIONS.has(input?.operation) ? input.operation : 'app';
  const code = typeof input?.code === 'string' && /^[A-Z][A-Z0-9_-]{2,47}$/.test(input.code)
    ? input.code : 'APP-UNEXPECTED';
  return {
    id: randomUUID(),
    at: new Date(now).toISOString(),
    level, operation, code,
    message: redact(input?.message || 'Ocorreu uma falha.'),
  };
}

function createDiagnostics({ directory, now = () => Date.now(), maxFileBytes = MAX_FILE_BYTES,
  retentionMs = RETENTION_MS } = {}) {
  if (typeof directory !== 'string' || !directory)
    throw new TypeError('Pasta de diagnósticos obrigatória');
  const files = ['reader.jsonl', 'reader.1.jsonl', 'reader.2.jsonl']
    .map(name => path.join(directory, name));
  let chain = Promise.resolve();
  let pending = 0;
  let lastCleanup = -Infinity;
  const repeated = new Map();
  const schedule = (task, fallback = null) => {
    if (pending >= MAX_QUEUED) return Promise.resolve(fallback);
    pending++;
    const job = chain.then(task).catch(() => fallback);
    chain = job.then(() => { pending--; });
    return job;
  };
  const ensureDirectory = async () => {
    await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await fs.promises.lstat(directory);
    if (!info.isDirectory()) throw new Error('Pasta de logs inválida');
    await fs.promises.chmod(directory, 0o700).catch(() => {});
  };
  const stat = async filename => {
    try {
      const info = await fs.promises.lstat(filename);
      if (!info.isFile()) throw new Error('Arquivo de log inválido');
      return info;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };
  const cleanExpired = async (force = false) => {
    if (!force && now() - lastCleanup < 60 * 60 * 1000) return;
    const cutoff = now() - retentionMs;
    for (const filename of files) {
      const info = await stat(filename);
      if (!info) continue;
      await fs.promises.chmod(filename, 0o600).catch(() => {});
      // Even a frequently written log may contain events older than 14 days.
      // Compact the bounded files, instead of relying only on file mtime.
      const original = await fs.promises.readFile(filename, 'utf8');
      const lines = original.split('\n').filter(Boolean);
      const kept = [];
      let changed = false;
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const at = Date.parse(item.at);
          if (!Number.isFinite(at) || at < cutoff ||
            !LEVELS.has(item.level) || !OPERATIONS.has(item.operation) ||
            typeof item.code !== 'string' || !/^[A-Z][A-Z0-9_-]{2,47}$/.test(item.code) ||
            typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id) ||
            typeof item.message !== 'string') {
            changed = true;
            continue;
          }
          const safe = {
            id: item.id, at: new Date(at).toISOString(), level: item.level, operation: item.operation,
            code: item.code, message: redact(item.message),
          };
          const encoded = JSON.stringify(safe);
          if (encoded !== line) changed = true;
          kept.push(encoded);
        } catch { changed = true; }
      }
      if (!changed) continue;
      if (!kept.length) {
        await fs.promises.rm(filename, { force: true });
        continue;
      }
      const temporary = filename + '.compact-' + randomUUID();
      try {
        await fs.promises.writeFile(temporary, kept.join('\n') + '\n', {
          flag: 'wx', mode: 0o600,
        });
        await fs.promises.rename(temporary, filename);
      } finally {
        await fs.promises.rm(temporary, { force: true }).catch(() => {});
      }
    }
    lastCleanup = now();
  };
  const append = async entry => {
    await ensureDirectory();
    await cleanExpired();
    const bytes = Buffer.from(JSON.stringify(entry) + '\n');
    const current = await stat(files[0]);
    if (current && current.size + bytes.length > maxFileBytes) {
      for (let index = files.length - 1; index > 0; index--) {
        await fs.promises.rm(files[index], { force: true });
        if (await stat(files[index - 1]))
          await fs.promises.rename(files[index - 1], files[index]);
      }
    }
    await fs.promises.appendFile(files[0], bytes, { mode: 0o600 });
    await fs.promises.chmod(files[0], 0o600).catch(() => {});
  };
  const summary = async (item) => {
    if (!item.suppressed) return;
    await append({ id: randomUUID(), at: new Date(now()).toISOString(),
      level: item.entry.level, operation: item.entry.operation, code: item.entry.code,
      message: `Ocorrências repetidas: ${item.suppressed} (mesma mensagem, últimos 60 s).`,
    });
    item.suppressed = 0;
  };
  const flushRepeats = async () => {
    for (const item of repeated.values()) await summary(item);
  };
  const record = input => {
    const entry = normalize(input, now());
    return schedule(async () => {
      const signature = `${entry.level}\0${entry.operation}\0${entry.code}\0${entry.message}`;
      let item = repeated.get(signature);
      if (item && now() - item.last < REPEAT_WINDOW_MS) {
        item.last = now();
        item.suppressed++;
        return { id: item.entry.id, code: item.entry.code };
      }
      if (item) await summary(item);
      if (repeated.size >= 128) repeated.delete(repeated.keys().next().value);
      item = { entry, last: now(), suppressed: 0 };
      repeated.set(signature, item);
      await append(entry);
      return { id: entry.id, code: entry.code };
    });
  };
  const readTail = async (filename, limit) => {
    const info = await stat(filename);
    if (!info || info.size === 0) return [];
    const length = Math.min(info.size, Math.max(65536, Math.min(1024 * 1024, limit * 4096)));
    const start = info.size - length;
    const fd = await fs.promises.open(filename, 'r');
    let chunk;
    try {
      const bytes = Buffer.alloc(length);
      const { bytesRead } = await fd.read(bytes, 0, length, start);
      chunk = bytes.subarray(0, bytesRead).toString('utf8');
    } finally { await fd.close(); }
    if (start > 0) chunk = chunk.slice(chunk.indexOf('\n') + 1);
    return chunk.split('\n').filter(Boolean).flatMap(line => {
      try {
        const item = JSON.parse(line);
        if (!item || typeof item !== 'object' ||
          !LEVELS.has(item.level) || !OPERATIONS.has(item.operation) ||
          typeof item.code !== 'string' || !/^[A-Z][A-Z0-9_-]{2,47}$/.test(item.code) ||
          typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id) ||
          typeof item.at !== 'string' || !Number.isFinite(Date.parse(item.at)) ||
          typeof item.message !== 'string') return [];
        return [{ id: item.id, at: item.at, level: item.level,
          operation: item.operation, code: item.code, message: redact(item.message) }];
      } catch { return []; }
    }).slice(-limit);
  };
  const read = async limit => {
    await ensureDirectory();
    await cleanExpired(true);
    await flushRepeats();
    const capped = Math.max(1, Math.min(500, Number.isSafeInteger(limit) ? limit : 100));
    const all = [];
    for (let i = files.length - 1; i >= 0; i--)
      all.push(...await readTail(files[i], capped));
    let usedBytes = 0;
    for (const filename of files) usedBytes += (await stat(filename))?.size || 0;
    return { entries: all.slice(-capped).reverse(), usedBytes,
      limitBytes: maxFileBytes * files.length, retentionDays: Math.round(retentionMs / 86400000) };
  };
  const list = (options = {}) => schedule(() => read(options?.limit),
    { entries: [], usedBytes: 0, limitBytes: maxFileBytes * files.length,
      retentionDays: Math.round(retentionMs / 86400000) });
  const clear = () => schedule(async () => {
    for (const filename of files) await fs.promises.rm(filename, { force: true });
    repeated.clear();
    lastCleanup = -Infinity;
    return true;
  }, false);
  const exportReport = (destination, meta = {}) => schedule(async () => {
    const { entries } = await read(500);
    const label = (key, values = {}) => t(key, values, meta.locale || 'pt-BR');
    const unknown = label('Desconhecido');
    const header = [
      label('READER DESKTOP - RELATÓRIO DE DIAGNÓSTICO'),
      label('Este relatório é local. Revise-o antes de compartilhar.'),
      label('Gerado em: {v0}', { v0: new Date(now()).toISOString() }),
      label('Versão: {v0}', { v0: redact(meta.version || unknown) }),
      label('Sistema: {v0}', { v0: (redact(meta.platform || unknown) + ' ' + redact(meta.arch || '')).trim() }),
      label('Eventos incluídos: {v0}', { v0: entries.length }),
      '',
    ];
    const body = entries.map(item =>
      `[${item.at}] ${item.level.toUpperCase()} ${item.code} (${item.operation})\n` +
      `ID: ${item.id}\n${redact(item.message)}\n`).join('\n');
    const temporary = `${destination}.tmp-${randomUUID()}`;
    try {
      await fs.promises.writeFile(temporary, header.join('\n') + body, { flag: 'wx', mode: 0o600 });
      await fs.promises.rename(temporary, destination);
    } finally { await fs.promises.rm(temporary, { force: true }).catch(() => {}); }
    return { saved: true, count: entries.length };
  }, { saved: false, count: 0 });
  return { record, list, clear, exportReport };
}

module.exports = { createDiagnostics, redact };
