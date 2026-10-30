import { t as translateMessage } from './i18n.cjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import VirtualBookGrid from './VirtualBookGrid';
import { categoryDisplayName } from './libraryCategoryLabels.cjs';
export default function Library({
  novels,
  categories,
  settings,
  cover,
  Icon,
  busy,
  onOpen,
  onAction,
  onRestore,
  onSources,
  scrollContainerRef,
}) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState(''),
    [filter, setFilter] = useState('all'),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState([]),
    [context, setContext] = useState(null);
  const menu = useRef(null);
  const books = useMemo(
    () => novels.filter((book) => book.inLibrary),
    [novels],
  );
  const categorySets = useMemo(
    () => new Map(categories.map((item) => [String(item.id), new Set(item.novelIds)])),
    [categories],
  );
  const categoryCounts = useMemo(
    () => new Map(categories.map((item) => [
      String(item.id),
      books.filter((book) => categorySets.get(String(item.id)).has(book.id)).length,
    ])),
    [books, categories, categorySets],
  );
  // Filtering thousands of chapters on every selection click is unnecessary.
  const visible = useMemo(() => {
    const term = query.toLowerCase();
    const categoryIds = categorySets.get(category);
    const downloadedOnly = !!settings.desktopDownloadedOnly || filter === 'downloaded';
    return books.filter((book) =>
      (!downloadedOnly || book.chapters.some((chapter) => chapter.isDownloaded)) &&
      (filter !== 'unread' ||
        book.chapters.some((chapter) => chapter.unread !== false)) &&
      book.name.toLowerCase().includes(term) &&
      (!category || categoryIds?.has(book.id)),
    );
  }, [books, category, categorySets, filter, query, settings.desktopDownloadedOnly]);
  const scrollToStart = () => scrollContainerRef?.current?.scrollTo({ top: 0 });
  const toggle = (id) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  const act = (action, ids) => {
    setContext(null);
    onAction(action, ids);
    setSelected([]);
  };
  useEffect(() => {
    if (!context) return;
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && menu.current?.contains(event.target))
        return;
      setContext(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    menu.current?.querySelector('button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [context]);
  useEffect(
    () => {
      const valid = new Set(books.map((book) => book.id));
      setSelected((ids) => {
        const kept = ids.filter((id) => valid.has(id));
        return kept.length === ids.length ? ids : kept;
      });
    },
    [books],
  );
  return (
    <>
      <header className="library-toolbar">
        <h2 className="sr-only">Biblioteca</h2>
        <div className="searchbar">
          <Icon name="search" />
          <input
            placeholder="Pesquisar na biblioteca"
            aria-label="Pesquisar na biblioteca"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              scrollToStart();
            }}
          />
          <button
            className="icon-button"
            aria-label="Filtrar biblioteca"
            aria-expanded={filters}
            onClick={() => setFilters(!filters)}
          >
            <Icon name="filter" />
          </button>
        </div>
      </header>
      {filters && (
        <div className="filter-panel">
          <div className="library-filter-field">
            <label htmlFor="library-category">Categoria</label>
            <select
              id="library-category"
              aria-label="Categoria da biblioteca"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                scrollToStart();
              }}
            >
              <option value="">Todas ({books.length})</option>
              {categories.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {categoryDisplayName(item.name)} ({categoryCounts.get(String(item.id)) || 0})
                </option>
              ))}
            </select>
          </div>
          <div className="library-filter-field">
            <label htmlFor="library-filter">Mostrar</label>
            <select
              id="library-filter"
              aria-label="Mostrar obras"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                scrollToStart();
              }}
            >
              <option value="all">Todas as obras</option>
              <option value="unread">Com capítulos não lidos</option>
              <option value="downloaded">Com capítulos baixados</option>
            </select>
          </div>
        </div>
      )}
      {books.length > 0 && (
        <div className="library-selection" data-selected-count={selected.length}>
          <span>
            {selected.length
              ? translateMessage('{count} obra(s) selecionada(s)', {
                  count: selected.length,
                })
              : translateMessage('{count} obra(s)', { count: visible.length })}
          </span>
          {visible.length > 0 && (
            <button
              disabled={busy}
              onClick={() => setSelected(visible.map((book) => book.id))}
            >
              Selecionar todos
            </button>
          )}
          {selected.length > 0 && (
            <>
              <button disabled={busy} onClick={() => act('download', selected)}>
                <Icon name="download" />
                Baixar selecionadas
              </button>
              <button disabled={busy} onClick={() => act('reset', selected)}>
                Resetar leitura
              </button>
              <button disabled={busy} onClick={() => act('remove', selected)}>
                <Icon name="trash" />
                Remover selecionadas
              </button>
              <button onClick={() => setSelected([])}>Cancelar seleção</button>
            </>
          )}
        </div>
      )}
      <VirtualBookGrid
        items={visible}
        scrollContainerRef={scrollContainerRef}
        key={[query, category, filter, !!settings.desktopDownloadedOnly].join(':')}
        settings={settings}
        cover={cover}
        Icon={Icon}
        busy={busy}
        onOpen={onOpen}
        selected={selected}
        onContext={(book, x, y) =>
          setContext({
            book,
            x: Math.max(8, Math.min(x, innerWidth - 270)),
            y: Math.max(8, Math.min(y, innerHeight - 330)),
          })
        }
      />
      {!books.length && (
        <div className="empty">
          <Icon name="library" />
          <h3>Sua biblioteca está vazia</h3>
          <p>Restaure um backup ou adicione obras pelas fontes.</p>
          <button onClick={onRestore}>Restaurar backup</button>
          <button onClick={onSources}>Explorar fontes</button>
        </div>
      )}
      {books.length > 0 && !visible.length && (
        <p className="empty">Nenhuma obra corresponde aos filtros atuais.</p>
      )}
      {context && (
        <div
          ref={menu}
          className="book-context-menu"
          role="menu"
          aria-label={translateMessage('Ações de {v0}', {
            v0: context.book.name,
          })}
          style={{ left: context.x, top: context.y }}
        >
          <strong>{context.book.name}</strong>
          <button
            role="menuitem"
            onClick={() => {
              onOpen(context.book, context.book.pluginId);
              setContext(null);
            }}
          >
            Abrir obra
          </button>
          <button
            role="menuitem"
            onClick={() => {
              toggle(context.book.id);
              setContext(null);
            }}
          >
            {selected.includes(context.book.id) ? 'Desmarcar obra' : 'Selecionar obra'}
          </button>
          <button
            role="menuitem"
            disabled={busy}
            onClick={() => act('download', [context.book.id])}
          >
            Baixar capítulos pendentes
          </button>
          <button
            role="menuitem"
            disabled={busy}
            onClick={() => act('reset', [context.book.id])}
          >
            Resetar leitura da obra
          </button>
          <button
            role="menuitem"
            disabled={busy}
            onClick={() => act('remove', [context.book.id])}
          >
            Remover da biblioteca
          </button>
        </div>
      )}
    </>
  );
}
