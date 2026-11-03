const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sortDriveBackups, createdAtMillis } = require('../src/driveBackupList.cjs');

test('Drive backup selector identifies the newest date even when API order is mixed', () => {
  const items = [
    { id: 'old', name: 'LNReader-2026-01.zip', createdTime: '2026-01-01T00:00:00Z' },
    { id: 'unknown', name: 'LNReader-undated.zip', createdTime: '' },
    { id: 'latest', name: 'LNReader-2026-11.zip', createdTime: '2026-11-03T20:00:00Z' },
    { id: 'middle', name: 'LNReader-2026-08.zip', createdTime: '2026-08-15T10:00:00Z' },
  ];
  const copy = items.map(item => ({ ...item }));
  assert.deepEqual(sortDriveBackups(items).map(item => item.id), ['latest', 'middle', 'old', 'unknown']);
  assert.deepEqual(items, copy, 'Sorting must not change source state');
  assert.equal(createdAtMillis(items[2]), Date.parse('2026-11-03T20:00:00Z'));
  assert.equal(createdAtMillis(items[1]), 0);
});

test('Drive backup ordering is deterministic with identical or missing timestamps', () => {
  const ties = [
    { id: 'b', name: 'LNReader-same.zip', createdTime: '2026-11-03T10:00:00Z' },
    { id: 'a', name: 'LNReader-same.zip', createdTime: '2026-11-03T10:00:00Z' },
    { id: 'c', name: 'LNReader-older.zip', createdTime: 'invalid date' },
  ];
  assert.deepEqual(sortDriveBackups(ties).map(item => item.id), ['a', 'b', 'c']);
  assert.equal(createdAtMillis(ties[2]), 0);
});
