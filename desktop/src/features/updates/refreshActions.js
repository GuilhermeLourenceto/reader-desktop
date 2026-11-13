// Library/source refresh coordination; the App supplies persistence and UI callbacks.
import { t as translateMessage } from '../../i18n.cjs';
import { loadPlugin, fetchNovel } from '../../sourceClient';
import { errorText } from '../../sourceRuntime';
import { withSourceDeadline } from '../../sourceGuards.cjs';
import { validateNovelDetails, mergeChapters } from '../../domain.cjs';
import { loadedPages, nextChapterId } from '../../libraryState';
import { markNewChapters } from '../../domain/updates.cjs';

export function createRefreshActions({
  current, novel, changeNovel, loadNovelPage, stopUpdates, downloading,
  setUpdatesFailures, setUpdatesProgress, setNotice, update,
}) {
  const refreshNovel = async (book = novel, allPages = false) => {
    const plugin = await loadPlugin(book.pluginId);
    if (!plugin) throw new Error('Fonte não instalada');
    const detail = validateNovelDetails(
      await withSourceDeadline(() => fetchNovel(book.pluginId, book.path)),
    );
    if (!detail || !Array.isArray(detail.chapters))
      throw new Error('A fonte retornou detalhes inválidos para esta obra.');
    const latest = current.current.novels.find((item) => item.id === book.id);
    const chapters = mergeChapters(
      latest.chapters,
      detail.chapters,
      book.id,
      nextChapterId(current.current.novels),
    );
    changeNovel({
      ...latest,
      ...detail,
      name: detail.name || latest.name,
      id: latest.id,
      pluginId: latest.pluginId,
      path: latest.path,
      inLibrary: latest.inLibrary,
      chapters: markNewChapters(
        latest.chapters,
        chapters,
        new Date().toISOString(),
      ),
    });
    let partial = false;
    const pages = allPages
      ? Array.from(
          { length: Number(detail.totalPages || 1) },
          (_, index) => index + 1,
        )
      : [
          ...new Set(
            latest.chapters.map((chapter) => Number(chapter.page || 1)),
          ),
        ];
    for (const page of pages.filter(
      (page) => page > 1 && page <= Number(detail.totalPages || 1),
    )) {
      if (allPages && stopUpdates.current) {
        partial = true;
        break;
      }
      try {
        await loadNovelPage(
          latest,
          page,
          loadedPages(latest).includes(page) ||
            page > Number(latest.totalPages || 1),
        );
      } catch {
        partial = true;
      }
    }
    if (allPages) return { partial };
    setNotice(
      partial
        ? 'Obra atualizada. Algumas páginas falharam; você pode tentar carregá-las novamente.'
        : 'Obra e capítulos atualizados.',
    );
  };
  const refreshLibrary = async () => {
    if (downloading.current)
      throw new Error(
        'Aguarde ou pare os downloads antes de atualizar a biblioteca.',
      );
    const books = current.current.novels.filter((book) => book.inLibrary);
    if (!books.length) return;
    stopUpdates.current = false;
    setUpdatesFailures([]);
    const failures = [];
    try {
      for (let index = 0; index < books.length; index++) {
        if (stopUpdates.current) break;
        const book = books[index];
        setUpdatesProgress({
          done: index,
          total: books.length,
          name: book.name,
        });
        try {
          if ((await refreshNovel(book, true))?.partial)
            failures.push(
              translateMessage('{v0}: algumas páginas não foram verificadas.', {
                v0: book.name,
              }),
            );
        } catch (error) {
          failures.push(`${book.name}: ${errorText(error)}`);
        }
      }
      update({
        ...current.current,
        settings: {
          ...current.current.settings,
          desktopLastLibraryUpdate: new Date().toISOString(),
        },
      });
      setNotice(
        stopUpdates.current
          ? 'Verificação interrompida. Atualizações já encontradas foram mantidas.'
          : failures.length
            ? 'Verificação concluída com avisos.'
            : 'Biblioteca atualizada.',
      );
    } finally {
      setUpdatesFailures(failures);
      setUpdatesProgress(null);
    }
  };
  return { refreshNovel, refreshLibrary };
}
