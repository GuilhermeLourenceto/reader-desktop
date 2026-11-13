import React, { useEffect, useRef, useState } from 'react';
import Spinner from '../../components/Spinner';
import { t } from '../../i18n.cjs';
import { orderGlobalSearchRows } from '../../domain/globalSourceOrder.cjs';
export default function GlobalSearch({ plugins, fetchPage, cards }) {
  const [term, setTerm] = useState(''),
    [rows, setRows] = useState([]),
    [running, setRunning] = useState(false);
  const sessions = useRef(new Map()),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const request = async (session) => {
    if (!session || session.pending) return;
    session.pending = true;
    const token = generation.current;
    const publish = () => {
      if (token === generation.current)
        setRows([...sessions.current.values()].map((row) => ({ ...row })));
    };
    session.error = '';
    publish();
    try {
      const response = await fetchPage(
        session.plugin.id,
        session.term,
        session.page + 1,
      );
      if (token !== generation.current) return;
      const seen = new Set(session.items.map((item) => item.path));
      const additions = response.filter((item) => {
        if (seen.has(item.path)) return false;
        seen.add(item.path);
        return true;
      });
      session.items = [...session.items, ...additions];
      session.page++;
      session.hasMore = response.length > 0 && additions.length > 0;
    } catch (error) {
      if (token === generation.current)
        session.error = error.message || String(error);
    } finally {
      session.pending = false;
      publish();
    }
  };
  const search = async (event) => {
    event.preventDefault();
    if (!term.trim()) return;
    const token = ++generation.current;
    const entries = plugins.map((plugin) => ({
      plugin,
      term: term.trim(),
      page: 0,
      items: [],
      pending: false,
      error: '',
      hasMore: true,
      queued: true,
    }));
    sessions.current = new Map(
      entries.map((entry) => [entry.plugin.id, entry]),
    );
    setRows(entries.map((entry) => ({ ...entry })));
    setRunning(true);
    let index = 0;
    const worker = async () => {
      while (token === generation.current && index < entries.length) {
        const entry = entries[index++];
        entry.queued = false;
        await request(entry);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(3, entries.length) }, worker),
    );
    if (token === generation.current) setRunning(false);
  };
  return (
    <div className="global-search">
      <form className="global-search-form" onSubmit={search}>
        <label htmlFor="global-novel-query">
          {t('Buscar em {count} fontes', { count: plugins.length })}
        </label>
        <div className="row">
          <input
            id="global-novel-query"
            aria-label="Buscar em todas as fontes"
            placeholder="Nome da obra"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
          <button disabled={!term.trim() || !plugins.length}>
            Buscar em todas
          </button>
        </div>
      </form>
      {!plugins.length && (
        <p>Instale ao menos uma fonte para pesquisar obras.</p>
      )}
      {running && (
        <div className="global-search-progress" role="status">
          <span className="spinner" />
          Pesquisando nas fontes…
        </div>
      )}
      {orderGlobalSearchRows(rows).map((row) => (
        <section
          className="global-source-results"
          key={row.plugin.id}
          data-source-id={row.plugin.id}
        >
          <header>
            <h3>
              {row.plugin.name} <small>{row.plugin.lang}</small>
            </h3>
            <span>{row.items.length} resultado(s)</span>
          </header>
          {row.pending || row.queued ? (
            <p role="status" className="settings-status">
              <Spinner
                small
                label={row.pending ? 'Carregando fonte' : 'Aguardando fonte'}
              />
              {row.pending ? 'Carregando…' : 'Aguardando…'}
            </p>
          ) : null}
          {row.items.length > 0 && cards(row.items, row.plugin.id)}
          {row.error ? (
            <div role="alert">
              <p>{row.error}</p>
              <button
                disabled={row.pending}
                onClick={() =>
                  void request(sessions.current.get(row.plugin.id))
                }
              >
                Tentar esta fonte novamente
              </button>
            </div>
          ) : !row.pending &&
            !row.queued &&
            row.page > 0 &&
            !row.items.length ? (
            <p>Nenhuma obra encontrada nesta fonte.</p>
          ) : null}
          {row.items.length > 0 && row.hasMore && !row.error && (
            <button
              disabled={row.pending}
              onClick={() => void request(sessions.current.get(row.plugin.id))}
            >
              Carregar mais desta fonte
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
