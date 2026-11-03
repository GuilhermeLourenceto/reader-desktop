// Pure metadata scans shared by the renderer and Node tests.
// No persistence schema changes: local IDs and chapter-page semantics are kept.
function nextNovelPage(novel) {
  const loaded = new Set(novel.desktopLoadedPages || []);
  for (const chapter of novel.chapters)
    loaded.add(Number(chapter.page || 1));
  const total = Number(novel.totalPages || 1);
  for (let page = 1; page <= total; page++)
    if (!loaded.has(page)) return page;
  return undefined;
}

function nextChapterId(novels) {
  let max = 0;
  for (const novel of novels)
    for (const chapter of novel.chapters)
      max = Math.max(max, chapter.id || 0);
  const id = max + 1;
  if (!Number.isSafeInteger(id))
    throw new Error(
      'O identificador dos dados ultrapassou o limite suportado.',
    );
  return id;
}

module.exports = { nextNovelPage, nextChapterId };
