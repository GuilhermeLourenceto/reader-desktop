const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  languages,
  messages,
  t,
  setLocale,
  getLocale,
} = require('../src/i18n.cjs');
test('English is the initial interface locale and unsupported locale fallback', () => {
  assert.equal(getLocale(), 'en');
  setLocale('does-not-exist');
  assert.equal(getLocale(), 'en');
});
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
  assert.equal(getLocale(), 'ja', 'an invalid locale cannot undo the user choice');
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
  const { categoryDisplayName } = require('../src/domain/libraryCategoryLabels.cjs');
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


test('About screen labels Windows and Linux in all ten interface languages', () => {
  const message = '· Versão experimental para Windows e Linux';
  assert.ok(messages[message], 'Missing cross-platform label');
  for (const [locale] of languages) {
    const label = t(message, {}, locale);
    assert.ok(label.trim(), 'Empty platform label in ' + locale);
    assert.ok(label.includes('Windows'), 'Windows missing in ' + locale);
    assert.ok(label.includes('Linux'), 'Linux missing in ' + locale);
    assert.ok(!label.includes('para Windows|'), 'Unexpected separator in ' + locale);
  }
  assert.equal(messages['· Versão experimental para Windows'], undefined);
});

test('native restore confirmation button is translated in all ten locales', () => {
  assert.ok(messages['Restaurar'], 'Missing translation for native Restore button');
  for (const [code] of languages) {
    const label = t('Restaurar', {}, code);
    assert.ok(label.trim(), 'Empty restore button: ' + code);
  }
  assert.equal(t('Restaurar', {}, 'en'), 'Restore');
  assert.equal(t('Restaurar', {}, 'de'), 'Wiederherstellen');
  assert.equal(t('Restaurar', {}, 'ja'), '復元');
});

test('missing and invalid locale requests preserve the last valid language', () => {
  setLocale('pt-BR');
  for (const invalid of [undefined, null, '', 0, false, 'xx', 'pt', 'es-MX', {}]) {
    setLocale(invalid);
    assert.equal(getLocale(), 'pt-BR', String(invalid));
  }
  setLocale('ja');
  assert.equal(getLocale(), 'ja');
  assert.equal(t('Biblioteca', {}, 'not-supported'), 'ライブラリ');
  assert.equal(t('Biblioteca', {}, null), 'ライブラリ');
  setLocale('en');
  assert.equal(getLocale(), 'en', 'explicitly selecting English still works');
});

test('renamed Reader Desktop dialogs and settings resolve in every locale', () => {
  const expected = {
    'O Reader Desktop ainda não conseguiu concluir o fechamento.': 'Reader Desktop has not finished closing yet.',
    'O Reader Desktop falhou repetidamente e será fechado. A biblioteca salva foi mantida.': 'Reader Desktop failed repeatedly and will close. Your saved library was kept.',
    'O Reader Desktop precisou recarregar a interface depois de uma falha. A biblioteca salva será restaurada.': 'Reader Desktop reloaded the interface after a failure. Your saved library will be restored.',
    'Não foi possível abrir o Reader Desktop': 'Could not open Reader Desktop',
    'Reader Desktop e informações da versão': 'About Reader Desktop and this version',
    'Importar um backup do Reader Desktop': 'Import a Reader Desktop backup',
    'Apagar o histórico de diagnósticos?': 'Clear diagnostic history?',
    'Relatórios salvos manualmente não serão apagados.': 'Manually saved reports will not be deleted.',
    'Apagar histórico': 'Clear history',
    'categorias': 'categories',
    'configurações': 'settings',
    'fontes': 'sources',
    'Seções ausentes no backup; os dados atuais serão preservados:': 'Sections missing from the backup; current data will be preserved:',
    'Restaurar seções selecionadas do backup?': 'Restore selected backup sections?',
  };
  for (const [key, english] of Object.entries(expected)) {
    assert.ok(Object.hasOwn(messages, key), 'Missing catalog key: ' + key);
    assert.equal(t(key, {}, 'en'), english);
    assert.equal(t(key, {}, 'pt-BR'), key);
    for (const [code] of languages) {
      const label = t(key, {}, code);
      assert.ok(label.trim(), key + ': ' + code);
      if (key.includes('Reader Desktop')) {
        assert.ok(label.includes('Reader Desktop'), key + ': ' + code);
        assert.ok(!label.includes('LNReader'), key + ': ' + code);
        if (code !== 'pt-BR') assert.notEqual(label, key, key + ': ' + code);
      }
    }
  }
});

test('literal main process ui calls have catalog entries', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../src/main.cjs'), 'utf8');
  const keys = new Set(
    [...source.matchAll(/\bui\(\s*(['"])([^'"\n]*)\1/g)].map((match) => match[2]),
  );
  assert.ok(keys.size >= 20, 'Expected native UI messages');
  assert.deepEqual(
    [...keys].filter((key) => !Object.hasOwn(messages, key)),
    [],
    'Missing native UI translations',
  );
  assert.match(source, /\['\.', '\.\.', '__proto__', 'constructor', 'prototype'\]/);
});
