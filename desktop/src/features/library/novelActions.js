// Operations that change novel metadata, reading history and chapter flags.
// Dependencies are injected by App so these actions remain independent of JSX.
import { loadPlugin, fetchNovel } from '../../sourceClient';
import { withSourceDeadline } from '../../sourceGuards.cjs';
import { nextId, nextChapterId } from '../../state/libraryState';
import { validateNovelDetails, mergeChapters } from '../../domain.cjs';

export function createNovelActions({ current, update, pendingProgress, progressTimer, setNovelId, setView }) {
  const openNovel = async (item, pluginId) => {
    const existing = current.current.novels.find(
      (n) => n.path === item.path && n.pluginId === pluginId,
    );
    if (existing) {
      setNovelId(existing.id);
      setView('novel');
      return;
    }
    const plugin = await loadPlugin(pluginId);
    if (!plugin) throw new Error('Fonte não instalada');
    const detail = validateNovelDetails(
      await withSourceDeadline(() => fetchNovel(pluginId, item.path)),
    );
    if (!detail || !Array.isArray(detail.chapters))
      throw new Error(
        'A fonte não retornou os detalhes desta obra. Atualize o plugin e tente novamente.',
      );
    const id = nextId(current.current.novels);
    const firstChapterId = nextChapterId(current.current.novels);
    const alreadyOpened = current.current.novels.find(
      (book) => book.path === item.path && book.pluginId === pluginId,
    );
    if (alreadyOpened) {
      setNovelId(alreadyOpened.id);
      setView('novel');
      return;
    }
    const created = {
      ...detail,
      name: detail.name || item.name,
      cover: detail.cover || item.cover,
      id,
      pluginId,
      path: item.path,
      inLibrary: false,
      chapters: mergeChapters([], detail.chapters, id, firstChapterId),
    };
    update({
      ...current.current,
      novels: [...current.current.novels, created],
    });
    setNovelId(id);
    setView('novel');
  };
  const changeNovel = (changed) =>
    update({
      ...current.current,
      novels: current.current.novels.map((n) =>
        n.id === changed.id ? changed : n,
      ),
    });
  const changeChapterRows = (bookId, ids, patch) => {
    if (
      pendingProgress.current?.bookId === bookId &&
      ids.includes(pendingProgress.current.itemId)
    ) {
      pendingProgress.current = null;
      clearTimeout(progressTimer.current);
    }
    const book = current.current.novels.find((item) => item.id === bookId);
    const chosen = new Set(ids);
    if (book)
      changeNovel({
        ...book,
        chapters: book.chapters.map((chapter) =>
          chosen.has(chapter.id) ? { ...chapter, ...patch } : chapter,
        ),
      });
  };
  const removeHistory = (entries) => {
    const chosen = new Set(
      entries.map((entry) => `${entry.novelId}:${entry.chapterId}`),
    );
    update({
      ...current.current,
      novels: current.current.novels.map((book) => ({
        ...book,
        chapters: book.chapters.map((chapter) =>
          chosen.has(`${book.id}:${chapter.id}`)
            ? { ...chapter, readTime: null }
            : chapter,
        ),
      })),
    });
  };
  return { openNovel, changeNovel, changeChapterRows, removeHistory };
}
