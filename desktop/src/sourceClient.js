import { INSTALLED_PLUGINS_KEY } from '../vendor/lnreader/src/plugins/constants';
const entries = new Map();
let callId = 0;
const reportSourceFailure = (code, message) => {
  void window.desktop.diagnostics.report({
    level: 'warning', operation: 'source', code, message,
  }).catch(() => {});
};
const activity = () =>
  window.dispatchEvent(
    new CustomEvent('source-activity', {
      detail: [...entries.values()].some(entry => entry.pending.size > 0),
    }),
  );
const ownStorage = (id, key) =>
  key.startsWith(`plugin_db:${id}_DB_`) ||
  key === `plugin_db:${id}_LocalStorage` ||
  key === `plugin_db:${id}_SessionStorage`;
function dispose(entry, error = new Error('Operação da fonte cancelada.')) {
  if (entry.disposed) return;
  entry.disposed = true;
  entry.worker.terminate();
  entries.delete(entry.id);
  for (const requestId of entry.requests)
    void window.desktop.cancelRequest(requestId).catch(() => {});
  for (const job of entry.pending.values()) {
    clearTimeout(job.timer);
    job.reject(error);
  }
  entry.pending.clear();
  activity();
}
async function handleRPC(entry, message) {
  const [first, second, third] = message.args || [];
  switch (message.op) {
    case 'file':
      if (
        typeof second !== 'string' ||
        !second.startsWith(`Plugins/${entry.id}/`) ||
        !['exists', 'read', 'write', 'remove'].includes(first)
      )
        throw new Error('Acesso a arquivo fora da fonte.');
      return window.desktop.file(first, second, third);
    case 'request':
      if (typeof second?.requestId !== 'string')
        throw new Error('Requisição inválida da fonte.');
      entry.requests.add(second.requestId);
      try {
        return await window.desktop.request(first, { ...second, sourceId: entry.id });
      } finally {
        entry.requests.delete(second.requestId);
      }
    case 'cancel-request':
      if (entry.requests.has(first)) return window.desktop.cancelRequest(first);
      return;
    case 'storage':
      if (
        typeof first !== 'string' ||
        !ownStorage(entry.id, first) ||
        (!third &&
          (typeof second !== 'string' || second.length > 2 * 1024 * 1024))
      )
        throw new Error('Cache inválido da fonte.');
      if (third) localStorage.removeItem(first);
      else localStorage.setItem(first, second);
      window.dispatchEvent(new Event('plugin-storage-change'));
      return;
    case 'notice':
      window.dispatchEvent(
        new CustomEvent('notice', { detail: `${entry.id}: ${String(first)}` }),
      );
      return;
    default:
      throw new Error('Operação inválida da fonte.');
  }
}
function call(entry, method, args = [], timeout = 45000) {
  if (entry.disposed)
    return Promise.reject(
      new Error('A fonte foi reiniciada. Tente novamente.'),
    );
  entry.lastUse = Date.now();
  if (entry.pending.size >= 32)
    return Promise.reject(
      new Error('A fila desta fonte está cheia. Aguarde as operações atuais.'),
    );
  return new Promise((resolve, reject) => {
    const id = ++callId;
    const timer = setTimeout(() => {
      reportSourceFailure('SRC-TIMEOUT', 'A fonte excedeu o tempo de resposta.');
      dispose(entry, new Error(
        'A fonte demorou demais e foi interrompida. Tente novamente ou atualize a extensão.',
      ));
    }, timeout);
    entry.pending.set(id, { resolve, reject, timer });
    activity();
    try {
      entry.worker.postMessage({ kind: 'call', id, method, args });
    } catch (error) {
      clearTimeout(timer);
      entry.pending.delete(id);
      activity();
      reject(error);
    }
  });
}
async function acquire(id) {
  if (entries.has(id)) return entries.get(id);
  if (entries.size >= 6) {
    const idle = [...entries.values()]
      .filter(entry => entry.pending.size === 0)
      .sort((a, b) => a.lastUse - b.lastUse)[0];
    if (!idle)
      throw new Error(
        'As fontes estão ocupadas. Aguarde uma operação terminar.',
      );
    dispose(idle);
  }
  const entry = {
    id,
    worker: new Worker('plugin-worker.js', { name: `Fonte: ${id}` }),
    pending: new Map(),
    requests: new Set(),
    lastUse: Date.now(),
    disposed: false,
    rpcActive: 0,
    rpcSeen: 0,
    rpcSince: Date.now(),
  };
  entries.set(id, entry);
  entry.worker.onmessage = async event => {
    const message = event.data;
    if (entry.disposed) return;
    if (message.kind === 'rpc') {
      if (Date.now() - entry.rpcSince > 1000) {
        entry.rpcSince = Date.now();
        entry.rpcSeen = 0;
      }
      if (++entry.rpcSeen > 500 || entry.rpcActive >= 64) {
        dispose(
          entry,
          new Error(
            'A fonte excedeu o limite de operações e foi interrompida.',
          ),
        );
        return;
      }
      entry.rpcActive++;
      try {
        const value = await handleRPC(entry, message);
        if (!entry.disposed)
          entry.worker.postMessage({
            kind: 'rpc-result',
            id: message.id,
            value,
          });
      } catch (error) {
        if (!entry.disposed)
          entry.worker.postMessage({
            kind: 'rpc-result',
            id: message.id,
            error: error.message,
          });
      } finally {
        entry.rpcActive--;
      }
    } else if (message.kind === 'result') {
      const job = entry.pending.get(message.id);
      if (!job) return;
      clearTimeout(job.timer);
      entry.pending.delete(message.id);
      activity();
      if (message.error) job.reject(new Error(message.error));
      else job.resolve(message.value);
    }
  };
  entry.worker.onerror = event => {
    event.preventDefault();
    reportSourceFailure('SRC-WORKER-CRASH', 'O processo de uma fonte falhou.');
    dispose(entry, new Error(event.message || 'A fonte foi interrompida.'));
  };
  entry.worker.onmessageerror = () => {
    reportSourceFailure('SRC-WORKER-MESSAGE', 'Uma fonte enviou dados inválidos.');
    dispose(entry, new Error('A fonte retornou dados que não podem ser transferidos.'));
  };
  const storage = Object.fromEntries(
    Object.entries(localStorage).filter(([key]) => ownStorage(id, key)),
  );
  entry.ready = call(entry, 'boot', [{ pluginId: id, storage }], 12000);
  return entry;
}
function proxy(entry, description) {
  if (!description) return undefined;
  const value = { ...description.properties };
  for (const method of description.methods)
    value[method] = (...args) => call(entry, method, args);
  entry.proxy = value;
  return value;
}
export async function loadPlugin(id) {
  if (id === 'local') return undefined;
  let entry = entries.get(id);
  if (entry?.installing) return entry.installing;
  if (entry?.proxy) return entry.proxy;
  if (!(await window.desktop.file('exists', `Plugins/${id}/index.js`)))
    return undefined;
  entry = await acquire(id);
  await entry.ready;
  entry.description ||= call(entry, 'describe', [], 12000)
    .then(value => {
      if (!value)
        throw new Error(
          'Não foi possível carregar a fonte. Tente novamente ou reinstale a extensão.',
        );
      return proxy(entry, value);
    })
    .catch(error => {
      dispose(entry, error);
      throw error;
    });
  return entry.description;
}
export async function installSource(metadata) {
  const previous = entries.get(metadata.id);
  if (previous) dispose(previous);
  const entry = await acquire(metadata.id);
  entry.installing = (async () => {
    await entry.ready;
    const result = proxy(entry, await call(entry, 'install', [metadata]));
    entry.description = Promise.resolve(result);
    return result;
  })();
  try {
    return await entry.installing;
  } catch (error) {
    dispose(entry, error);
    throw error;
  } finally {
    entry.installing = null;
  }
}
export async function uninstallSource(metadata) {
  const previous = entries.get(metadata.id);
  if (previous) dispose(previous);
  const entry = await acquire(metadata.id);
  await entry.ready;
  try {
    await call(entry, 'uninstall', [metadata]);
  } finally {
    dispose(entry);
  }
}
export const cancelSourceOperations = () => {
  for (const entry of [...entries.values()]) dispose(entry);
};
export async function reloadInstalledPlugins() {
  cancelSourceOperations();
  const plugins = JSON.parse(
    localStorage.getItem(INSTALLED_PLUGINS_KEY) || '[]',
  );
  const found = await Promise.all(
    plugins.map(async plugin => ({
      plugin,
      exists: await window.desktop.file(
        'exists',
        `Plugins/${plugin.id}/index.js`,
      ),
    })),
  );
  localStorage.setItem(
    INSTALLED_PLUGINS_KEY,
    JSON.stringify(found.filter(item => item.exists).map(item => item.plugin)),
  );
  return found.filter(item => !item.exists).map(item => item.plugin.id);
}
export const fetchNovel = async (id, path) =>
  (await loadPlugin(id))?.parseNovel(path);
export const fetchPage = async (id, path, page) =>
  (await loadPlugin(id))?.parsePage(path, page);
export const fetchChapter = async (id, path) => {
  const plugin = await loadPlugin(id);
  if (!plugin) throw new Error('Fonte não instalada.');
  return plugin.parseChapter(path);
};
