import { t as translateMessage } from '../../i18n.cjs';
import { getLocale, t } from '../../i18n.cjs';
import React, { useMemo, useState } from 'react';
import { updateGroups } from '../../domain/updates.cjs';
import { chapterOrdinals, chapterDirection } from '../../domain.cjs';
import Spinner from '../../components/Spinner';
function dateLabel(day) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const date = new Date(day + 'T12:00:00');
  if (date.toDateString() === today.toDateString()) return t('Hoje');
  if (date.toDateString() === yesterday.toDateString()) return t('Ontem');
  return date.toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
export default function Updates({
  novels,
  busy,
  progress,
  failures,
  lastCheck,
  cover,
  Icon,
  onRefresh,
  onStop,
  onOpen,
  onRead,
  onDownload,
  onDelete,
  onChange,
}) {
  const [query, setQuery] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [limit, setLimit] = useState(30);
  const [chapterLimits, setChapterLimits] = useState({});
  const all = useMemo(() => {
    const numberingByNovel = new Map();
    return updateGroups(novels).map(group => {
      let numbering = numberingByNovel.get(group.novel.id);
      if (!numbering) {
        numbering = chapterOrdinals(
          group.novel.chapters,
          chapterDirection(group.novel).direction,
        );
        numberingByNovel.set(group.novel.id, numbering);
      }
      return { ...group, numbering };
    });
  }, [novels]);
  const groups = useMemo(() => {
    const term = query.toLocaleLowerCase();
    return all
      .map((group) => ({
        ...group,
        chapters: group.chapters.filter(
          (chapter) =>
            (!onlyUnread || chapter.unread !== false) &&
            `${group.novel.name} ${chapter.name}`
              .toLocaleLowerCase()
              .includes(term),
        ),
      }))
      .filter((group) => group.chapters.length);
  }, [all, onlyUnread, query]);
  let previousDay;
  return (
    <div className="updates-page history-page">
      <header>
        <h2>Atualizações</h2>
        <button
          disabled={busy || !!progress || !novels.some((n) => n.inLibrary)}
          onClick={onRefresh}
        >
          <Icon name="refresh" /> Atualizar biblioteca
        </button>
      </header>
      <p>Novos capítulos encontrados nas obras da sua biblioteca.</p>
      <div className="updates-filters">
        <input
          aria-label="Pesquisar atualizações"
          placeholder="Pesquisar obra ou capítulo"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(30);
          }}
        />
        <label>
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(event) => {
              setOnlyUnread(event.target.checked);
              setLimit(30);
            }}
          />{' '}
          Apenas não lidos
        </label>
      </div>
      {lastCheck && (
        <p className="updates-last-check">
          Última verificação: {new Date(lastCheck).toLocaleString(getLocale())}
        </p>
      )}
      {progress && (
        <div className="updates-progress" role="status">
          <Spinner small label="Atualizando biblioteca" />
          <span className="updates-progress-text">
            {t('Verificando {current} de {total}: {name}', {
              current: progress.done + 1,
              total: progress.total,
              name: progress.name,
            })}
          </span>
          <button onClick={onStop}>Parar após esta obra</button>
        </div>
      )}
      {failures.length > 0 && (
        <details className="updates-errors">
          <summary>
            {t('Obras não verificadas: {count}', { count: failures.length })}
          </summary>
          {failures.map((failure, index) => (
            <p key={index}>{failure}</p>
          ))}
        </details>
      )}
      {!groups.length && (
        <div className="empty">
          <Icon name="updates" />
          <h3>
            {query || onlyUnread
              ? 'Nenhuma atualização corresponde ao filtro'
              : 'Nenhuma atualização encontrada'}
          </h3>
          <p>
            {all.length
              ? 'Altere os filtros para ver outros capítulos.'
              : 'Atualize a biblioteca para consultar novos capítulos. Capítulos antigos ainda não sincronizados não são anunciados como novos.'}
          </p>
        </div>
      )}
      {groups.slice(0, limit).map((group) => {
        const showDate = previousDay !== group.day;
        previousDay = group.day;
        const ids = group.chapters.map((chapter) => chapter.id);
        const numbering = group.numbering;
        return (
          <section
            className="update-group"
            key={group.key}
            aria-label={translateMessage('Atualizações de {v0}', {
              v0: group.novel.name,
            })}
          >
            {showDate && (
              <h3 className="update-date">{dateLabel(group.day)}</h3>
            )}
            <div className="update-group-heading">
              <button
                className="update-novel"
                disabled={busy}
                onClick={() => onOpen(group.novel)}
              >
                <span className="history-cover">
                  {cover(group.novel) ? (
                    <img
                      src={cover(group.novel)}
                      alt={translateMessage('Capa de {v0}', {
                        v0: group.novel.name,
                      })}
                      loading="lazy"
                    />
                  ) : (
                    <Icon name="book" />
                  )}
                </span>
                <span>
                  <strong>{group.novel.name}</strong>
                  <small>
                    {t('Capítulos: {total} · Não lidos: {unread}', {
                      total: ids.length,
                      unread: group.chapters.filter((c) => c.unread !== false)
                        .length,
                    })}
                  </small>
                </span>
              </button>
              <button
                aria-label={translateMessage('Expandir capítulos: {v0}', {
                  v0: group.novel.name,
                })}
                aria-expanded={!!expanded[group.key]}
                onClick={() =>
                  setExpanded({
                    ...expanded,
                    [group.key]: !expanded[group.key],
                  })
                }
              >
                {expanded[group.key] ? 'Recolher' : 'Ver capítulos'}
              </button>
            </div>
            <div className="update-group-actions">
              <button
                disabled={busy}
                onClick={() => onDownload(group.novel, ids)}
              >
                <Icon name="download" /> Baixar
              </button>
              <button
                disabled={busy}
                onClick={() => onChange(group.novel.id, ids, { unread: false })}
              >
                <Icon name="check" /> Marcar lidos
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  onChange(group.novel.id, ids, {
                    unread: true,
                    progress: 0,
                    desktopProgressUnit: 'percent',
                  })
                }
              >
                Marcar não lidos
              </button>
            </div>
            {expanded[group.key] && (
              <div className="update-chapters">
                {group.chapters.slice(0, chapterLimits[group.key] || 100).map((chapter) => (
                  <div
                    className={`update-chapter ${
                      chapter.unread === false ? 'is-read' : ''
                    }`}
                    key={chapter.id}
                  >
                    <button
                      className="update-chapter-open"
                      disabled={busy}
                      onClick={() => onRead(group.novel, chapter)}
                    >
                      {chapter.unread !== false && (
                        <i className="unread-dot" aria-label="Não lido" />
                      )}
                      <span>
                        <strong>{chapter.name}</strong>
                        <small>
                          {translateMessage('Capítulo {v0}', { v0: numbering.get(chapter.id) })} ·{' '}
                          {chapter.unread === false ? 'Lido' : 'Não lido'}
                          {chapter.isDownloaded && <> · {translateMessage('Baixado')}</>}
                        </small>
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={translateMessage(chapter.isDownloaded ? 'Apagar download da atualização: {v0}' : 'Baixar atualização: {v0}', { v0: chapter.name })}
                      disabled={busy}
                      onClick={() =>
                        chapter.isDownloaded
                          ? onDelete(group.novel, [chapter.id])
                          : onDownload(group.novel, [chapter.id])
                      }
                    >
                      <Icon
                        name={chapter.isDownloaded ? 'trash' : 'download'}
                      />
                    </button>
                  </div>
                ))}
                {group.chapters.length > (chapterLimits[group.key] || 100) && (
                  <button
                    className="updates-more-chapters"
                    onClick={() => setChapterLimits(current => ({
                      ...current,
                      [group.key]: (current[group.key] || 100) + 100,
                    }))}
                  >
                    {translateMessage('Mostrar mais capítulos')}
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
      {groups.length > limit && (
        <button onClick={() => setLimit(limit + 30)}>
          Mostrar mais atualizações
        </button>
      )}
    </div>
  );
}
