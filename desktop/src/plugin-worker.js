import {
  loadPlugin,
  installPlugin,
  uninstallPlugin,
} from '../../src/plugins/pluginManager';
const pending = new Map();
let rpcId = 0;
let pluginId;
globalThis.window = globalThis;
globalThis.sourceRPC = (op, args) =>
  new Promise((resolve, reject) => {
    const id = ++rpcId;
    pending.set(id, { resolve, reject });
    postMessage({ kind: 'rpc', id, op, args });
  });
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  request.signal.throwIfAborted();
  const requestId = crypto.randomUUID();
  const body = ['HEAD', 'GET'].includes(request.method)
    ? undefined
    : new Uint8Array(await request.arrayBuffer());
  request.signal.throwIfAborted();
  const cancel = () => {
    void sourceRPC('cancel-request', [requestId]).catch(() => {});
  };
  const resultPromise = sourceRPC('request', [
    request.url,
    {
      requestId,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body,
    },
  ]);
  request.signal.addEventListener('abort', cancel, { once: true });
  let result;
  try {
    result = await resultPromise;
    request.signal.throwIfAborted();
  } catch (error) {
    request.signal.throwIfAborted();
    throw error;
  } finally {
    request.signal.removeEventListener('abort', cancel);
  }
  const bytes = Uint8Array.from(atob(result.body), char => char.charCodeAt(0));
  const response = new Response(
    request.method === 'HEAD' || [204, 205, 304].includes(result.status)
      ? null
      : bytes,
    result,
  );
  Object.defineProperty(response, 'url', { value: result.url });
  Object.defineProperty(response, 'redirected', {
    value: result.url !== request.url,
  });
  return response;
};
const describe = plugin => {
  if (!plugin) return null;
  const methods = [
    'popularNovels',
    'searchNovels',
    'parseNovel',
    'parsePage',
    'parseChapter',
    'resolveUrl',
  ].filter(name => typeof plugin[name] === 'function');
  const properties = JSON.parse(
    JSON.stringify(plugin, (_key, value) =>
      typeof value === 'function'
        ? undefined
        : value instanceof Headers
        ? Object.fromEntries(value)
        : value,
    ),
  );
  return { properties, methods };
};
let sourceQueue = Promise.resolve();
onmessage = event => {
  const message = event.data;
  if (message.kind === 'rpc-result') {
    const job = pending.get(message.id);
    if (!job) return;
    pending.delete(message.id);
    if (message.error) job.reject(new Error(message.error));
    else job.resolve(message.value);
    return;
  }
  if (message.kind !== 'call') return;
  // A fonte compartilha uma instância mutável; RPC de rede/arquivos continua
  // sendo recebido enquanto os métodos da extensão são executados em sequência.
  sourceQueue = sourceQueue.then(() => execute(message));
};
async function execute(message) {
  try {
    let value;
    if (message.method === 'boot') {
      pluginId = message.args[0].pluginId;
      const memory = new Map(Object.entries(message.args[0].storage));
      const change = (key, value, remove) => {
        key = String(key);
        if (remove) memory.delete(key);
        else memory.set(key, String(value));
        if (key.startsWith('plugin_db:'))
          void sourceRPC('storage', [key, value, remove]).catch(error =>
            sourceRPC('notice', [error.message]),
          );
      };
      globalThis.localStorage = {
        getItem: key => memory.get(String(key)) ?? null,
        setItem: (key, value) => change(key, value, false),
        removeItem: key => change(key, null, true),
        keys: () => memory.keys(),
      };
      value = true;
    } else if (message.method === 'install')
      value = describe(await installPlugin(message.args[0]));
    else if (message.method === 'uninstall') {
      await uninstallPlugin(message.args[0]);
      value = true;
    } else {
      const plugin = await loadPlugin(pluginId);
      if (message.method === 'describe') value = describe(plugin);
      else {
        if (!plugin || typeof plugin[message.method] !== 'function')
          throw new Error(`A fonte não oferece ${message.method}.`);
        value = await plugin[message.method](...message.args);
      }
    }
    postMessage({ kind: 'result', id: message.id, value });
  } catch (error) {
    postMessage({
      kind: 'result',
      id: message.id,
      error: error?.message || String(error),
    });
  }
}
