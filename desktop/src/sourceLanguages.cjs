// Language codes come from LNReader plugin metadata (lang), not the site URL.
const aliases = {
  'português': 'pt', portugues: 'pt', portuguese: 'pt', 'pt-br': 'pt',
  english: 'en', 'inglês': 'en', ingles: 'en', 'en-us': 'en',
};
function sourceLanguage(plugin) {
  const raw = typeof plugin?.lang === 'string'
    ? plugin.lang.trim().toLowerCase().replace(/_/g, '-')
    : '';
  const code = aliases[raw] || raw.split('-')[0];
  return /^[a-z]{2,3}$/.test(code) ? code : 'unknown';
}
function languageLabel(code) {
  if (code === 'unknown') return 'Idioma não informado';
  try {
    const name = new Intl.DisplayNames(['pt-BR'], { type: 'language' }).of(code);
    if (name && name !== code) return name[0].toLocaleUpperCase('pt-BR') + name.slice(1);
  } catch {}
  return code.toUpperCase();
}
function sourceLanguageOptions(installed = [], available = []) {
  return [...new Set([...installed, ...available].map(sourceLanguage))]
    .sort((a, b) =>
      (a === 'pt' ? -1 : a === 'en' ? 0 : 1) -
      (b === 'pt' ? -1 : b === 'en' ? 0 : 1) ||
      languageLabel(a).localeCompare(languageLabel(b), 'pt-BR'),
    )
    .map(code => ({ code, label: languageLabel(code) }));
}
function matchesSourceLanguage(plugin, language = 'all') {
  return language === 'all' || sourceLanguage(plugin) === language;
}
function matchesSourceSearch(plugin, query) {
  const text = [plugin?.name, plugin?.lang, languageLabel(sourceLanguage(plugin))]
    .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
  return text.includes(String(query || '').trim().toLocaleLowerCase('pt-BR'));
}
module.exports = { sourceLanguage, sourceLanguageOptions, matchesSourceLanguage, matchesSourceSearch };
