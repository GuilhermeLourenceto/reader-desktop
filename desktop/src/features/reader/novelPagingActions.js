// Chapter listing pagination and navigation across source pages.
import { loadPlugin, fetchPage } from '../../sourceClient';
import { withSourceDeadline } from '../../sourceGuards.cjs';
import { mergeChapters, chapterDirection } from '../../domain/novels.cjs';
import { nextChapterId, loadedPages } from '../../state/libraryState';
import { markNewChapters } from '../../domain/updates.cjs';

export function createNovelPagingActions({
  current, changeNovel, loadChapter, novelId, chapterId, setNotice,
}) {
  const loadNovelPage = async (book, page, trackUpdates = false) => {
    const plugin = await loadPlugin(book.pluginId);
    if (!plugin?.parsePage)
      throw new Error('Esta fonte não oferece paginação de capítulos.');
    const response = await withSourceDeadline(() =>
      fetchPage(book.pluginId, book.path, String(page)),
    );
    if (!response || !Array.isArray(response.chapters))
      throw new Error('A fonte retornou uma página de capítulos inválida.');
    if (!response.chapters.length)
      throw new Error(
        'Esta página não retornou capítulos. Tente novamente; a página não será pulada.',
      );
    const latest = current.current.novels.find((item) => item.id === book.id);
    const chapters = mergeChapters(
      latest.chapters,
      response.chapters,
      book.id,
      nextChapterId(current.current.novels),
      String(page),
    );
    const changed = {
      ...latest,
      chapters: trackUpdates
        ? markNewChapters(latest.chapters, chapters, new Date().toISOString())
        : chapters,
      desktopLoadedPages: [
        ...new Set([...(latest.desktopLoadedPages || [1]), Number(page)]),
      ],
      desktopPage: Number(page),
    };
    changeNovel(changed);
    return changed;
  };
  const navigateChapter = async (offset) => {
    let book = current.current.novels.find((item) => item.id === novelId);
    const step =
      chapterDirection(book).direction === 'descending' ? -offset : offset;
    const active = book.chapters.find((item) => item.id === chapterId);
    let index = book.chapters.findIndex((item) => item.id === chapterId) + step;
    const page = Number(active.page || 1);
    const targetPage = page + step;
    const adjacent = book.chapters[index];
    if (
      (!adjacent || Number(adjacent.page || 1) !== page) &&
      targetPage >= 1 &&
      targetPage <= Number(book.totalPages || 1) &&
      !loadedPages(book).includes(targetPage)
    ) {
      book = await loadNovelPage(book, targetPage);
      index = book.chapters.findIndex((item) => item.id === chapterId) + step;
    }
    if (book.chapters[index]) await loadChapter(book, book.chapters[index]);
    else
      setNotice(
        offset > 0
          ? 'Não há próximo capítulo disponível.'
          : 'Não há capítulo anterior disponível.',
      );
  };
  return { loadNovelPage, navigateChapter };
}
