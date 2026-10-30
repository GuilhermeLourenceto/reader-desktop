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
    [sort, setSort] = useState('original'),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState([]),
    [context, setContext] = useState(null);
  const menu = useRef(null);
  const filterPanel = useRef(null);
  const filterButton = useRef(null);
  const searchInput = useRef(null);
  const lastSelectedId = useRef(null);
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
    const matches = books.filter((book) =>
      (!downloadedOnly || book.chapters?.some((chapter) => chapter.isDownloaded)) &&
      (filter !== 'unread' ||
        book.chapters?.some((chapter) => chapter.unread !== false)) &&
      (book.name.toLowerCase().includes(term) ||
        (typeof book.author === 'string' ? book.author.toLowerCase() : '').includes(term)) &&
      (!category || categoryIds?.has(book.id)),
    );
    if (sort === 'original') return matches;
    const ordered = [...matches];
    if (sort === 'name-asc') ordered.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'name-desc') ordered.sort((a, b) => b.name.localeCompare(a.name));
    if (sort === 'chapters-desc') ordered.sort((a, b) => (b.chapters?.length || 0) - (a.chapters?.length || 0));
    return ordered;
  }, [books, category, categorySets, filter, query, settings.desktopDownloadedOnly, sort]);
  const scrollToStart = () => scrollContainerRef?.current?.scrollTo({ top: 0 });
  const toggle = (id, event) => {
    const startIndex = visible.findIndex((book) => book.id === lastSelectedId.current);
    const endIndex = visible.findIndex((book) => book.id === id);
    if (event?.shiftKey && startIndex >= 0 && endIndex >= 0) {
      const begin = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);
      const range = visible.slice(begin, end + 1).map((book) => book.id);
      setSelected((ids) => [...new Set([...ids, ...range])]);
    } else {
      setSelected((ids) =>
        ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
      );
    }
    lastSelectedId.current = id;
  };
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
  useEffect(() => {
    setSelected([]);
    lastSelectedId.current = null;
  }, [query, category, filter, sort, settings.desktopDownloadedOnly]);
  useEffect(() => {
    if (!filters) return;
    const onOutsideClick = (event) => {
      if (!filterPanel.current?.contains(event.target) &&
          !filterButton.current?.contains(event.target)) setFilters(false);
    };
    document.addEventListener('pointerdown', onOutsideClick);
    return () => document.removeEventListener('pointerdown', onOutsideClick);
  }, [filters]);
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isEditable = target?.closest?.('input,textarea,select,[contenteditable="true"]');
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !isEditable) {
        event.preventDefault();
        searchInput.current?.focus();
        searchInput.current?.select();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && !isEditable) {
        event.preventDefault();
        if (!busy) setSelected(visible.map((book) => book.id));
      } else if (event.key === 'Escape' && !context) {
        if (filters) setFilters(false);
        else if (selected.length) {
          setSelected([]);
          lastSelectedId.current = null;
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, busy, selected.length, context, filters]);
  return (
    <>
      <header className="library-toolbar">
        <h2 className="sr-only">Biblioteca</h2>
        <div className="searchbar">
          <Icon name="search" />
          <input
            ref={searchInput}
            placeholder="Pesquisar na biblioteca"
            aria-label="Pesquisar na biblioteca"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              scrollToStart();
            }}
          />
          <button
            ref={filterButton}
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
        <div ref={filterPanel} className="filter-panel" aria-label="Filtros e ordenação da biblioteca">
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
            <span className="library-filter-label">Estado</span>
            <div className="library-status-options" role="group" aria-label="Estado das obras">
              {[
                ['all', 'Todas'],
                ['unread', 'Não lidas'],
                ['downloaded', 'Baixadas'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? 'selected' : ''}
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    scrollToStart();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="library-filter-field">
            <label htmlFor="library-sort">Ordenar por</label>
            <select
              id="library-sort"
              aria-label="Ordenar biblioteca"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                scrollToStart();
              }}
            >
              <option value="original">Ordem original</option>
              <option value="name-asc">Nome (A–Z)</option>
              <option value="name-desc">Nome (Z–A)</option>
              <option value="chapters-desc">Mais capítulos</option>
            </select>
          </div>
          {(category || filter !== 'all' || sort !== 'original') && (
            <button
              className="library-clear-filters"
              type="button"
              onClick={() => {
                setCategory('');
                setFilter('all');
                setSort('original');
                scrollToStart();
              }}
            >
              Limpar filtros
            </button>
          )}
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
              <button onClick={() => {
                setSelected([]);
                lastSelectedId.current = null;
              }}>Cancelar seleção</button>
            </>
          )}
        </div>
      )}
      <VirtualBookGrid
        items={visible}
        scrollContainerRef={scrollContainerRef}
        key={[query, category, filter, sort, !!settings.desktopDownloadedOnly].join(':')}
        settings={settings}
        cover={cover}
        Icon={Icon}
        busy={busy}
        onOpen={onOpen}
        selected={selected}
        onToggle={toggle}
        hideSelectionCheckbox
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
