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

// Keep badge counts consistent with the existing React UI: absent "unread"
// means unread, while downloaded requires a truthy isDownloaded flag.
function countChapterStatuses(chapters) {
  let downloaded = 0;
  let unread = 0;
  for (const chapter of chapters) {
    if (chapter.isDownloaded) downloaded++;
    if (chapter.unread !== false) unread++;
  }
  return { downloaded, unread };
}

module.exports = { nextNovelPage, nextChapterId, countChapterStatuses };
