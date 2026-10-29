const storage = () => globalThis.localStorage;
export const PLUGIN_STORAGE = 'Plugins';
export const LEGACY_PLUGIN_STORAGE = PLUGIN_STORAGE;
export const getUserAgent = () => navigator.userAgent;
export const getString = key => key;
export const showToast = message =>
  globalThis.sourceRPC('notice', [String(message)]);
export const getEnabledRepositoriesFromDb = async () => [];
export const getMMKVObject = key => {
  const value = storage().getItem(key);
  return value == null ? undefined : JSON.parse(value);
};
export const setMMKVObject = (key, value) =>
  storage().setItem(key, JSON.stringify(value));
export const createMMKV = ({ id }) => ({
  getString: key => storage().getItem(`${id}:${key}`) ?? undefined,
  set: (key, value) => storage().setItem(`${id}:${key}`, String(value)),
  remove: key => storage().removeItem(`${id}:${key}`),
  getAllKeys: () =>
    [...storage().keys()]
      .filter(key => key.startsWith(`${id}:`))
      .map(key => key.slice(id.length + 1)),
});
const file = (action, name, content) =>
  globalThis.sourceRPC('file', [action, name, content]);
export default {
  mkdir: async () => {},
  exists: name => file('exists', name),
  readFile: name => file('read', name),
  writeFile: (name, content) => file('write', name, content),
  unlink: name => file('remove', name),
  downloadFile: async (url, name, method, headers, body) => {
    const response = await fetch(url, { method, headers, body });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await file('write', name, await response.text());
  },
};
