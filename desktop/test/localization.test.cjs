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
