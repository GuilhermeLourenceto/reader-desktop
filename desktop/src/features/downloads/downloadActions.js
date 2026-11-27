import { userMessageForError } from '../../domain/userFacingError.cjs';
// Download orchestration is isolated from the App component.
// Its dependencies are explicit so downloads retain the existing lifecycle and cancellation semantics.
import { t as translateMessage } from '../../i18n.cjs';
import { fileKey } from '../../state/libraryState';
import { errorText } from '../../sourceRuntime';
import { loadPlugin, fetchChapter } from '../../sourceClient';
import { withSourceDeadline } from '../../sourceGuards.cjs';

export function createDownloadActions({
  downloading, cancelDownload, setNotice, setDownloadProgress, changeChapterRows,
}) {
  const deleteDownloads = async (book, ids) => {
    if (downloading.current) {
      setNotice(
        translateMessage('Aguarde ou pare a fila de downloads antes de apagar arquivos.'),
      );
      return;
    }
    if (
      !window.confirm(
        translateMessage('Apagar os arquivos baixados destes capítulos? Eles continuarão na lista e poderão ser baixados novamente.'),
      )
    )
      return;
    // Keep flags consistent even if a later chapter fails to remove.
    for (const id of new Set(ids)) {
      await window.desktop.file(
        'removeTree',
        `Novels/${book.pluginId}/${book.id}/${id}`,
      );
      changeChapterRows(book.id, [id], {
        isDownloaded: false,
        desktopAssetsCached: false,
      });
    }
  };
  const downloadChapters = async (book, ids, preserveCancellation = false) => {
    const chosen = new Set(ids);
    const chapters = book.chapters.filter(
      (chapter) =>
        chosen.has(chapter.id) &&
        (!chapter.isDownloaded || chapter.desktopAssetsCached === false),
    );
    if (!chapters.length) {
      setNotice(translateMessage('Nenhum capítulo pendente de download nesta seleção.'));
      return;
    }
    if (!preserveCancellation) cancelDownload.current = false;
    const failures = [];
    try {
      setDownloadProgress({
        novelId: book.id,
        chapterId: null,
        index: 0,
        total: chapters.length,
        name: book.name,
        phase: 'source',
      });
      const plugin = await loadPlugin(book.pluginId);
      for (let index = 0; index < chapters.length; index++) {
        if (cancelDownload.current) break;
        const chapter = chapters[index];
        setDownloadProgress({
          novelId: book.id,
          chapterId: chapter.id,
          index: index + 1,
          total: chapters.length,
          name: chapter.name,
          phase: 'content',
        });
        try {
          let content = await window.desktop.file(
            'tryRead',
            fileKey(book, chapter),
          );
          if (!content) {
            if (!plugin) throw new Error('Fonte não instalada');
            content = await withSourceDeadline(() =>
              fetchChapter(book.pluginId, chapter.path),
            );
          }
          if (
            typeof content !== 'string' ||
            !content.trim() ||
            content.length > 20 * 1024 * 1024
          )
            throw new Error('Capítulo vazio');
          const doc = new DOMParser().parseFromString(content, 'text/html');
          doc
            .querySelectorAll('script, style, noscript')
            .forEach((element) => element.remove());
          if (!doc.body.textContent.trim() && !doc.querySelector('img[src]'))
            throw new Error('Capítulo sem conteúdo');
          let imageFailures = 0;
          const images = [...doc.querySelectorAll('img[src]')];
          setDownloadProgress((progress) =>
            progress?.novelId === book.id && progress.chapterId === chapter.id
              ? {
                  ...progress,
                  phase: 'images',
                  imageIndex: 0,
                  imageTotal: images.length,
                }
              : progress,
          );
          for (const [imageIndex, image] of images.entries()) {
            try {
              let src = image.getAttribute('src');
              if (/^file:/i.test(src)) {
                const prefix = fileKey(book, chapter).replace(/index\.html$/, '');
                const marker = src.indexOf('/Novels/');
                const localKey = marker >= 0 ? src.slice(marker + 1) : '';
                let valid = false;
                if (localKey.startsWith(prefix)) {
                  try { valid = !!(await window.desktop.file('readBase64', localKey)); }
                  catch { /* Missing or corrupt blob: retry the original image. */ }
                }
                if (valid) continue;
                const original = image.getAttribute('data-original-src');
                if (!original || !/^https?:\/\//i.test(original)) {
                  imageFailures++;
                  continue;
                }
                src = original;
              }
              if (!/^data:/i.test(src)) {
                try {
                  const url = /^https?:\/\//i.test(src)
                    ? new URL(src).href
                    : new URL(
                        src,
                        new URL(chapter.path, plugin?.site || book.path),
                      ).href;
                  const response = await fetch(url, plugin?.imageRequestInit);
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  const imagePath = fileKey(book, chapter).replace(
                    'index.html',
                    `${imageIndex}.b64.png`,
                  );
                  await window.desktop.file(
                    'writeBase64',
                    imagePath,
                    Buffer.from(await response.arrayBuffer()).toString(
                      'base64',
                    ),
                  );
                  image.setAttribute('src', `file:///${imagePath}`);
                  image.setAttribute('data-original-src', url);
                } catch {
                  imageFailures++;
                }
              }
            } finally {
              setDownloadProgress((progress) =>
                progress?.novelId === book.id &&
                progress.chapterId === chapter.id
                  ? { ...progress, imageIndex: imageIndex + 1 }
                  : progress,
              );
            }
          }
          await window.desktop.file(
            'write',
            fileKey(book, chapter),
            doc.body.innerHTML,
          );
          changeChapterRows(book.id, [chapter.id], {
            isDownloaded: true,
            desktopAssetsCached: imageFailures === 0,
          });
          if (imageFailures)
            failures.push(
              translateMessage('{v0}: {v1} imagem(ns) não baixada(s)', {
                v0: chapter.name,
                v1: imageFailures,
              }),
            );
        } catch (error) {
          void window.desktop.diagnostics.report({
            level: 'error', code: 'RDR-DOWNLOAD-FAILED', operation: 'reader',
            message: errorText(error),
          }).catch(() => {});
          failures.push(`${chapter.name}: ${translateMessage(userMessageForError(error))}`);
        }
      }
      setNotice(
        failures.length
          ? translateMessage('Download concluído com avisos: {v0}', {
              v0: failures.join('; '),
            })
          : cancelDownload.current
            ? translateMessage('Downloads interrompidos após o capítulo atual.')
            : translateMessage('Downloads concluídos.'),
      );
    } finally {
      setDownloadProgress(null);
    }
  };
  const startDownloads = async (book, ids) => {
    if (downloading.current) {
      setNotice(
        translateMessage('Já há um download em andamento. Aguarde ou pare a fila atual.'),
      );
      return;
    }
    downloading.current = true;
    try {
      await downloadChapters(book, ids);
    } catch (error) {
      void window.desktop.diagnostics.report({
        level: 'error', code: 'RDR-DOWNLOAD-FAILED', operation: 'reader',
        message: errorText(error),
      }).catch(() => {});
      setNotice(translateMessage(userMessageForError(error)));
    } finally {
      downloading.current = false;
    }
  };
  return { deleteDownloads, downloadChapters, startDownloads };
}
