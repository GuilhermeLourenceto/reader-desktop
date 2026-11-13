const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  sourceLanguage, sourceLanguageOptions, matchesSourceLanguage, matchesSourceSearch,
} = require('../src/domain/sourceLanguages.cjs');
const { getLocale, setLocale } = require('../src/i18n.cjs');

test('normaliza códigos oficiais e suas variantes regionais', () => {
  for (const value of ['pt', 'pt-BR', 'pt_BR', 'Português']) {
    assert.equal(sourceLanguage({ lang: value }), 'pt');
  }
  for (const value of ['en', 'en-US', 'english']) {
    assert.equal(sourceLanguage({ lang: value }), 'en');
  }
  assert.equal(sourceLanguage({ lang: 'es' }), 'es');
  assert.equal(sourceLanguage({ lang: '' }), 'unknown');
  assert.equal(sourceLanguage({}), 'unknown');
});
test('lista dinamicamente os idiomas de fontes disponíveis e instaladas', () => {
  const options = sourceLanguageOptions(
    [{ lang: 'pt' }, { lang: 'en-US' }],
    [{ lang: 'pt-BR' }, { lang: 'ja' }, { lang: 'es' }, {}],
  );
  assert.deepEqual(options.slice(0, 2).map(item => item.code), ['pt', 'en']);
  assert.equal(options.filter(item => item.code === 'pt').length, 1);
  assert.ok(options.some(item => item.code === 'ja'));
  assert.ok(options.some(item => item.code === 'unknown'));
  assert.ok(options.find(item => item.code === 'pt').label.toLowerCase().includes('portugu'));
});
test('filtra os dois catálogos por idioma mantendo a pesquisa de texto', () => {
  const br = { name: 'Novel Mania', lang: 'pt-BR' };
  const usa = { name: 'Royal Road', lang: 'en' };
  assert.equal(matchesSourceLanguage(br, 'pt'), true);
  assert.equal(matchesSourceLanguage(usa, 'pt'), false);
  assert.equal(matchesSourceLanguage(usa, 'all'), true);
  const previous = getLocale();
  try {
    for (const locale of ['en', 'pt-BR', 'ja']) {
      setLocale(locale);
      assert.equal(matchesSourceSearch(br, 'português'), true, 'Native name ' + locale);
      assert.equal(matchesSourceSearch(br, 'Portuguese'), true, 'English name ' + locale);
      assert.equal(matchesSourceSearch(usa, 'royal'), true);
    }
  } finally {
    setLocale(previous);
  }
});
