import { t as translateMessage } from './i18n.cjs';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createRoot } from 'react-dom/client';
import Icon from './Icon';
import { getLocale, setLocale, subscribe } from './i18n.cjs';
import DesktopErrorBoundary from './DesktopErrorBoundary';
import {
  hydrate,
  snapshot,
  nextId,
  nextChapterId,
  fileKey,
  loadedPages,
  nextNovelPage,
} from './libraryState';
import { errorText, fetchSourcePage } from './sourceRuntime';
import sanitize from 'sanitize-html';
import {
  loadPlugin,
  reloadInstalledPlugins,
  fetchNovel,
  fetchPage,
  fetchChapter,
  cancelSourceOperations,
} from './sourceClient';
import { initializeDesktopPlugins as initializeInstalledPlugins } from './sources';
import { withSourceDeadline, validateFilters } from './sourceGuards.cjs';
import { INSTALLED_PLUGINS_KEY } from '../vendor/lnreader/src/plugins/constants';
import { defaultTheme } from '../vendor/lnreader/src/theme/md3/defaultTheme';
import Settings from './features/settings/Settings';
import Onboarding from './Onboarding';
import { restoreDesktopDefaults } from './defaultSettings.cjs';
import Spinner from './Spinner';
import { appTheme } from './appThemes';
import { resolveAppearance, appearanceColors } from './appearance.cjs';
import NovelDetails from './features/library/NovelDetails';
import History from './features/history/History';
import SourceViews from './features/sources/SourceViews';
import Updates from './features/updates/Updates';
import { markNewChapters } from './updates.cjs';
import ReaderControls from './features/reader/ReaderControls';
import ReaderText, { readerPresentation } from './features/reader/ReaderText';
import BookGrid from './features/library/BookGrid';
import Library from './features/library/Library';
import { getErrorChainMessages } from '../vendor/lnreader/src/utils/error';
import {
  validateSourceItems,
  mergeChapters,
  chapterPercent,
  recordProgress,
  chapterOrdinals,
  chapterReleaseLabel,
  chapterDirection,
  readingChapters,
  validateNovelDetails,
} from './domain.cjs';
import { readerProgress, pageAmplitude } from './readerPaging.cjs';
import { readerHideDelayMilliseconds } from './readerChromeDelay.cjs';
import { installElectronFetch } from './services/installElectronFetch';
import { createDownloadActions } from './features/downloads/downloadActions';

