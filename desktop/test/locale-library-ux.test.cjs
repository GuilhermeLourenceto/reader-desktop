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
  "{count} obra(s)",
  "Categoria da biblioteca",
  "Ordenar biblioteca",
  "Marcador",
  "{count} selecionados",
  "{v0} de {v1}",
  "Capítulo {v0} de {v1}",
  "Adicionar marcador a {v0}",
  "Remover marcador de {v0}",
  "Marcar como lido: {v0}",
  "Marcar como não lido: {v0}",
  "Baixar capítulo: {v0}",
  "Apagar download: {v0}",
  "Baixar atualização: {v0}",
  "Apagar download da atualização: {v0}",
  "Capítulo {v0}",
  "Lançamento: {v0}",
  "Filtros ativos",
  "Mostrar mais histórico",
  "Mostrar mais capítulos"
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

test('chapter action labels keep the source title and translate into every language', () => {
  const { t } = require('../src/i18n.cjs');
  const actions = ["Adicionar marcador a {v0}","Remover marcador de {v0}","Marcar como lido: {v0}","Marcar como não lido: {v0}","Baixar capítulo: {v0}","Apagar download: {v0}","Baixar atualização: {v0}","Apagar download da atualização: {v0}"];
  for (const [locale] of languages) {
    for (const action of actions) {
      const text = t(action, { v0: 'My chapter 42' }, locale);
      assert.ok(text.includes('My chapter 42'), action + ': missing original chapter name in ' + locale);
      assert.ok(!text.includes('{v0}'), action + ': unresolved parameter in ' + locale);
    }
  }
});
