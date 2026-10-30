import { t as translateMessage } from './i18n.cjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import sanitize from 'sanitize-html';
import Spinner from './Spinner';
import {
  chapterPercent,
  resumeChapter,
  chapterOrdinals,
  chapterReleaseLabel,
  chapterDirection,
} from './domain.cjs';

export default function NovelDetails({
  novel,
  cover,
  sourceName,
  Icon,
  busy,
  currentChapterId,
  downloadProgress,
  onBack,
  onUpdate,
  onToggleLibrary,
  onRead,
  onChange,
  onDownload,
  onDelete,
  onMorePages,
  hasMorePages,
  onDirectionChange,
  onStart,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [order, setOrder] = useState('source');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState([]);
  const [limit, setLimit] = useState(100);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const alive = useRef(true);
  const sentinelRef = useRef(null);
  const autoLoading = useRef(false);
  const resume = resumeChapter(novel);
  const direction = chapterDirection(novel);
  const ordinals = chapterOrdinals(novel.chapters, direction.direction);
  const genres = (
    Array.isArray(novel.genres)
      ? novel.genres
      : String(novel.genres || '').split(/[,;\n]/)
  )
    .map((value) => value.trim())
    .filter(Boolean);
  let chapters = novel.chapters.filter(
    (chapter) =>
      ((chapter.name || '').toLowerCase().includes(query.toLowerCase()) ||
        String(ordinals.get(chapter.id)) === query.trim()) &&
      (filter === 'all' ||
        (filter === 'unread' && chapter.unread !== false) ||
        (filter === 'read' && chapter.unread === false) ||
        (filter === 'downloaded' && chapter.isDownloaded) ||
        (filter === 'bookmarked' && chapter.bookmark)),
  );
  if (order === 'reverse') chapters = [...chapters].reverse();
  if (order === 'name')
    chapters = [...chapters].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
  const pendingLoad = useRef(null);
  pendingLoad.current = {
    limit,
    total: chapters.length,
    hasMore: hasMorePages,
    load: onMorePages,
    busy,
    error: pageError,
    queryKey: `${query}|${filter}|${order}`,
  };
  const requestMore = useCallback(async (retry = false) => {
    const info = pendingLoad.current;
    if (
      !info ||
      autoLoading.current ||
      info.busy ||
      (info.error && !retry) ||
      (info.limit >= info.total && !info.hasMore)
    )
      return;
    autoLoading.current = true;
    setPageLoading(true);
    setPageError('');
    try {
      if (info.limit < info.total) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (alive.current && info.queryKey === pendingLoad.current.queryKey)
          setLimit((value) => Math.min(value + 100, info.total));
      } else await info.load();
    } catch (error) {
      if (alive.current) setPageError(error.message || String(error));
    } finally {
      autoLoading.current = false;
      if (alive.current) setPageLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    if (pageLoading || pageError || busy) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void requestMore();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [
    requestMore,
    limit,
    chapters.length,
    hasMorePages,
    pageLoading,
    pageError,
    busy,
    query,
    filter,
    order,
    novel.desktopLoadedPages?.join(','),
  ]);
  const apply = (patch) => {
    onChange(selected, patch);
    setSelected([]);
  };
  const toggle = (id) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  return (
    <div className="novel-page">
      <div className="novel-topbar">
        <button
          className="text-button"
          aria-label="Voltar à biblioteca"
          onClick={onBack}
        >
          <Icon name="back" />
          Biblioteca
        </button>
        <div className="row">
          <button
            aria-label="Atualizar capítulos"
            title="Atualizar capítulos"
            disabled={busy}
            onClick={onUpdate}
          >
            <Icon name="refresh" />
          </button>
          <button
            disabled={busy}
            onClick={() =>
              onDownload(
                chapters
                  .filter(
                    (chapter) =>
                      !chapter.isDownloaded ||
                      chapter.desktopAssetsCached === false,
                  )
                  .slice(0, 10)
                  .map((chapter) => chapter.id),
              )
            }
          >
            <Icon name="download" />
            Baixar próximos 10
          </button>
        </div>
      </div>
      <div className="novel-layout">
        <section className="novel-info-column" aria-label="Informações da obra">
          <div className="novel-hero">
            {cover && (
              <img
                className="novel-backdrop"
                src={cover}
                alt=""
                aria-hidden="true"
              />
            )}
            <div className="novel-cover">
              {cover ? (
                <img
                  src={cover}
                  alt={translateMessage('Capa de {v0}', { v0: novel.name })}
                />
              ) : (
                <div className="placeholder">
                  <Icon name="book" />
                </div>
              )}
            </div>
            <div className="novel-details">
              <h2>{novel.name}</h2>
              <p>{novel.author || 'Autor não informado'}</p>
              <p>
                {novel.status || 'Status não informado'} · {sourceName}
              </p>
              <button
                className={`library-action ${
                  novel.inLibrary ? 'followed' : ''
                }`}
                aria-label={
                  novel.inLibrary
                    ? 'Remover da biblioteca'
                    : 'Adicionar à biblioteca'
                }
                onClick={onToggleLibrary}
              >
                <Icon name="heart" />
                {novel.inLibrary ? 'Na biblioteca' : 'Adicionar à biblioteca'}
              </button>
            </div>
          </div>
          {novel.summary && (
            <div className="novel-summary">
              <p className={`summary ${expanded ? 'expanded' : 'collapsed'}`}>
                {sanitize(novel.summary, {
                  allowedTags: [],
                  allowedAttributes: {},
                })}
              </p>
              <button
                className="text-button summary-toggle"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Mostrar menos' : 'Mostrar mais'}
              </button>
            </div>
          )}
          {genres.length > 0 && (
            <div className="genre-chips">
              {[...new Set(genres)].map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
            </div>
          )}
          <button
            className="continue-reading"
            aria-label="Continuar leitura"
            disabled={
              busy ||
              !resume ||
              (!direction.detected &&
                !novel.chapters.some((chapter) => chapter.readTime))
            }
            onClick={() =>
              !novel.chapters.some((chapter) => chapter.readTime) &&
              hasMorePages
                ? onStart()
                : onRead(resume)
            }
          >
            <Icon name="play" />
            <span>
              Continuar leitura{resume && <small>{resume.name}</small>}
            </span>
          </button>
        </section>
        <section className="novel-chapters-column" aria-label="Capítulos">
          <div className="chapter-heading">
            <h3>{novel.chapters.length} capítulos</h3>
            <button
              className="icon-button"
              aria-label="Filtrar e ordenar capítulos"
              aria-expanded={filtersVisible}
              onClick={() => setFiltersVisible(!filtersVisible)}
            >
              <Icon name="filter" />
            </button>
          </div>
          <input
            className="chapter-search"
            aria-label="Pesquisar capítulos"
            placeholder="Pesquisar capítulos por nome ou número"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(100);
            }}
          />
          {filtersVisible && (
            <div className="chapter-filters">
              <label>
                Mostrar
                <select
                  aria-label="Filtrar capítulos"
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value);
                    setLimit(100);
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="unread">Não lidos</option>
                  <option value="read">Lidos</option>
                  <option value="downloaded">Baixados</option>
                  <option value="bookmarked">Com marcador</option>
                </select>
              </label>
              <label>
                Ordenação
                <select
                  aria-label="Ordenar capítulos"
                  value={order}
                  onChange={(event) => {
                    setOrder(event.target.value);
                    setLimit(100);
                  }}
                >
                  <option value="source">Ordem da fonte</option>
                  <option value="reverse">Ordem inversa</option>
                  <option value="name">Nome / número</option>
                </select>
              </label>
              <label className="chapter-direction-setting">
                Início da história na fonte
                <select
                  aria-label="Início da história na fonte"
                  value={novel.desktopChapterOrder || 'auto'}
                  onChange={(event) => onDirectionChange(event.target.value)}
                >
                  <option value="auto">Detectar automaticamente</option>
                  <option value="ascending">Início da lista (crescente)</option>
                  <option value="descending">
                    Final da lista (decrescente)
                  </option>
                </select>
                <small role="status">
                  {direction.detected
                    ? translateMessage('Ordem {v0}: {v1}', {
                        v0: direction.manual ? 'definida' : 'identificada',
                        v1:
                          direction.direction === 'ascending'
                            ? 'crescente'
                            : 'decrescente',
                      })
                    : 'Ordem não identificada; escolha onde começa a história.'}
                </small>
              </label>
              <button
                className="chapter-start-button"
                disabled={busy || !novel.chapters.length || !direction.detected}
                onClick={onStart}
              >
                <Icon name="play" /> Ler desde o início
              </button>
            </div>
          )}
          {selected.length > 0 && (
            <div
              className="chapter-selection"
              role="region"
              aria-label="Ações dos capítulos selecionados"
            >
              <strong>{translateMessage('{count} selecionados', { count: selected.length })}</strong>
              <button
                onClick={() =>
                  setSelected(chapters.map((chapter) => chapter.id))
                }
              >
                Selecionar filtrados
              </button>
              <button disabled={busy} onClick={() => apply({ unread: false })}>
                <Icon name="check" />
                Marcar lidos
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  apply({
                    unread: true,
                    progress: 0,
                    desktopProgressUnit: 'percent',
                  })
                }
              >
                Marcar não lidos
              </button>
              <button disabled={busy} onClick={() => apply({ bookmark: true })}>
                <Icon name="bookmark" />
                Marcar
              </button>
              <button disabled={busy} onClick={() => onDownload(selected)}>
                <Icon name="download" />
                Baixar selecionados
              </button>
              <button disabled={busy} onClick={() => onDelete(selected)}>
                <Icon name="trash" />
                Apagar downloads
              </button>
              <button onClick={() => setSelected([])}>Limpar seleção</button>
            </div>
          )}
          <div className="chapters">
            {chapters.slice(0, limit).map((chapter) => (
              <div
                className={`chapter-row ${
                  chapter.unread === false ? 'is-read' : ''
                } ${chapter.id === currentChapterId ? 'is-current' : ''} ${
                  chapter.id === downloadProgress?.chapterId
                    ? 'is-downloading'
                    : ''
                }`}
                key={chapter.id}
              >
                <input
                  type="checkbox"
                  aria-label={translateMessage('Selecionar {v0}', {
                    v0: chapter.name,
                  })}
                  checked={selected.includes(chapter.id)}
                  onChange={() => toggle(chapter.id)}
                />
                <button
                  className="chapter-open"
                  disabled={busy}
                  aria-current={
                    chapter.id === currentChapterId ? 'true' : undefined
                  }
                  onClick={() => onRead(chapter)}
                >
                  <span className="chapter-name">
                    {chapter.unread !== false && (
                      <i className="unread-dot" aria-label="Não lido" />
                    )}
                    <span className="chapter-title">{chapter.name}</span>
                    {chapter.id === currentChapterId && (
                      <span className="current-chapter-badge">Em leitura</span>
                    )}
                    <span className="chapter-status-icons">
                      {chapter.unread === false && (
                        <span
                          className="chapter-status-icon is-read"
                          role="img"
                          aria-label="Capítulo lido"
                          title="Capítulo lido"
                        >
                          <Icon name="check" />
                        </span>
                      )}
                      {chapter.isDownloaded && (
                        <span
                          className="chapter-status-icon is-downloaded"
                          role="img"
                          aria-label="Capítulo baixado para leitura offline"
                          title="Capítulo baixado para leitura offline"
                        >
                          <Icon name="download" />
                        </span>
                      )}
                    </span>
                  </span>
                  <small>
                    <span
                      className="chapter-ordinal"
                      title="Posição na sequência completa de capítulos"
                    >
                      {translateMessage('{v0} de {v1}', { v0: ordinals.get(chapter.id), v1: novel.chapters.length })}
                    </span>
                    {' · '}
                    {chapterPercent(chapter) > 0
                      ? translateMessage('Progresso {v0}% · ', {
                          v0: Math.round(chapterPercent(chapter)),
                        })
                      : ''}
                    {chapter.unread === false ? 'Lido' : 'Não lido'}
                    {chapter.isDownloaded ? ' · Baixado' : ''}
                  </small>
                  {chapter.id === downloadProgress?.chapterId && (
                    <span className="chapter-download-progress">
                      <span className="chapter-download-label">
                        {downloadProgress.phase === 'images'
                          ? downloadProgress.imageTotal
                            ? translateMessage('Baixando imagens {v0}/{v1}', {
                                v0: downloadProgress.imageIndex,
                                v1: downloadProgress.imageTotal,
                              })
                            : 'Salvando capítulo…'
                          : 'Baixando capítulo…'}
                      </span>
                      <span
                        className={`chapter-download-track ${
                          downloadProgress.phase !== 'images' ||
                          !downloadProgress.imageTotal
                            ? 'is-indeterminate'
                            : ''
                        }`}
                        role="progressbar"
                        aria-label={translateMessage('Download de {v0}', {
                          v0: chapter.name,
                        })}
                        aria-valuemin={0}
                        aria-valuemax={
                          downloadProgress.imageTotal > 0
                            ? downloadProgress.imageTotal
                            : undefined
                        }
                        aria-valuenow={
                          downloadProgress.phase === 'images' &&
                          downloadProgress.imageTotal > 0
                            ? downloadProgress.imageIndex
                            : undefined
                        }
                        aria-valuetext={
                          downloadProgress.phase === 'images' &&
                          downloadProgress.imageTotal > 0
                            ? translateMessage('{v0} de {v1} imagens', {
                                v0: downloadProgress.imageIndex,
                                v1: downloadProgress.imageTotal,
                              })
                            : 'Em andamento'
                        }
                      >
                        <span
                          style={
                            downloadProgress.phase === 'images' &&
                            downloadProgress.imageTotal > 0
                              ? {
                                  width: `${
                                    (downloadProgress.imageIndex /
                                      downloadProgress.imageTotal) *
                                    100
                                  }%`,
                                }
                              : undefined
                          }
                        />
                      </span>
                    </span>
                  )}
                  {chapterReleaseLabel(chapter.releaseTime) && (
                    <small className="chapter-release">
                      Lançamento: {chapterReleaseLabel(chapter.releaseTime)}
                    </small>
                  )}
                </button>
                <div className="chapter-actions">
                  <button
                    className={chapter.bookmark ? 'active' : ''}
                    aria-label={`${
                      chapter.bookmark ? 'Remover marcador de' : 'Marcar'
                    } ${chapter.name}`}
                    title="Marcador"
                    disabled={busy}
                    onClick={() =>
                      onChange([chapter.id], { bookmark: !chapter.bookmark })
                    }
                  >
                    <Icon name="bookmark" />
                  </button>
                  <button
                    aria-label={`${
                      chapter.unread === false
                        ? 'Marcar não lido'
                        : 'Marcar lido'
                    }: ${chapter.name}`}
                    title={
                      chapter.unread === false
                        ? 'Marcar como não lido'
                        : 'Marcar como lido'
                    }
                    disabled={busy}
                    onClick={() =>
                      onChange(
                        [chapter.id],
                        chapter.unread === false
                          ? {
                              unread: true,
                              progress: 0,
                              desktopProgressUnit: 'percent',
                            }
                          : { unread: false },
                      )
                    }
                  >
                    <Icon
                      name={chapter.unread === false ? 'unread' : 'check'}
                    />
                  </button>
                  <button
                    aria-label={`${
                      chapter.isDownloaded
                        ? 'Apagar download'
                        : 'Baixar capítulo'
                    }: ${chapter.name}`}
                    title={
                      chapter.isDownloaded
                        ? 'Apagar download'
                        : 'Baixar capítulo'
                    }
                    disabled={busy}
                    onClick={() =>
                      chapter.isDownloaded
                        ? onDelete([chapter.id])
                        : onDownload([chapter.id])
                    }
                  >
                    <Icon name={chapter.isDownloaded ? 'trash' : 'download'} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!chapters.length && (
            <p className="empty-chapters">
              Nenhum capítulo corresponde a este filtro.
            </p>
          )}
          <div className="chapters-sentinel" ref={sentinelRef}>
            {pageLoading && (
              <div className="chapters-loading" role="status">
                <Spinner small label="Carregando mais capítulos" />
                <span>Carregando mais capítulos…</span>
              </div>
            )}
          </div>
          {pageError && (
            <div role="alert" className="chapter-page-error">
              <p>{pageError}</p>
              <button
                disabled={pageLoading || busy}
                onClick={() => void requestMore(true)}
              >
                Tentar carregar capítulos novamente
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
