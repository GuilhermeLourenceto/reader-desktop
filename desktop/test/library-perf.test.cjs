const test = require('node:test');
const assert = require('node:assert/strict');
const { nextNovelPage, nextChapterId } = require('../src/libraryPerf.cjs');

const oldLoadedPages = novel => [
  ...new Set([
    ...(novel.desktopLoadedPages || []),
    ...novel.chapters.map(chapter => Number(chapter.page || 1)),
  ]),
];
const oldNextNovelPage = novel =>
  Array.from({ length: Number(novel.totalPages || 1) }, (_, i) => i + 1)
    .find(page => !oldLoadedPages(novel).includes(page));
const oldNextChapterId = novels => {
  const chapters = novels.flatMap(novel => novel.chapters);
  const id = chapters.reduce((max, chapter) => Math.max(max, chapter.id || 0), 0) + 1;
  if (!Number.isSafeInteger(id))
    throw new Error('O identificador dos dados ultrapassou o limite suportado.');
  return id;
};

test('next page matches existing behavior for gaps, duplicates, and string metadata', () => {
  for (const pages of [[], [1], [1, 2], [1, 3], [2, 4], [1, 2, 3, 4]]) {
    const novel = {
      totalPages: 4,
      chapters: pages.map(page => ({ page: String(page) })),
      desktopLoadedPages: [1],
    };
    assert.equal(nextNovelPage(novel), oldNextNovelPage(novel));
  }
  const stringMetadata = {
    totalPages: 3,
    chapters: [],
    desktopLoadedPages: ['1', 2],
  };
  assert.equal(nextNovelPage(stringMetadata), oldNextNovelPage(stringMetadata));
  assert.equal(nextNovelPage({ chapters: [], totalPages: 1 }), 1);
  assert.equal(nextNovelPage({ chapters: [{ page: 1 }] }), undefined);
});

test('next page handles large mostly-complete sources without mutating metadata', () => {
  const novel = {
    totalPages: 10000,
    chapters: Array.from({ length: 9999 }, (_, i) => ({ page: String(i + 1) })),
    desktopLoadedPages: [1],
  };
  assert.equal(nextNovelPage(novel), 10000);
  assert.equal(novel.desktopLoadedPages.length, 1);
  assert.equal(novel.chapters.length, 9999);
});

test('next chapter ID matches flattened legacy scan for 10k novels / 200k chapters', () => {
  const novels = Array.from({ length: 10000 }, (_, i) => ({
    chapters: Array.from({ length: 20 }, (_, j) => ({ id: i * 20 + j + 1 })),
  }));
  assert.equal(nextChapterId(novels), oldNextChapterId(novels));
  assert.equal(nextChapterId(novels), 200001);
  assert.equal(nextChapterId([]), 1);
});

test('next chapter ID still rejects exhausted safe integer range', () => {
  const novels = [{ chapters: [{ id: Number.MAX_SAFE_INTEGER }] }];
  assert.throws(() => nextChapterId(novels), /identificador.*limite/);
});
