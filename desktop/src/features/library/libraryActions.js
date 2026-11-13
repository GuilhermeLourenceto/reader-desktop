// Multi-book actions and batch downloads without UI rendering code.
import { t as translateMessage } from '../../i18n.cjs';

export function createLibraryActions({
  current, update, downloading, cancelDownload, setNotice, downloadChapters,
}) {
  const libraryAction = async (action, ids) => {
    const books = current.current.novels.filter(
      (book) => ids.includes(book.id) && book.inLibrary,
    );
    if (!books.length) return;
    if (action === 'remove') {
      if (
        !window.confirm(
          translateMessage(
            'Remover {v0} obra(s) da biblioteca? Histórico e downloads serão mantidos.',
            { v0: books.length },
          ),
        )
      )
        return;
      update({
        ...current.current,
        novels: current.current.novels.map((book) =>
          ids.includes(book.id) ? { ...book, inLibrary: false } : book,
        ),
      });
    } else if (action === 'reset') {
      if (
        !window.confirm(
          translateMessage(
            'Resetar a leitura de {v0} obra(s)? O progresso e o histórico serão zerados e os capítulos ficarão não lidos. Downloads e marcadores serão mantidos.',
            { v0: books.length },
          ),
        )
      )
        return;
      update({
        ...current.current,
        novels: current.current.novels.map((book) =>
          ids.includes(book.id)
            ? {
                ...book,
                chapters: book.chapters.map((chapter) => ({
                  ...chapter,
                  unread: true,
                  progress: 0,
                  desktopProgressUnit: 'percent',
                  readTime: null,
                })),
              }
            : book,
        ),
      });
    } else if (action === 'download') {
      if (downloading.current) {
        setNotice(
          'Já há um download em andamento. Aguarde ou pare a fila atual.',
        );
        return;
      }
      downloading.current = true;
      cancelDownload.current = false;
      try {
        for (const book of books) {
          if (cancelDownload.current) break;
          await downloadChapters(
            book,
            book.chapters
              .filter(
                (chapter) =>
                  !chapter.isDownloaded ||
                  chapter.desktopAssetsCached === false,
              )
              .map((chapter) => chapter.id),
            true,
          );
        }
      } catch (error) {
        setNotice(errorText(error));
      } finally {
        downloading.current = false;
      }
    }
  };
  return { libraryAction };
}
