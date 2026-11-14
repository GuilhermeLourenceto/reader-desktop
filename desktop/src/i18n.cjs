const { languages, messages } = require('./locales.cjs');
const { DEFAULT_DESKTOP_SETTINGS } = require('./state/defaultSettings.cjs');
const supportedLocales = new Set(languages.map(([code]) => code));
let locale = DEFAULT_DESKTOP_SETTINGS.desktopInterfaceLanguage;
const listeners = new Set();
function getLocale() {
  return locale;
}
function setLocale(value) {
  // Invalid, missing or unrecognized values are not an instruction to
  // switch languages. Keep the last explicitly selected valid locale.
  if (!supportedLocales.has(value) || value === locale) return;
  locale = value;
  if (typeof document !== 'undefined') document.documentElement.lang = value;
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
  const selected = supportedLocales.has(language) ? language : locale;
  return (messages[message]?.[selected] || message).replace(
    /\{(\w+)\}/g,
    (token, key) => (Object.hasOwn(values, key) ? String(values[key]) : token),
  );
}
module.exports = { languages, messages, getLocale, setLocale, subscribe, t };
