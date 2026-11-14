const { test } = require('node:test');
const assert = require('node:assert/strict');
const { userMessageForError } = require('../src/domain/userFacingError.cjs');

const cases = [
  ['ENOSPC: no space left on device', 'Não há espaço suficiente para concluir a operação.'],
  ['EACCES: permission denied', 'Não foi possível acessar os arquivos. Verifique as permissões.'],
  ['CRC incorreto no backup', 'Não foi possível ler o backup. Verifique o arquivo e tente novamente.'],
  ['ADM-ZIP: Invalid zip header', 'Não foi possível ler o backup. Verifique o arquivo e tente novamente.'],
  ['ENOTFOUND source.example', 'Não foi possível acessar a fonte. Verifique a conexão e tente novamente.'],
  ['ECONNRESET fetching novel', 'Não foi possível acessar a fonte. Verifique a conexão e tente novamente.'],
  ['Página temporariamente indisponível', 'Página temporariamente indisponível'],
  ['Unexpected TypeError', 'Não foi possível concluir esta ação. Tente novamente.'],
];
test('user messages explain the next step without exposing technical details', () => {
  for (const [detail, expected] of cases) {
    assert.equal(userMessageForError(new Error(detail)), expected);
  }
});
test('secrets, URLs, local paths and technical stack traces are never shown in the error notice', () => {
  const sensitive = [
    'https://example.org/book?token=abc123',
    '/home/guilherme/private/backup.zip',
    'Cookie: session=secret-key',
    'at Object.fake (/tmp/library.js:1:1)',
  ];
  for (const detail of sensitive) {
    const text = userMessageForError(new Error('Unexpected: ' + detail));
    assert.ok(text === 'Não foi possível concluir esta ação. Tente novamente.' ||
      text === 'Não foi possível ler o backup. Verifique o arquivo e tente novamente.');
    assert.equal(text.includes(detail), false);
  }
});
test('malformed error values are safe to show', () => {
  for (const e of [null, undefined, '', 0, false, {}])
    assert.equal(userMessageForError(e), 'Não foi possível concluir esta ação. Tente novamente.');
});
