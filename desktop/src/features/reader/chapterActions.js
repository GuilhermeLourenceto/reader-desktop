import { userMessageForError } from '../../domain/userFacingError.cjs';
// Chapter fetching, offline cache lookup, HTML sanitization and progress transition.
import sanitize from 'sanitize-html';
import { t as translateMessage } from '../../i18n.cjs';
import { fileKey } from '../../state/libraryState';
import { loadPlugin, fetchChapter } from '../../sourceClient';
import { errorText } from '../../sourceRuntime';
import { withSourceDeadline } from '../../sourceGuards.cjs';
import { INSTALLED_PLUGINS_KEY } from '../../../vendor/lnreader/src/plugins/constants';

export function createChapterActions({
  flushProgress, current, chapterLoadId, setReaderError, setChapterLoading,
  restoringScroll, pendingScroll, setHtml, setNovelId, setChapterId, setView,
  setReaderRevision, changeNovel, setNotice,
}) {
  const loadChapter = async (book, item, force = false) => {
    flushProgress();
    book = current.current.novels.find((value) => value.id === book.id) || book;
    item = book.chapters.find((value) => value.id === item.id) || item;
    const loadId = ++chapterLoadId.current;
    setReaderError(null);
    setChapterLoading(true);
    try {
      let content;
      let fetched = false;
      if (!force) {
        try {
          content = await window.desktop.file('tryRead', fileKey(book, item));
        } catch {}
      }
      if (typeof content !== 'string' || !content.trim()) {
        const plugin = await loadPlugin(book.pluginId);
        if (!plugin)
          throw new Error(
            'Este capítulo não está disponível offline e a fonte não está instalada.',
          );
        content = await withSourceDeadline(() =>
          fetchChapter(book.pluginId, item.path),
        );
        fetched = true;
      }
      if (
        typeof content !== 'string' ||
        !content.trim() ||
        content.length > 20 * 1024 * 1024
      )
        throw new Error(
          'A fonte retornou um capítulo vazio. Atualize a fonte ou tente novamente.',
        );
      const document = new DOMParser().parseFromString(content, 'text/html');
      document
        .querySelectorAll('script, style, noscript')
        .forEach((element) => element.remove());
      if (
        !document.body.textContent.trim() &&
        !document.querySelector('img[src]')
      )
        throw new Error(
          'Este capítulo não contém texto ou imagens. Tente novamente ou atualize a fonte.',
        );
      for (const image of document.querySelectorAll('img')) {
        const src = image.getAttribute('src') || '';
        const marker = src.indexOf('/Novels/');
        const key =
          marker >= 0
            ? src.slice(marker + 1)
            : `${fileKey(book, item).replace(/index.html$/, '')}${src}`;
        let stored = current.current.files?.[key];
        if (!stored && src.startsWith('file:')) {
          try {
            stored = await window.desktop.file('readBase64', key);
          } catch {}
        }
        if (stored)
          image.setAttribute('src', `data:image/png;base64,${stored}`);
        else if (src.startsWith('file:')) {
          const original = image.getAttribute('data-original-src');
          if (original && /^https?:\/\//i.test(original))
            image.setAttribute('src', original);
          else image.removeAttribute('src');
        } else if (src && !/^data:/i.test(src)) {
          try {
            if (/^https?:\/\//i.test(src)) image.setAttribute('src', src);
            else {
              const metadata = JSON.parse(
                localStorage.getItem(INSTALLED_PLUGINS_KEY) || '[]',
              ).find((value) => value.id === book.pluginId);
              const site =
                metadata?.site ||
                (await loadPlugin(book.pluginId))?.site ||
                book.path;
              image.setAttribute(
                'src',
                new URL(src, new URL(item.path, site)).href,
              );
            }
          } catch {
            image.removeAttribute('src');
          }
        }
      }
      const rendered = sanitize(document.body.innerHTML, {
        allowedTags: sanitize.defaults.allowedTags.concat([
          'img',
          'h1',
          'h2',
          'del',
          'ins',
          'details',
          'summary',
        ]),
        allowedAttributes: {
          ...sanitize.defaults.allowedAttributes,
          '*': ['lang', 'dir', 'title'],
          img: ['src', 'alt', 'width', 'height'],
        },
        allowedSchemes: ['http', 'https', 'data'],
      });
      if (loadId !== chapterLoadId.current) return;
      let cached = !fetched;
      if (fetched) {
        try {
          await window.desktop.file('write', fileKey(book, item), content);
          cached = true;
        } catch (error) {
          setNotice(
            translateMessage(
              'Capítulo aberto, mas não foi possível salvá-lo offline: {v0}',
              { v0: translateMessage(userMessageForError(error)) },
            ),
          );
        }
      }
      if (loadId !== chapterLoadId.current) return;
      restoringScroll.current = true;
      pendingScroll.current = { loadId, bookId: book.id, item };
      setHtml(rendered);
      setNovelId(book.id);
      setChapterId(item.id);
      setView('reader');
      setReaderRevision((value) => value + 1);
      const latest = current.current.novels.find((n) => n.id === book.id);
      if (!latest) return;
      changeNovel({
        ...latest,
        chapters: latest.chapters.map((c) =>
          c.id === item.id
            ? {
                ...c,
                ...(!current.current.settings.desktopIncognito
                  ? { readTime: new Date().toISOString() }
                  : {}),
                isDownloaded: cached,
                ...(fetched && cached
                  ? { desktopAssetsCached: !document.querySelector('img[src]') }
                  : {}),
              }
            : c,
        ),
      });
    } catch (error) {
      if (loadId === chapterLoadId.current) {
        void window.desktop.diagnostics.report({
          level: 'error', code: 'RDR-CHAPTER-FAILED', operation: 'reader',
          message: errorText(error),
        }).catch(() => {});
        setReaderError({
          bookId: book.id,
          chapterId: item.id,
          force,
          message: translateMessage(userMessageForError(error)),
        });
      }
    } finally {
      if (loadId === chapterLoadId.current) setChapterLoading(false);
    }
  };
  return { loadChapter };
}