// As paletas do app misturam `rgb(...)`, `#RRGGBB` e `rgba(...)`.
const isColor = (value) =>
  typeof value === 'string' && /^(rgb|rgba|#|hsl|color-mix)/i.test(value);

for (const [key, value] of Object.entries(defaultTheme.dark)) {
  if (isColor(value)) {
    document.documentElement.style.setProperty(`--${key}`, value);
  }
}

// Keep the original source runtime's Response/Blob/FileReader behavior, while
// HTTP runs through Electron's cookie-aware session without browser CORS limits.
let closing = false;
installElectronFetch(() => closing);

function App() {
  useSyncExternalStore(subscribe, getLocale);
  const [state, setState] = useState(null);
  const current = useRef(null);
  const [view, setView] = useState('library');
  const [busy, setBusy] = useState(false);
  const [sourceWorking, setSourceWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [lastDiagnostic, setLastDiagnostic] = useState(null);
  const [diagnosticsRequest, setDiagnosticsRequest] = useState(0);
  const [available, setAvailable] = useState([]);
  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('all');
  const [novelQuery, setNovelQuery] = useState('');
  const [sourceMode, setSourceMode] = useState('search');
  const [repo, setRepo] = useState('');
  const [source, setSource] = useState(null);
  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState('');
  const [sourceOptions, setSourceOptions] = useState({
    showLatestNovels: false,
    filters: undefined,
  });
  const [sourceFilters, setSourceFilters] = useState({});
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [readerError, setReaderError] = useState(null);
  const chapterLoadId = useRef(0);
  const restoringScroll = useRef(false);
  const pendingScroll = useRef(null);
  const [readerRevision, setReaderRevision] = useState(0);
  const [readerControls, setReaderControls] = useState(false);
  const readerControlsOpen = useRef(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeVisibleRef = useRef(true);
  chromeVisibleRef.current = chromeVisible;
  const chromeTimer = useRef(null);
  const lastReveal = useRef(0);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [viewer, setViewer] = useState({ progress: 0, page: 1, total: 1 });
  const layoutPosition = useRef(null);
  const readerJump = useRef(null);
  const stopReaderJump = () => {
    const jump = readerJump.current;
    readerJump.current = null;
    if (jump)
      jump.element.scrollTo({
        top: jump.element.scrollTop,
        behavior: 'instant',
      });
  };
  const restoreFrame = useRef(null);
  const chromePinned = useRef(false);
  const [appVersion, setAppVersion] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [updatesProgress, setUpdatesProgress] = useState(null);
  const [updatesFailures, setUpdatesFailures] = useState([]);
  const stopUpdates = useRef(false);
  const cancelDownload = useRef(false);
  const downloading = useRef(false);
  const browseSession = useRef(null);
  const browseMarker = useRef(null);
  const mainRef = useRef(null);
  // In desktop windows wider than the centered content column, scrolling at
  // the left/right edges should still move the novels list. Native scrolling
  // inside <main> and nested scroll containers is deliberately untouched.
  useEffect(() => {
    if (view !== 'browse' && view !== 'sources') return;
    const handleOuterWheel = (event) => {
      const main = mainRef.current;
      if (!main || main.contains(event.target) || event.ctrlKey || !event.deltaY)
        return;
      if (main.scrollHeight <= main.clientHeight) return;
      const scale = event.deltaMode === 1 ? 16 :
        event.deltaMode === 2 ? main.clientHeight : 1;
      event.preventDefault();
      main.scrollTop += event.deltaY * scale;
    };
    window.addEventListener('wheel', handleOuterWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleOuterWheel);
  }, [view]);
  const [novelId, setNovelId] = useState(null);
  const [chapterId, setChapterId] = useState(null);
  const [html, setHtml] = useState('');
  const readerRef = useRef(null);
  const saveTimer = useRef(null);
  const activeTasks = useRef(0);
  const progressTimer = useRef(null);
  const pendingProgress = useRef(null);
  const novel = state?.novels.find((item) => item.id === novelId);
  const chapter = novel?.chapters.find((item) => item.id === chapterId);
  const fontSize = state?.settings?.desktopFontSize || 21;
  const preferences = state?.settings || {};
  const presentation = readerPresentation(preferences);
  const paged = preferences.desktopPagination === 'pages';

  const clearChromeTimer = () => {
    clearTimeout(chromeTimer.current);
    chromeTimer.current = null;
  };
  const hideChromeSoon = () => {
    clearChromeTimer();
    const settingsNow = current.current?.settings || {};
    if (
      settingsNow.desktopReaderAutoHide === false ||
      readerControlsOpen.current ||
      chromePinned.current
    )
      return;
    chromeTimer.current = setTimeout(() => {
      chromeTimer.current = null;
      if (
        readerControlsOpen.current ||
        chromePinned.current ||
        current.current?.settings.desktopReaderAutoHide === false
      )
        return;
      if (
        document.activeElement?.closest(
          '.reader-view > header, .reader-view > footer',
        )
      )
        readerRef.current?.focus({ preventScroll: true });
      setChromeVisible(false);
    }, readerHideDelayMilliseconds(settingsNow.desktopReaderHideDelay));
  };
  const revealChrome = () => {
    setChromeVisible(true);
    const now = Date.now();
    if (now - lastReveal.current < 300) return;
    lastReveal.current = now;
    hideChromeSoon();
  };
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const { dark, mode } = resolveAppearance(preferences.desktopTheme, media.matches);
      const palette = appTheme(preferences.desktopPalette, dark);
      const colors = appearanceColors(palette, preferences.desktopPalette, mode);
      for (const [key, value] of Object.entries(colors)) {
        if (isColor(value))
          document.documentElement.style.setProperty(`--${key}`, value);
      }
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      document.documentElement.dataset.appTheme = mode;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences.desktopTheme, preferences.desktopPalette]);
  const update = (next) => {
    current.current = next;
    setState(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () =>
        window.desktop
          .save(snapshot(current.current))
          .catch((error) => setNotice(error.message)),
      300,
    );
  };
  const run = async (task) => {
    activeTasks.current++;
    setBusy(true);
    setNotice('');
    setLastDiagnostic(null);
    try {
      await task();
    } catch (error) {
      const message = errorText(error);
      setNotice(message);
      void window.desktop.diagnostics.report({
        level: 'error', code: 'UI-ACTION-FAILED', operation: 'interface', message,
      }).then(result => {
        if (result) setLastDiagnostic({ message, ...result });
      }).catch(() => {});
    } finally {
      activeTasks.current--;
      setBusy(activeTasks.current > 0);
    }
  };
  useEffect(() => {
    const onNotice = (event) => setNotice(String(event.detail));
    const onSourceActivity = (event) => setSourceWorking(Boolean(event.detail));
    const onStorage = () => {
      if (current.current) update({ ...current.current });
    };
    window.addEventListener('notice', onNotice);
    window.addEventListener('source-activity', onSourceActivity);
    window.addEventListener('plugin-storage-change', onStorage);
    run(async () => {
      const loaded = await window.desktop.load({ metadataOnly: true });
      hydrate(loaded);
      current.current = loaded;
      setState(loaded);
      setLocale(loaded.settings?.desktopInterfaceLanguage);
      await initializeInstalledPlugins();
    });
    const stopCloseListener = window.desktop.onBeforeClose(async () => {
      if (closing) return;
      closing = true;
      try {
        cancelDownload.current = true;
        stopUpdates.current = true;
        cancelSourceOperations();
        await window.desktop.cancelRequests();
        const deadline = Date.now() + 2000;
        while (downloading.current && Date.now() < deadline)
          await new Promise((resolve) => setTimeout(resolve, 25));
        flushProgress();
        clearTimeout(saveTimer.current);
        if (current.current)
          await window.desktop.save(snapshot(current.current));
        window.desktop.finishClose();
      } catch (error) {
        closing = false;
        setNotice(
          translateMessage('Não foi possível salvar antes de fechar: {v0}', {
            v0: error.message,
          }),
        );
      }
    });
    return () => {
      window.removeEventListener('notice', onNotice);
      window.removeEventListener('source-activity', onSourceActivity);
      window.removeEventListener('plugin-storage-change', onStorage);
      stopCloseListener();
      clearTimeout(saveTimer.current);
      clearTimeout(progressTimer.current);
      clearChromeTimer();
      cancelAnimationFrame(restoreFrame.current);
    };
  }, []);
  useEffect(() => {
    if (window.desktop.info)
      window.desktop
        .info()
        .then((info) => setAppVersion(info.version))
        .catch(() => {});
  }, []);
  useEffect(() => {
    readerControlsOpen.current = readerControls;
    if (readerControls) {
      clearChromeTimer();
      setChromeVisible(true);
      return;
    }
    if (view === 'reader') hideChromeSoon();
  }, [readerControls, view, preferences.desktopReaderHideDelay]);
  useLayoutEffect(() => {
    if (view !== 'reader') {
      chromePinned.current = false;
      clearChromeTimer();
      setChromeVisible(true);
      return undefined;
    }
    clearChromeTimer();
    chromePinned.current = false;
    readerControlsOpen.current = false;
    setReaderControls(false);
    setChromeVisible(preferences.desktopReaderAutoHide === false);
    return clearChromeTimer;
  }, [view, chapterId, preferences.desktopReaderAutoHide]);
  const persistNow = async () => {
    clearTimeout(saveTimer.current);
    await window.desktop.save(snapshot(current.current));
  };
  useLayoutEffect(() => {
    const container = readerRef.current?.closest('.reader-view');
    const header = container?.querySelector('header');
    if (!header) return;
    const measure = () =>
      container.style.setProperty(
        '--readerHeaderHeight',
        `${header.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [view]);
  const browse = async (pluginId, term = '', options) => {
    const session = {
      pluginId,
      term: term.trim(),
      page: 0,
      items: [],
      pending: true,
      hasMore: true,
      options: options || { showLatestNovels: false, filters: undefined },
    };
    browseSession.current = session;
    setLoadingMore(false);
    setPageError('');
    setHasMore(true);
    setResults([]);
    setSource(pluginId);
    setNovelQuery(session.term);
    setView('browse');
    setSourceOptions(session.options);
    requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0 }));
    try {
      const plugin = await loadPlugin(pluginId);
      if (browseSession.current !== session) return;
      setSourceFilters(validateFilters(plugin?.filters));
      const response = await fetchSourcePage(
        pluginId,
        session.term,
        1,
        session.options,
      );
      if (browseSession.current !== session) return;
      const items = [
        ...new Map(response.map((item) => [item.path, item])).values(),
      ];
      session.items = items;
      session.page = 1;
      session.pending = false;
      session.hasMore = items.length > 0;
      setResults(items);
      setHasMore(session.hasMore);
    } catch (error) {
      if (browseSession.current === session) setPageError(errorText(error));
    } finally {
      if (browseSession.current === session) session.pending = false;
    }
  };
  const loadMore = useCallback(async () => {
    const session = browseSession.current;
    if (!session || session.pending || !session.hasMore) return;
    session.pending = true;
    setLoadingMore(true);
    setPageError('');
    try {
      const response = await fetchSourcePage(
        session.pluginId,
        session.term,
        session.page + 1,
        session.options,
      );
      if (browseSession.current !== session) return;
      const seen = new Set(session.items.map((item) => item.path));
      const additions = response.filter((item) => {
        if (seen.has(item.path)) return false;
        seen.add(item.path);
        return true;
      });
      session.page++;
      session.items = [...session.items, ...additions];
      session.hasMore = response.length > 0;
      if (response.length && !additions.length)
        setPageError(
          'A fonte repetiu uma página sem novos resultados. Tente novamente para consultar a próxima página.',
        );
      setResults(session.items);
      setHasMore(session.hasMore);
    } catch (error) {
      if (browseSession.current === session) setPageError(errorText(error));
    } finally {
      if (browseSession.current === session) {
        session.pending = false;
        setLoadingMore(false);
      }
    }
  }, []);
  useEffect(() => {
    if (
      view !== 'browse' ||
      busy ||
      loadingMore ||
      pageError ||
      !hasMore ||
      !browseMarker.current
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { root: mainRef.current, rootMargin: '0px 0px 280px 0px' },
    );
    observer.observe(browseMarker.current);
    return () => observer.disconnect();
  }, [view, busy, loadingMore, pageError, hasMore, results.length, loadMore]);
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
  const { deleteDownloads, downloadChapters, startDownloads } = createDownloadActions({
    downloading, cancelDownload, setNotice, setDownloadProgress, changeChapterRows,
  });
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
  const saveReaderProgress = (bookId, itemId, percentage) => {
    if (current.current.settings.desktopIncognito) return;
    const latest = current.current.novels.find((book) => book.id === bookId);
    if (!latest) return;
    const previous = latest.chapters.find((item) => item.id === itemId);
    if (
      !previous ||
      (Math.abs(chapterPercent(previous) - percentage) < 0.1 &&
        (percentage < 97 || previous.unread === false))
    )
      return;
    changeNovel({
      ...latest,
      chapters: latest.chapters.map((item) =>
        item.id === itemId ? recordProgress(item, percentage) : item,
      ),
    });
  };
  function flushProgress() {
    clearTimeout(progressTimer.current);
    progressTimer.current = null;
    const pending = pendingProgress.current;
    pendingProgress.current = null;
    if (pending)
      saveReaderProgress(pending.bookId, pending.itemId, pending.percentage);
  }
  useEffect(() => {
    if (view !== 'reader') flushProgress();
    if (view !== 'browse') {
      browseSession.current = null;
      setResults([]);
      setHasMore(false);
    }
    if (view !== 'reader') setHtml('');
  }, [view]);
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
              { v0: errorText(error) },
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
          message: errorText(error),
        });
      }
    } finally {
      if (loadId === chapterLoadId.current) setChapterLoading(false);
    }
  };
  const onReaderLayout = useCallback(() => {
    const element = readerRef.current;
    if (!element || element.clientHeight < 1) return;

    const pending = pendingScroll.current;
    if (pending && pending.loadId !== chapterLoadId.current) return;
    const previous = pending
      ? {
          bookId: pending.bookId,
          itemId: pending.item.id,
          progress: chapterPercent(pending.item),
        }
      : layoutPosition.current;
    if (!previous) return;
    const horizontal = element.classList.contains('paged');
    const max = Math.max(
      0,
      horizontal
        ? element.scrollWidth - element.clientWidth
        : element.scrollHeight - element.clientHeight,
    );
    const position = horizontal
      ? Math.round(
          ((previous.progress / 100) * max) / Math.max(1, element.clientWidth),
        ) * element.clientWidth
      : (previous.progress / 100) * max;
    restoringScroll.current = true;
    if (horizontal) element.scrollLeft = position;
    else element.scrollTop = position;
    pendingScroll.current = null;
    layoutPosition.current = previous;
    const total = horizontal
      ? Math.max(
          1,
          Math.round(element.scrollWidth / Math.max(1, element.clientWidth)),
        )
      : 1;
    setViewer({
      progress: max ? (100 * position) / max : 100,
      page: horizontal
        ? Math.round(position / Math.max(1, element.clientWidth)) + 1
        : 1,
      total,
    });
    cancelAnimationFrame(restoreFrame.current);
    restoreFrame.current = requestAnimationFrame(() => {
      restoringScroll.current = false;
    });
    if (
      pending &&
      max <= 0 &&
      document.fonts.status === 'loaded' &&
      [...element.querySelectorAll('img')].every(
        (image) => image.complete && image.naturalHeight > 0,
      )
    )
      saveReaderProgress(previous.bookId, previous.itemId, 100);
  }, []);
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
  const readerMetrics = () => {
    const element = readerRef.current;
    if (!element) return null;
    return {
      element,
      ...readerProgress({
        paged,
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }),
    };
  };
  const stepReader = async (direction) => {
    const metrics = readerMetrics();
    if (!metrics) return;
    const settingsNow = current.current.settings || {};
    const step = paged
      ? metrics.element.clientWidth
      : metrics.element.clientHeight *
        pageAmplitude(settingsNow.desktopPageStep);
    if (paged)
      metrics.element.scrollTo({
        left: Math.max(
          0,
          Math.min(
            metrics.max,
            (Math.round(metrics.element.scrollLeft / step) + direction) * step,
          ),
        ),
        behavior: 'instant',
      });
    else {
      const previous = readerJump.current;
      const base =
        previous?.element === metrics.element &&
        previous.direction === direction
          ? previous.target
          : metrics.element.scrollTop;
      const target = Math.max(
        0,
        Math.min(metrics.max, base + direction * step),
      );
      readerJump.current = { element: metrics.element, direction, target };
      metrics.element.scrollTo({
        top: target,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    }
  };
  useEffect(() => {
    if (view !== 'reader') return undefined;
    let lastRepeatedStep = 0;
    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (event.key === 'Tab') {
        if (!chromeVisibleRef.current) {
          event.preventDefault();
          requestAnimationFrame(() =>
            readerRef.current
              ?.closest('.reader-view')
              ?.querySelector(
                event.shiftKey ? 'footer button:last-of-type' : 'header button',
              )
              ?.focus(),
          );
        }
        revealChrome();
        return;
      }
      if (
        target instanceof HTMLElement &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], .reader-controls, [role="dialog"]',
        ) &&
        event.key !== 'Escape'
      )
        return;
      const element = readerRef.current;
      if (!element) return;
      const steps = {
        ArrowDown: 1,
        ArrowRight: 1,
        PageDown: 1,
        ' ': 1,
        ArrowUp: -1,
        ArrowLeft: -1,
        PageUp: -1,
      };
      if (Object.hasOwn(steps, event.key)) {
        if (
          event.key === ' ' &&
          target instanceof HTMLElement &&
          target.closest('button')
        )
          return;
        event.preventDefault();
        if (event.repeat && performance.now() - lastRepeatedStep < 150) return;
        lastRepeatedStep = performance.now();
        void stepReader(
          event.key === ' ' && event.shiftKey ? -1 : steps[event.key],
        );
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();

        const end = event.key === 'End';
        element.scrollTo({
          [paged ? 'left' : 'top']: end
            ? paged
              ? element.scrollWidth
              : element.scrollHeight
            : 0,
          behavior: 'smooth',
        });
        return;
      }
      if (event.key === 'Escape') {
        setReaderControls(false);
        clearChromeTimer();
        setChromeVisible(false);
        readerRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, chapterId, paged]);
  useEffect(() => {
    const element = readerRef.current;
    if (view !== 'reader' || !element) return;
    if (!paged) {
      const finish = () => {
        readerJump.current = null;
      };
      element.addEventListener('scrollend', finish);
      element.addEventListener('wheel', stopReaderJump, { passive: true });
      return () => {
        element.removeEventListener('scrollend', finish);
        element.removeEventListener('wheel', stopReaderJump);
        readerJump.current = null;
      };
    }
    let last = 0;
    const wheel = (event) => {
      if (event.ctrlKey) return;
      const distance =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!distance) return;
      event.preventDefault();
      if (Date.now() - last < 180) return;
      last = Date.now();
      void stepReader(Math.sign(distance));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [view, chapterId, paged]);
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
  const restore = async () => {
    if (downloading.current) {
      setNotice(
        'Aguarde ou pare a fila de downloads antes de restaurar um backup.',
      );
      return;
    }
    cancelSourceOperations();
    browseSession.current = null;
    await persistNow();
    const restored = await window.desktop.restore();
    if (!restored) return;
    if (restored.unchanged) {
      setNotice(translateMessage('Backup restaurado.'));
      return;
    }
    hydrate(restored);
    update(restored);
    const missing = await reloadInstalledPlugins();
    setView('library');
    setNovelId(null);
    setNotice(
      missing.length
        ? translateMessage(
            'Backup restaurado. Fontes sem código no backup: {v0}. Reinstale-as em Fontes.',
            { v0: missing.join(', ') },
          )
        : 'Backup restaurado.',
    );
    // Keep metadata even when a source bundle is missing, so it can be reinstalled.
    localStorage.setItem(
      INSTALLED_PLUGINS_KEY,
      JSON.stringify(restored.plugins),
    );
    await persistNow();
  };
  if (!state)
    return (
      <div className="loading">
        <Spinner label="Carregando Reader Desktop" />
        <p>Carregando Reader Desktop…</p>
        {notice && <p className="loading-note">{notice}</p>}
      </div>
    );
  if (state.settings?.desktopOnboardingCompleted === false) {
    return <Onboarding
      settings={preferences}
      onChange={changes => {
        if (changes.desktopInterfaceLanguage) setLocale(changes.desktopInterfaceLanguage);
        update({ ...current.current, settings: { ...current.current.settings, ...changes } });
      }}
      onChooseFolder={() => window.desktop.chooseBackupDirectory()}
      onRestore={() => run(restore)}
      onFinish={async () => {
        const next = { ...current.current, settings: {
          ...current.current.settings,
          desktopOnboardingCompleted: true,
        } };
        clearTimeout(saveTimer.current);
        await window.desktop.save(snapshot(next));
        current.current = next;
        setState(next);
      }}
    />;
  }
  const installed = JSON.parse(
    localStorage.getItem(INSTALLED_PLUGINS_KEY) || '[]',
  );
  const cover = (item) => {
    const name = [
      `Covers/${item.id}`,
      `Novels/${item.pluginId}/${item.id}/cover.png`,
    ].find((key) => state.files?.[key]);
    const local = name && state.files[name];
    if (local)
      return local.startsWith('@file:')
        ? `lnreader://app/asset?name=${encodeURIComponent(
            name,
          )}&v=${local.slice(6)}`
        : `data:image/png;base64,${local}`;
    return /^https?:\/\//.test(item.cover || '') ? item.cover : undefined;
  };
  const cards = (items, pluginId) => (
    <BookGrid
      items={items}
      pluginId={pluginId}
      settings={preferences}
      cover={cover}
      Icon={Icon}
      busy={busy}
      onOpen={(item, sourceId) => run(() => openNovel(item, sourceId))}
    />
  );
  return (
    <div className={`app view-${view}`}>
      <aside>
        <nav aria-label="Navegação principal">
          {[
            ['library', 'Biblioteca'],
            ['updates', 'Atualizações'],
            ['history', 'Histórico'],
            ['sources', 'Fontes'],
            ['settings', 'Mais'],
          ].map(([key, label]) => (
            <button
              key={key}
              disabled={busy}
              className={
                view === key ||
                (key === 'sources' && view === 'browse') ||
                (key === 'library' && view === 'novel')
                  ? 'active'
                  : ''
              }
              aria-current={
                view === key ||
                (key === 'sources' && view === 'browse') ||
                (key === 'library' && view === 'novel')
                  ? 'page'
                  : undefined
              }
              onClick={() => {
                setSourceQuery('');
                setView(key);
              }}
            >
              <span className="nav-icon">
                <Icon name={key} />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main ref={mainRef}>
        {readerError && (
          <div className="reader-error" role="alert">
            <p>{readerError.message}</p>
            <button
              disabled={busy}
              onClick={() =>
                run(() => {
                  const book = current.current.novels.find(
                    (item) => item.id === readerError.bookId,
                  );
                  const item = book?.chapters.find(
                    (item) => item.id === readerError.chapterId,
                  );
                  if (book && item)
                    return loadChapter(book, item, readerError.force);
                })
              }
            >
              Tentar capítulo novamente
            </button>
            <button onClick={() => setReaderError(null)}>Fechar</button>
          </div>
        )}
        {(busy || downloadProgress) &&
          !(view === 'updates' && updatesProgress && !downloadProgress) && (
          <div className="busy" role="status">
            {busy && sourceWorking && (
              <button
                onClick={() => {
                  cancelDownload.current = true;
                  stopUpdates.current = true;
                  cancelSourceOperations();
                }}
              >
                Cancelar operação
              </button>
            )}
            <span className="spinner" aria-hidden="true" />
            {downloadProgress
              ? downloadProgress.index === 0
                ? translateMessage('Preparando downloads de {v0}…', {
                    v0: downloadProgress.name,
                  })
                : translateMessage('Baixando {v0}/{v1}: {v2}', {
                    v0: downloadProgress.index,
                    v1: downloadProgress.total,
                    v2: downloadProgress.name,
                  })
              : 'Processando…'}
            {downloadProgress && (
              <button
                onClick={() => {
                  cancelDownload.current = true;
                }}
              >
                Parar após este capítulo
              </button>
            )}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
            {lastDiagnostic?.message === notice && (
              <button onClick={() => {
                setView('settings');
                setDiagnosticsRequest(value => value + 1);
              }}>Ver diagnóstico ({lastDiagnostic.code})</button>
            )}
            <button onClick={() => setNotice('')} aria-label="Fechar aviso">
              ×
            </button>
          </div>
        )}
        {view === 'library' && (
          <Library
            scrollContainerRef={mainRef}
            novels={state.novels}
            categories={state.categories}
            settings={preferences}
            cover={cover}
            Icon={Icon}
            busy={busy}
            onOpen={(item, pluginId) => run(() => openNovel(item, pluginId))}
            onAction={(action, ids) => void libraryAction(action, ids)}
            onRestore={() => run(restore)}
            onSources={() => setView('sources')}
            onSettingsChange={(changes) => update({
              ...current.current,
              settings: { ...current.current.settings, ...changes },
            })}
          />
        )}
        {view === 'updates' && (
          <Updates
            novels={state.novels}
            busy={busy || !!downloadProgress}
            progress={updatesProgress}
            failures={updatesFailures}
            lastCheck={preferences.desktopLastLibraryUpdate}
            Icon={Icon}
            cover={cover}
            onRefresh={() => run(refreshLibrary)}
            onStop={() => {
              stopUpdates.current = true;
            }}
            onOpen={(book) => {
              setNovelId(book.id);
              setView('novel');
            }}
            onRead={(book, chapter) => run(() => loadChapter(book, chapter))}
            onDownload={(book, ids) => void startDownloads(book, ids)}
            onChange={changeChapterRows}
            onDelete={(book, ids) => run(() => deleteDownloads(book, ids))}
          />
        )}
        {view === 'history' && (
          <History
            novels={state.novels}
            busy={busy}
            Icon={Icon}
            onRead={(book, chapter) => run(() => loadChapter(book, chapter))}
            onRemove={removeHistory}
            cover={cover}
          />
        )}
        <SourceViews
          view={view}
          installed={installed}
          available={available}
          setAvailable={setAvailable}
          sourceMode={sourceMode}
          setSourceMode={setSourceMode}
          sourceLanguage={sourceLanguage}
          setSourceLanguage={setSourceLanguage}
          sourceQuery={sourceQuery}
          setSourceQuery={setSourceQuery}
          repo={repo}
          setRepo={setRepo}
          state={state}
          current={current}
          update={update}
          run={run}
          busy={busy}
          cards={cards}
          downloading={downloading}
          setNotice={setNotice}
          browse={browse}
          source={source}
          novelQuery={novelQuery}
          setNovelQuery={setNovelQuery}
          sourceOptions={sourceOptions}
          setSourceOptions={setSourceOptions}
          sourceFilters={sourceFilters}
          filtersVisible={filtersVisible}
          setFiltersVisible={setFiltersVisible}
          results={results}
          browseMarker={browseMarker}
          loadingMore={loadingMore}
          pageError={pageError}
          loadMore={loadMore}
          hasMore={hasMore}
        />
        {view === 'novel' && novel && (
          <NovelDetails
            key={novel.id}
            novel={novel}
            cover={cover(novel)}
            sourceName={
              installed.find((plugin) => plugin.id === novel.pluginId)?.name ||
              novel.pluginId
            }
            Icon={Icon}
            busy={busy}
            currentChapterId={novelId === novel.id ? chapterId : null}
            downloadProgress={
              downloadProgress?.novelId === novel.id ? downloadProgress : null
            }
            onBack={() => setView('library')}
            onUpdate={() => run(refreshNovel)}
            onToggleLibrary={() =>
              changeNovel({ ...novel, inLibrary: !novel.inLibrary })
            }
            onRead={(chapter) => run(() => loadChapter(novel, chapter))}
            onChange={(ids, patch) => changeChapterRows(novel.id, ids, patch)}
            onDownload={(ids) => void startDownloads(novel, ids)}
            onDelete={(ids) => run(() => deleteDownloads(novel, ids))}
            onMorePages={() => loadNovelPage(novel, nextNovelPage(novel))}
            hasMorePages={Boolean(nextNovelPage(novel))}
            onDirectionChange={(value) =>
              changeNovel({ ...novel, desktopChapterOrder: value })
            }
            onStart={() =>
              run(async () => {
                let book = current.current.novels.find(
                  (item) => item.id === novel.id,
                );
                while (true) {
                  const page = nextNovelPage(book);
                  if (page === undefined) break;
                  book = await loadNovelPage(book, page);
                }
                const first = readingChapters(book)[0];
                if (first) await loadChapter(book, first);
              })
            }
          />
        )}
        {view === 'reader' && novel && chapter && (
          <div
            className={`reader-view${chromeVisible ? '' : ' chrome-hidden'}`}
            style={presentation.surface}
            onMouseMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const top =
                event.currentTarget
                  .querySelector('header')
                  ?.getBoundingClientRect().height || 64;
              const bottom =
                event.currentTarget
                  .querySelector('footer')
                  ?.getBoundingClientRect().height || 64;
              const atEdge =
                event.clientY <= bounds.top + top ||
                event.clientY >= bounds.bottom - bottom;
              if (atEdge) {
                chromePinned.current = true;
                revealChrome();
                clearChromeTimer();
              } else if (chromePinned.current) {
                chromePinned.current = false;
                hideChromeSoon();
              }
            }}
            onMouseLeave={() => {
              chromePinned.current = false;
              hideChromeSoon();
            }}
            onMouseDown={revealChrome}
          >
            <header
              inert={!chromeVisible}
              onMouseEnter={() => {
                chromePinned.current = true;
                clearChromeTimer();
              }}
              onMouseLeave={() => {
                chromePinned.current = false;
                hideChromeSoon();
              }}
              onFocusCapture={revealChrome}
            >
              <button
                className="icon-button"
                aria-label="Voltar aos capítulos"
                title="Voltar aos capítulos"
                onClick={() => setView('novel')}
              >
                <Icon name="back" />
              </button>
              <div className="reader-title">
                <strong>{novel.name}</strong>
                <small>{chapter.name}</small>
                <small className="reader-chapter-position">
                  {translateMessage('Capítulo {v0} de {v1}', {
                    v0: chapterOrdinals(
                      novel.chapters,
                      chapterDirection(novel).direction,
                    ).get(chapter.id),
                    v1: novel.chapters.length,
                  })}
                  {chapterReleaseLabel(chapter.releaseTime) &&
                    translateMessage(' · Lançamento: {v0}', {
                      v0: chapterReleaseLabel(chapter.releaseTime),
                    })}
                </small>
              </div>
              <div className="row">
                <button
                  className="icon-button"
                  aria-label="Ajustes de leitura"
                  aria-expanded={readerControls}
                  onClick={() => setReaderControls(!readerControls)}
                >
                  <Icon name="tune" />
                </button>
                <button
                  aria-label="Diminuir fonte"
                  onClick={() =>
                    update({
                      ...current.current,
                      settings: {
                        ...current.current.settings,
                        desktopFontSize: Math.max(14, fontSize - 2),
                      },
                    })
                  }
                >
                  A−
                </button>
                <button
                  aria-label="Aumentar fonte"
                  onClick={() =>
                    update({
                      ...current.current,
                      settings: {
                        ...current.current.settings,
                        desktopFontSize: Math.min(40, fontSize + 2),
                      },
                    })
                  }
                >
                  A+
                </button>
              </div>
            </header>
            {readerControls && (
              <ReaderControls
                settings={preferences}
                Icon={Icon}
                chapter={chapter}
                busy={busy}
                onChange={(changes) =>
                  update({
                    ...current.current,
                    settings: { ...current.current.settings, ...changes },
                  })
                }
                onChapterChange={(patch) => {
                  changeChapterRows(novel.id, [chapter.id], patch);
                  if (patch.unread && readerRef.current)
                    readerRef.current.scrollTop = 0;
                }}
                onDelete={() => run(() => deleteDownloads(novel, [chapter.id]))}
                onRefresh={() => run(() => loadChapter(novel, chapter, true))}
              />
            )}
            <div
              className={paged ? 'reader-scroll paged' : 'reader-scroll'}
              ref={readerRef}
              tabIndex={0}
              aria-label="Texto do capítulo"
              onMouseDown={(event) => {
                stopReaderJump();
                if (!event.target.closest('a, button, input'))
                  readerRef.current?.focus({ preventScroll: true });
              }}
              onScroll={(event) => {
                const element = event.currentTarget;
                const metrics = readerProgress({
                  paged,
                  scrollTop: element.scrollTop,
                  scrollLeft: element.scrollLeft,
                  scrollHeight: element.scrollHeight,
                  clientHeight: element.clientHeight,
                  scrollWidth: element.scrollWidth,
                  clientWidth: element.clientWidth,
                });
                const total = paged
                  ? Math.max(
                      1,
                      Math.round(element.scrollWidth / element.clientWidth),
                    )
                  : 1;
                const page = paged
                  ? Math.min(
                      total,
                      Math.round(element.scrollLeft / element.clientWidth) + 1,
                    )
                  : 1;
                setViewer((currentView) =>
                  Math.round(currentView.progress) ===
                    Math.round(metrics.progress) &&
                  currentView.page === page &&
                  currentView.total === total
                    ? currentView
                    : {
                        progress: metrics.progress,
                        page,
                        total,
                      },
                );
                if (restoringScroll.current) return;
                layoutPosition.current = {
                  bookId: novel.id,
                  itemId: chapter.id,
                  progress: metrics.progress,
                };
                if (preferences.desktopIncognito) return;
                pendingProgress.current = {
                  bookId: novel.id,
                  itemId: chapter.id,
                  percentage: metrics.progress,
                };
                if (!progressTimer.current)
                  progressTimer.current = setTimeout(flushProgress, 200);
              }}
            >
              <ReaderText
                settings={preferences}
                html={html}
                paged={paged}
                onLayout={onReaderLayout}
                layoutKey={readerRevision}
              />
            </div>
            {chapterLoading && (
              <div className="reader-loading">
                <Spinner label="Carregando capítulo" />
              </div>
            )}
            <footer
              inert={!chromeVisible}
              onMouseEnter={() => {
                chromePinned.current = true;
                clearChromeTimer();
              }}
              onMouseLeave={() => {
                chromePinned.current = false;
                hideChromeSoon();
              }}
              onFocusCapture={revealChrome}
            >
              {[-1, 1].map((offset) => {
                const step =
                  chapterDirection(novel).direction === 'descending'
                    ? -offset
                    : offset;
                const index =
                  novel.chapters.findIndex((c) => c.id === chapter.id) + step;
                const page = Number(chapter.page || 1) + step;
                const canFetchPage =
                  page >= 1 &&
                  page <= Number(novel.totalPages || 1) &&
                  !loadedPages(novel).includes(page);
                return (
                  <button
                    key={offset}
                    aria-label={
                      offset < 0 ? 'Capítulo anterior' : 'Próximo capítulo'
                    }
                    disabled={busy || (!novel.chapters[index] && !canFetchPage)}
                    onClick={() => run(() => navigateChapter(offset))}
                  >
                    {offset < 0 && <Icon name="back" />}
                    {offset < 0 ? 'Anterior' : 'Próximo'}
                    {offset > 0 && <Icon name="next" />}
                  </button>
                );
              })}
              {paged && (
                <div className="reader-page-buttons">
                  <button
                    aria-label="Página anterior"
                    disabled={viewer.page <= 1}
                    onClick={() => void stepReader(-1)}
                  >
                    <Icon name="back" />
                  </button>
                  <button
                    aria-label="Próxima página"
                    disabled={viewer.page >= viewer.total}
                    onClick={() => void stepReader(1)}
                  >
                    <Icon name="next" />
                  </button>
                </div>
              )}
              <span className="reader-page-indicator">
                {paged
                  ? translateMessage('Página {v0} de {v1}', {
                      v0: viewer.page,
                      v1: viewer.total,
                    })
                  : `${Math.round(viewer.progress)}%`}
              </span>
            </footer>
          </div>
        )}
        {view === 'settings' && (
          <Settings
            openDiagnosticsRequest={diagnosticsRequest}
            settings={preferences}
            busy={busy}
            version={appVersion}
            onChange={(changes) => {
              if (changes.desktopInterfaceLanguage)
                setLocale(changes.desktopInterfaceLanguage);
              update({
                ...current.current,
                settings: { ...current.current.settings, ...changes },
              });
            }}
            onReset={() => {
              const nextSettings = restoreDesktopDefaults(
                current.current.settings,
              );
              setLocale(nextSettings.desktopInterfaceLanguage);
              update({ ...current.current, settings: nextSettings });
              setNotice('Configurações padrão restauradas.');
            }}
            onSources={() => {
              setSourceQuery('');
              setView('sources');
            }}
            onChooseBackupFolder={() => window.desktop.chooseBackupDirectory()}
            onBackup={() =>
              run(async () => {
                await persistNow();
                const exported = await window.desktop.backup(
                  snapshot(current.current),
                );
                if (exported)
                  setNotice(
                    exported.missingCount
                      ? translateMessage(
                          'Backup exportado. {v0} arquivo(s) ausente(s) ou corrompido(s) não puderam ser incluídos; os demais dados foram preservados.',
                          { v0: exported.missingCount },
                        )
                      : 'Backup exportado.',
                  );
              })
            }
            onRestore={() => run(restore)}
          />
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')).render(
  <DesktopErrorBoundary>
    <App />
  </DesktopErrorBoundary>,
);
