export const PLUGIN_STORAGE = 'Plugins';
export const LEGACY_PLUGIN_STORAGE = PLUGIN_STORAGE;
export const getUserAgent = () => navigator.userAgent;
export const getString = key => key;
export const showToast = message =>
  window.dispatchEvent(new CustomEvent('notice', { detail: message }));
export const getEnabledRepositoriesFromDb = async () =>
  JSON.parse(localStorage.getItem('repositories') || '[]').map(url => ({
    url,
  }));
export const getMMKVObject = key => {
  const value = localStorage.getItem(key);
  return value === null ? undefined : JSON.parse(value);
};
export const setMMKVObject = (key, value) =>
  localStorage.setItem(key, JSON.stringify(value));
export const createMMKV = ({ id }) => ({
  getString: key => localStorage.getItem(`${id}:${key}`) ?? undefined,
  set: (key, value) => {
    localStorage.setItem(`${id}:${key}`, String(value));
    window.dispatchEvent(new Event('plugin-storage-change'));
  },
  remove: key => {
    localStorage.removeItem(`${id}:${key}`);
    window.dispatchEvent(new Event('plugin-storage-change'));
  },
  getAllKeys: () =>
    Object.keys(localStorage)
      .filter(key => key.startsWith(`${id}:`))
      .map(key => key.slice(id.length + 1)),
});
export default {
  mkdir: async () => {},
  exists: path => window.desktop.file('exists', path),
  readFile: path => window.desktop.file('read', path),
  writeFile: (path, content) => window.desktop.file('write', path, content),
  unlink: path => window.desktop.file('remove', path),
  downloadFile: async (url, path, method, headers, body) => {
    const response = await fetch(url, { method, headers, body });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await window.desktop.file('write', path, await response.text());
  },
};
