const test = require('node:test');
const assert = require('node:assert/strict');
const { languages, messages } = require('../src/locales.cjs');

const labels = [
  "Categoria",
  "Estado",
  "Estado das obras",
  "Não lidas",
  "Baixadas",
  "Ordenar por",
  "Ordem original",
  "Nome (A–Z)",
  "Nome (Z–A)",
  "Mais capítulos",
  "Selecionar todos",
  "Desmarcar obra",
  "Filtros e ordenação da biblioteca",
  "{count} obra(s)"
];

test('all ten desktop languages translate the library filter and context labels', () => {
  assert.equal(languages.length, 10);
  for (const label of labels) {
    const translations = messages[label];
    assert.ok(translations, 'Missing translation: ' + label);
    for (const [locale] of languages) {
      assert.equal(typeof translations[locale], 'string', label + ' @ ' + locale);
      assert.ok(translations[locale].trim(), label + ' empty @ ' + locale);
    }
    assert.notEqual(translations.en, label, 'English should not silently fall back: ' + label);
  }
});

test('library selection count interpolation is translated across locales', () => {
  const { t } = require('../src/i18n.cjs');
  for (const [locale] of languages) {
    const result = t('{count} obra(s)', { count: 42 }, locale);
    assert.ok(result.includes('42'), 'Count not interpolated in ' + locale);
  }
});
