const { test } = require('node:test');
const assert = require('node:assert/strict');
const { markNewChapters, updateGroups } = require('../src/domain/updates.cjs');
test('updates preserve read state and previous detection dates without duplicate notifications', () => {
  const old = {
    id: 1,
    path: '/old',
    unread: false,
    progress: 100,
    bookmark: true,
    updatedTime: '2026-01-01T12:00:00Z',
  };
  const incoming = [old, { id: 2, path: '/new', unread: true }];
  const once = markNewChapters([old], incoming, '2026-02-01T12:00:00Z');
  assert.deepEqual(once[0], old);
  assert.equal(once[1].updatedTime, '2026-02-01T12:00:00Z');
  assert.deepEqual(markNewChapters(once, once, '2026-03-01T12:00:00Z'), once);
});
test('update feed groups by local date and novel, ignores invalid dates and removed library entries', () => {
  const chapters = [
    { id: 1, updatedTime: '2026-02-02T12:00:00Z' },
    { id: 2, updatedTime: '2026-02-02T13:00:00Z' },
    { id: 3, updatedTime: 'invalid' },
    { id: 4 },
  ];
  const groups = updateGroups([
    { id: 1, inLibrary: true, chapters },
    { id: 2, inLibrary: false, chapters },
    {
      id: 3,
      inLibrary: true,
      chapters: [{ id: 5, updatedTime: '2026-01-01T12:00:00Z' }],
    },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].novel.id, 1);
  assert.equal(groups[0].chapters.length, 2);
});
