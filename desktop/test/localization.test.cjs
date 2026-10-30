const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  languages,
  messages,
  t,
  setLocale,
  getLocale,
} = require('../src/i18n.cjs');
test('all interface messages have nonempty translations in ten distinct locales and matching placeholders', () => {
  assert.equal(new Set(languages.map(([code]) => code)).size, 10);
  for (const [key, row] of Object.entries(messages)) {
    const tokens = [...key.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
    for (const [code] of languages) {
      assert.equal(typeof row[code], 'string', key + ': ' + code);
      assert.ok(row[code].trim(), key + ': ' + code);
      assert.deepEqual(
        [...row[code].matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
        tokens,
      );
    }
  }
});
test('locale switching preserves unknown source content, safely interpolates and recovers from an unsupported language', () => {
  setLocale('ja');
  assert.equal(getLocale(), 'ja');
  assert.equal(t('Biblioteca'), 'ライブラリ');
  assert.equal(
    t('Uma obra que não deve ser traduzida'),
    'Uma obra que não deve ser traduzida',
  );
  assert.equal(t('Buscar em {count} fontes', { count: 3 }), '配信元3件を検索');
  setLocale('invalid');
  assert.equal(getLocale(), 'pt-BR');
});

test('palette and reader theme options have localized labels for all ten interfaces', () => {
  const options = [
    'Padrão', 'Crepúsculo', 'Turquesa', 'Lavanda', 'Morango',
    'Seguir aplicativo', 'Escuro', 'Claro', 'Sépia',
    'Claro original', 'Sépia original', 'Verde suave',
    'Escuro original', 'Preto AMOLED',
  ];
  for (const key of options) {
    assert.ok(messages[key], 'Missing theme label: ' + key);
    for (const [code] of languages) {
      assert.equal(typeof t(key, {}, code), 'string', key + ': ' + code);
      assert.ok(t(key, {}, code).trim(), key + ': ' + code);
    }
  }
  for (const label of ['Crepúsculo', 'Turquesa', 'Lavanda', 'Morango', 'Sépia', 'Seguir aplicativo']) {
    assert.notEqual(t(label, {}, 'en'), label, label + ' must translate into English');
  }
});

test('saved stock category tabs are translated without rewriting names or custom categories', () => {
  const { categoryDisplayName } = require('../src/libraryCategoryLabels.cjs');
  const original = [
    { id: 1, name: 'Padrão', novelIds: [123] },
    { id: 2, name: 'Localização', novelIds: [] },
    { id: 3, name: 'Minha categoria', novelIds: [] },
  ];
  for (const [language] of languages) {
    assert.equal(
      categoryDisplayName(original[0].name, language),
      t('Padrão', {}, language),
    );
    assert.equal(
      categoryDisplayName(original[1].name, language),
      t('Localização', {}, language),
    );
    assert.equal(categoryDisplayName(original[2].name, language), 'Minha categoria');
    assert.equal(
      t('{count} obra(s) selecionada(s)', { count: 3 }, language)
        .includes('3'),
      true,
    );
    assert.ok(t('Carregando…', {}, language).trim());
  }
  assert.equal(categoryDisplayName('Padrão', 'ja'), '標準');
  assert.equal(categoryDisplayName('Localização', 'ja'), 'ローカライズ');
  assert.equal(original[0].name, 'Padrão');
  assert.equal(original[0].novelIds[0], 123);
});
