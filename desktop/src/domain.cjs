function validateSourceItems(items, kind = 'obras') {
  if (
    !Array.isArray(items) ||
    items.length > 100000 ||
    items.some(
      item =>
        !item ||
        typeof item.path !== 'string' ||
        !item.path.trim() ||
        (item.name != null && typeof item.name !== 'string') ||
        (item.cover != null && typeof item.cover !== 'string'),
    )
  ) {
    throw new Error(
      `A fonte retornou uma lista inválida de ${kind}. Atualize o plugin e tente novamente.`,
    );
  }
  return items.map(item => ({ ...item, name: item.name || item.path }));
}

function validateNovelDetails(detail) {
  if (!detail || typeof detail !== 'object')
    throw new Error('A fonte retornou detalhes inválidos.');
  const result = {};
  for (const field of ['name', 'author', 'status', 'summary', 'cover']) {
    if (detail[field] != null && typeof detail[field] !== 'string')
      throw new Error(`A fonte retornou um campo inválido: ${field}.`);
    if (detail[field] != null) result[field] = detail[field];
  }
  if (detail.genres != null) {
    if (
      typeof detail.genres !== 'string' &&
      (!Array.isArray(detail.genres) ||
        detail.genres.some(value => typeof value !== 'string'))
    )
      throw new Error('A fonte retornou gêneros inválidos.');
    result.genres = detail.genres;
  }
  const pages = Number(detail.totalPages ?? 1);
  if (!Number.isSafeInteger(pages) || pages < 1 || pages > 10000)
    throw new Error('A fonte retornou uma quantidade inválida de páginas.');
  result.totalPages = pages;
  result.chapters = validateSourceItems(detail.chapters, 'capítulos');
  return result;
}

// Mirror insertChapters: update source metadata by path while keeping all
// local identity, reading, bookmark and download fields on existing rows.
function mergeChapters(existing, incoming, novelId, firstId, page) {
  incoming = validateSourceItems(incoming, 'capítulos');
  if (existing.length + incoming.length > 400000)
    throw new Error(
      'A lista de capítulos excede o limite seguro para esta obra.',
    );
  const byPath = new Map(
    existing.map((chapter, index) => [
      chapter.path,
      {
        ...chapter,
        page: String(chapter.page || 1),
        position: chapter.position ?? index,
      },
    ]),
  );
  let id = firstId;
  incoming.forEach((chapter, index) => {
    const previous = byPath.get(chapter.path);
    byPath.set(chapter.path, {
      ...(previous || {
        id: id++,
        novelId,
        unread: true,
        bookmark: false,
        isDownloaded: false,
        progress: 0,
        timeSpent: 0,
      }),
      path: chapter.path,
      name: chapter.name || `Capítulo ${index + 1}`,
      chapterNumber: chapter.chapterNumber ?? index + 1,
      ...(chapter.chapterNumber != null
        ? { desktopSourceChapterNumber: chapter.chapterNumber }
        : {}),
      releaseTime:
        typeof chapter.releaseTime === 'string'
          ? chapter.releaseTime
          : previous?.releaseTime ?? '',
      scanlator: Array.isArray(chapter.scanlator)
        ? chapter.scanlator.filter(Boolean).join(', ')
        : chapter.scanlator ?? null,
      page: String(page ?? chapter.page ?? 1),
      position: index,
    });
  });
  return [...byPath.values()].sort(
    (a, b) =>
      Number(a.page) - Number(b.page) || a.position - b.position || a.id - b.id,
  );
}

function chapterPercent(chapter) {
  const value = Number(chapter.progress) || 0;
  return Math.max(
    0,
    Math.min(
      100,
      chapter.desktopProgressUnit === 'fraction' ? value * 100 : value,
    ),
  );
}

function recordProgress(chapter, percentage) {
  const progress = Math.max(0, Math.min(100, Number(percentage) || 0));
  return {
    ...chapter,
    progress,
    desktopProgressUnit: 'percent',
    unread: progress >= 97 ? false : chapter.unread,
  };
}

function resumeChapter(novel) {
  const last = novel.chapters
    .filter(chapter => chapter.readTime)
    .sort((a, b) => Date.parse(b.readTime) - Date.parse(a.readTime))[0];
  return (
    last ||
    readingChapters(novel).find(chapter => chapter.unread !== false) ||
    readingChapters(novel)[0]
  );
}

// Number the complete reading sequence before applying display filters/sorting.
function chapterOrdinals(chapters, order = 'ascending') {
  return new Map(
    chapters.map((chapter, index) => [
      chapter.id,
      order === 'descending' ? chapters.length - index : index + 1,
    ]),
  );
}

function chaptersNewestFirst(chapters, order = 'ascending') {
  const ordinals = chapterOrdinals(chapters, order);
  return [...chapters].sort(
    (first, second) => ordinals.get(second.id) - ordinals.get(first.id),
  );
}

function chapterDirection(novel) {
  if (['ascending', 'descending'].includes(novel.desktopChapterOrder))
    return {
      direction: novel.desktopChapterOrder,
      detected: true,
      manual: true,
    };
  const chapters = novel.chapters;
  if (chapters.length === 1 && Number(novel.totalPages || 1) === 1)
    return { direction: 'ascending', detected: true, manual: false };
  const titleNumber = chapter => {
    const match = String(chapter.name || '').match(
      /(?:\b(?:chapter|chap|cap[ií]tulo|cap|ch)\.?\s*|^\s*)(\d+(?:[.,]\d+)?)(?:\b|\s|[:.\-])/i,
    );
    return match ? Number(match[1].replace(',', '.')) : NaN;
  };
  const legacyGeneratedNumbers = chapters.every(
    (item, position) => Number(item.chapterNumber) === position + 1,
  );
  const metadataNumber = chapter => {
    if (chapter.desktopSourceChapterNumber != null)
      return Number(chapter.desktopSourceChapterNumber);
    // Old desktop versions generated 1..N even when the source had no number.
    if (legacyGeneratedNumbers) return NaN;
    return chapter.chapterNumber != null ? Number(chapter.chapterNumber) : NaN;
  };
  const dateNumber = chapter =>
    /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(chapter.releaseTime || '')
      ? Date.parse(chapter.releaseTime)
      : NaN;
  for (const extract of [titleNumber, metadataNumber, dateNumber]) {
    const values = chapters.map(extract).filter(Number.isFinite);
    let up = 0,
      down = 0;
    for (let index = 1; index < values.length; index++) {
      if (values[index] > values[index - 1]) up++;
      if (values[index] < values[index - 1]) down++;
    }
    if (up + down > 0 && Math.max(up, down) / (up + down) >= 0.8)
      return {
        direction: down > up ? 'descending' : 'ascending',
        detected: true,
        manual: false,
      };
  }
  return { direction: 'ascending', detected: false, manual: false };
}

function readingChapters(novel) {
  return chapterDirection(novel).direction === 'descending'
    ? [...novel.chapters].reverse()
    : novel.chapters;
}

function chapterReleaseLabel(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  // Preserve source-specific and relative dates rather than guessing day/month.
  if (!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(text)) return text;
  const date = new Date(text.length === 10 ? `${text}T12:00:00` : text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString('pt-BR');
}

module.exports = {
  validateSourceItems,
  validateNovelDetails,
  mergeChapters,
  chapterPercent,
  recordProgress,
  resumeChapter,
  chapterOrdinals,
  chaptersNewestFirst,
  chapterReleaseLabel,
  chapterDirection,
  readingChapters,
};
