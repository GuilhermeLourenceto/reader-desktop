const { languages, messages } = require('./locales.cjs');
const { DEFAULT_DESKTOP_SETTINGS } = require('./defaultSettings.cjs');
let locale = DEFAULT_DESKTOP_SETTINGS.desktopInterfaceLanguage;
const listeners = new Set();
function getLocale() {
  return locale;
}
function setLocale(value) {
  const next = languages.some(([code]) => code === value) ? value : DEFAULT_DESKTOP_SETTINGS.desktopInterfaceLanguage;
  if (next === locale) return;
  locale = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  for (const listener of listeners) listener();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function t(message, values = {}, language = locale) {
  if (typeof values === 'string') {
    language = values;
    values = {};
  }
  return (messages[message]?.[language] || message).replace(
    /\{(\w+)\}/g,
    (token, key) => (Object.hasOwn(values, key) ? String(values[key]) : token),
  );
}
module.exports = { languages, messages, getLocale, setLocale, subscribe, t };
