const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  mergeChapters,
  recordProgress,
  resumeChapter,
  chapterPercent,
  validateSourceItems,
  chapterOrdinals,
  chaptersNewestFirst,
  chapterReleaseLabel,
  chapterDirection,
  readingChapters,
} = require('../src/domain.cjs');
const { getLocale, setLocale } = require('../src/i18n.cjs');
test('source order stays intact while chronological numbering and resume begin at the oldest chapter', () => {
  const novel = {
    chapters: [
      { id: 3, name: 'Chapter 103', unread: true },
      { id: 2, name: 'Chapter 102', unread: true },
      { id: 1, name: 'Chapter 101', unread: true },
    ],
  };
  assert.equal(chapterDirection(novel).direction, 'descending');
  const ordinals = chapterOrdinals(
    novel.chapters,
    chapterDirection(novel).direction,
  );
  assert.deepEqual(
    novel.chapters.map(ch => ordinals.get(ch.id)),
    [3, 2, 1],
  );
  assert.equal(resumeChapter(novel).id, 1);
  assert.deepEqual(
    readingChapters(novel).map(ch => ch.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    novel.chapters.map(ch => ch.id),
    [3, 2, 1],
  );
  assert.equal(
    chapterDirection({ ...novel, desktopChapterOrder: 'ascending' }).direction,
    'ascending',
  );
});
test('unknown chapter order is explicit and can be corrected manually', () => {
  const novel = {
    chapters: [
      { id: 1, name: 'Storm', chapterNumber: 1 },
      { id: 2, name: 'Dawn', chapterNumber: 2 },
    ],
  };
  assert.equal(chapterDirection(novel).detected, false);
  assert.equal(
    chapterDirection({ ...novel, desktopChapterOrder: 'descending' }).direction,
    'descending',
  );
  assert.equal(
    resumeChapter({ ...novel, desktopChapterOrder: 'descending' }).id,
    2,
  );
  assert.equal(
    chapterDirection({
      chapters: [{ releaseTime: '2026-10-02' }, { releaseTime: '2026-10-01' }],
    }).direction,
    'descending',
  );
});
test('newest-first chapter display keeps the oldest chapter at the bottom in either source direction', () => {
  const ascending = [
    { id: 1, name: 'Chapter 1' },
    { id: 2, name: 'Chapter 2' },
    { id: 3, name: 'Chapter 3' },
  ];
  const descending = [...ascending].reverse();
  assert.deepEqual(
    chaptersNewestFirst(ascending, 'ascending').map(chapter => chapter.id),
    [3, 2, 1],
  );
  assert.deepEqual(
    chaptersNewestFirst(descending, 'descending').map(chapter => chapter.id),
    [3, 2, 1],
  );
  assert.deepEqual(
    chaptersNewestFirst(ascending.slice(1), 'ascending').map(
      chapter => chapter.id,
    ),
    [3, 2],
  );
});
test('local numbering ignores source chapter numbers and remains stable through filters and reversed views', () => {
  const chapters = [
    { id: 20, name: 'Prólogo', chapterNumber: 0 },
    { id: 4, name: 'Capítulo 100', chapterNumber: 100 },
    { id: 32, name: 'Extra', chapterNumber: 100.5 },
  ];
  const numbers = chapterOrdinals(chapters);
  assert.deepEqual(
    [...chapters].reverse().map(ch => numbers.get(ch.id)),
    [3, 2, 1],
  );
  assert.equal(numbers.get(chapters.filter(ch => ch.id === 4)[0].id), 2);
  const merged = mergeChapters(
    [{ ...chapters[0], path: '/start', releaseTime: '2026-10-01' }],
    [{ path: '/start', name: 'Prólogo' }],
    1,
    33,
  );
  assert.equal(merged[0].releaseTime, '2026-10-01');
});
test('release labels follow the interface language without changing unknown dates', () => {
  const previous = getLocale();
  try {
    setLocale('pt-BR');
    assert.equal(chapterReleaseLabel('2026-10-01'), '01/10/2026');
    setLocale('en');
    assert.equal(
      chapterReleaseLabel('2026-10-01'),
      new Intl.DateTimeFormat('en').format(new Date(2026, 9, 1, 12)),
    );
    assert.equal(chapterReleaseLabel('2 days ago'), '2 days ago');
    assert.equal(chapterReleaseLabel('01/02/2026'), '01/02/2026');
    assert.equal(chapterReleaseLabel(undefined), '');
  } finally {
    setLocale(previous);
  }
});
test('chapter refresh preserves local state and updates source metadata without duplicate paths', () => {
  const old = [
    {
      id: 7,
      novelId: 2,
      path: '/c1',
      name: 'Old',
      page: '1',
      position: 0,
      unread: false,
      bookmark: true,
      progress: 65,
      isDownloaded: true,
      readTime: '2026-10-28T00:00:00Z',
    },
  ];
  const result = mergeChapters(
    old,
    [
      { path: '/c1', name: 'Renamed', scanlator: ['A', 'B'] },
      { path: '/c2', name: 'New' },
      { path: '/c2', name: 'New final' },
    ],
    2,
    8,
  );
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    ...old[0],
    name: 'Renamed',
    scanlator: 'A, B',
    chapterNumber: 1,
    releaseTime: '',
  });
  assert.equal(result[1].id, 8);
  assert.equal(result[1].unread, true);
  assert.equal(result[1].name, 'New final');
});
test('chapter order matches native page and source position ordering', () => {
  const page2 = [
    {
      id: 7,
      novelId: 2,
      path: '/later',
      name: 'Later',
      page: '2',
      position: 0,
    },
  ];
  const result = mergeChapters(
    page2,
    [
      { path: '/first', name: 'First' },
      { path: '/second', name: 'Second' },
    ],
    2,
    8,
    '1',
  );
  assert.deepEqual(
    result.map(chapter => chapter.path),
    ['/first', '/second', '/later'],
  );
});
test('invalid chapter responses leave the old list unchanged', () => {
  const old = [{ id: 1, path: '/c1' }];
  assert.throws(
    () => mergeChapters(old, [{ name: 'missing path' }], 1, 2),
    /inválida/,
  );
  assert.deepEqual(old, [{ id: 1, path: '/c1' }]);
  assert.throws(() => validateSourceItems(null));
});
test('native percent scale and 97 percent read threshold', () => {
  const chapter = { id: 1, unread: true, progress: 0 };
  assert.equal(recordProgress(chapter, 96).unread, true);
  assert.equal(recordProgress(chapter, 97).unread, false);
  assert.equal(recordProgress(chapter, 150).progress, 100);
  assert.equal(recordProgress(chapter, -10).progress, 0);
  assert.equal(recordProgress({ ...chapter, unread: false }, 10).unread, false);
  assert.equal(chapterPercent({ progress: 1 }), 1);
  assert.equal(
    chapterPercent({ progress: 0.42, desktopProgressUnit: 'fraction' }),
    42,
  );
});
test('continue prefers the last visited chapter, matching the original read button', () => {
  const chapters = [
    { id: 1, unread: true },
    { id: 2, unread: true, progress: 40, readTime: '2026-10-28T01:00:00Z' },
  ];
  assert.equal(resumeChapter({ chapters }).id, 2);
  assert.equal(
    resumeChapter({
      chapters: [chapters[0], { ...chapters[1], unread: false, progress: 100 }],
    }).id,
    2,
  );
});
