const { test } = require('node:test');
const assert = require('node:assert/strict');
const { orderGlobalSearchRows } = require('../src/domain/globalSourceOrder.cjs');

test('fontes com resultados aparecem primeiro mesmo ao responder fora de ordem', () => {
  const rows = [
    { id: 'empty', items: [], page: 1 },
    { id: 'waiting', items: [], queued: true },
    { id: 'found-1', items: [{ path: '/a' }] },
    { id: 'error', items: [], error: 'falha' },
    { id: 'found-2', items: [{ path: '/b' }, { path: '/c' }] },
    { id: 'running', items: [], pending: true },
  ];
  assert.deepEqual(orderGlobalSearchRows(rows).map(row => row.id), [
    'found-1', 'found-2', 'waiting', 'running', 'empty', 'error',
  ]);
  assert.equal(rows[0].id, 'empty', 'ordenação não modifica os dados originais');
  rows[1].items = [{ path: '/d' }];
  assert.deepEqual(orderGlobalSearchRows(rows).slice(0, 3).map(row => row.id), [
    'waiting', 'found-1', 'found-2',
  ]);
});
