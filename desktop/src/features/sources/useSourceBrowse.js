import { t as translateMessage } from '../../i18n.cjs';
import { userMessageForError } from '../../domain/userFacingError.cjs';
// Encapsulates source browsing, pagination and intersection-based loading.
import { useCallback, useEffect } from 'react';
import { loadPlugin } from '../../sourceClient';
import { errorText, fetchSourcePage } from '../../sourceRuntime';
import { validateFilters } from '../../sourceGuards.cjs';

// Keep the access-check flag independent of the displayed language.
function sourceError(error) {
  const detail = errorText(error);
  void window.desktop.diagnostics.report({
    level: 'error', code: 'SRC-BROWSE-FAILED', operation: 'source', message: detail,
  }).catch(() => {});
  return {
    message: translateMessage(userMessageForError(error)),
    needsLogin: /(?:403|captcha|cloudflare|webview|challenge|verifica)/i.test(detail),
  };
}

export function useSourceBrowse({
  browseSession, mainRef, browseMarker,
  view, busy, loadingMore, pageError, hasMore, results,
  setLoadingMore, setPageError, setHasMore, setResults,
  setSource, setNovelQuery, setView, setSourceOptions, setSourceFilters,
}) {
  const browse = async (pluginId, term = '', options, retry = false) => {
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
    setLoadingMore(retry);
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
      if (browseSession.current === session) setPageError(sourceError(error));
    } finally {
      if (browseSession.current === session) {
        session.pending = false;
        if (retry) setLoadingMore(false);
      }
    }
  };
  const loadMore = useCallback(async () => {
    const session = browseSession.current;
    if (!session || session.pending || !session.hasMore) return;
    if (session.page === 0) return browse(session.pluginId, session.term, session.options, true);
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
        setPageError({
          message: translateMessage('A fonte repetiu uma página sem novos resultados. Tente novamente para consultar a próxima página.'),
          needsLogin: false,
        });
      setResults(session.items);
      setHasMore(session.hasMore);
    } catch (error) {
      if (browseSession.current === session) setPageError(sourceError(error));
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
  return { browse, loadMore };
}
