import { t as translateMessage } from '../../i18n.cjs';
import { getLocale } from '../../i18n.cjs';
import React, { useMemo, useState } from 'react';
import { chapterPercent } from '../../domain/novels.cjs';
export default function History({
  novels,
  busy,
  onRead,
  onRemove,
  Icon,
  cover,
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(100);
  // Build the history only when the library changes, not on each input/hover.
  const entries = useMemo(() => {
    const rows = [];
    for (const novel of novels) {
      for (const chapter of novel.chapters || []) {
        if (chapter.readTime) rows.push({ novel, chapter });
      }
    }
    return rows.sort(
      (a, b) => Date.parse(b.chapter.readTime) - Date.parse(a.chapter.readTime),
    );
  }, [novels]);
  const filtered = useMemo(() => {
    const term = query.toLocaleLowerCase();
    return entries.filter(({ novel, chapter }) =>
      `${novel.name} ${chapter.name}`.toLocaleLowerCase().includes(term),
    );
  }, [entries, query]);
  return (
    <div className="history-page">
      <header>
        <h2>Histórico</h2>
        <button
          disabled={busy || !entries.length}
          onClick={() => {
            if (
              window.confirm(
                'Remover todo o histórico? Os downloads e a marcação de lido serão mantidos.',
              )
            )
              onRemove(
                entries.map(({ novel, chapter }) => ({
                  novelId: novel.id,
                  chapterId: chapter.id,
                })),
              );
          }}
        >
          <Icon name="trash" />
          Limpar histórico
        </button>
      </header>
      <input
        aria-label="Pesquisar histórico"
        placeholder="Pesquisar obra ou capítulo"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setLimit(100);
        }}
      />
      {!filtered.length && (
        <div className="empty">
          <Icon name="history" />
          <h3>Nenhuma leitura no histórico</h3>
          <p>Os capítulos abertos aparecem aqui, exceto no modo anônimo.</p>
        </div>
      )}
      {filtered.slice(0, limit).map(({ novel, chapter }) => (
        <div className="history-row" key={`${novel.id}:${chapter.id}`}>
          <button
            className="history-open"
            disabled={busy}
            onClick={() => onRead(novel, chapter)}
          >
            <span className="history-cover">
              {cover(novel) ? (
                <img
                  src={cover(novel)}
                  alt={translateMessage('Capa de {v0}', { v0: novel.name })}
                  loading="lazy"
                />
              ) : (
                <Icon name="book" />
              )}
            </span>
            <span className="history-entry-copy">
              <strong>{novel.name}</strong>
              <span>{chapter.name}</span>
              <small>
                {new Date(chapter.readTime).toLocaleString(getLocale())} ·{' '}
                {Math.round(chapterPercent(chapter))}%
              </small>
            </span>
          </button>
          <button
            className="icon-button"
            aria-label={translateMessage('Remover do histórico: {v0}', {
              v0: chapter.name,
            })}
            title="Remover do histórico"
            disabled={busy}
            onClick={() =>
              onRemove([{ novelId: novel.id, chapterId: chapter.id }])
            }
          >
            <Icon name="trash" />
          </button>
        </div>
      ))}
      {filtered.length > limit && (
        <button className="history-more" onClick={() => setLimit(value => value + 100)}>
          {translateMessage('Mostrar mais histórico')}
        </button>
      )}
    </div>
  );
}
