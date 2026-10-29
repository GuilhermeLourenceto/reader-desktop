const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  withSourceDeadline,
  validateFilters,
  validatePluginMetadata,
} = require('../src/sourceGuards.cjs');
const {
  validateSourceItems,
  validateNovelDetails,
} = require('../src/domain.cjs');
test('unresolved async extension methods time out and thrown strings remain contained', async () => {
  await assert.rejects(
    withSourceDeadline(() => new Promise(() => {}), 5),
    /a tempo/,
  );
  assert.equal(await withSourceDeadline(() => 'ready', 5), 'ready');
  await assert.rejects(
    withSourceDeadline(() => {
      throw new Error('source error');
    }),
    /source error/,
  );
});
test('malformed source data cannot enter React or allocate an unlimited page list', () => {
  assert.throws(
    () => validateSourceItems([{ path: '/a', name: { invalid: true } }]),
    /inválida/,
  );
  assert.throws(
    () =>
      validateNovelDetails({ name: 'A', totalPages: Infinity, chapters: [] }),
    /páginas/,
  );
  assert.throws(
    () => validateNovelDetails({ genres: [null], chapters: [] }),
    /gêneros/,
  );
  assert.deepEqual(validateSourceItems([{ path: '/a' }]), [
    { path: '/a', name: '/a' },
  ]);
  assert.throws(
    () => validateFilters({ genre: { type: 'Picker', options: null } }),
    /opções/,
  );
  assert.deepEqual(
    validateFilters({ genre: { type: 'Checkbox', options: [], value: null } })
      .genre.value,
    [],
  );
  assert.throws(
    () =>
      validatePluginMetadata({
        id: '__proto__',
        name: 'A',
        url: 'https://example.test',
      }),
    /inválidos/,
  );
});
