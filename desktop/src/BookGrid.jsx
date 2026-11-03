import { t as translateMessage } from './i18n.cjs';
import { t } from './i18n.cjs';
import React, { useMemo } from 'react';
import { countChapterStatuses } from './libraryPerf.cjs';
export default function BookGrid({
  items,
  pluginId,
  settings,
  cover,
  Icon,
  busy,
  onOpen,
  selected = [],
  onToggle,
  onContext,
  hideSelectionCheckbox = false,
  gridRef,
  virtualized = false,
  rowHeight,
  before = 0,
  after = 0,
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  // Count each card's chapter flags only once per render. The virtual grid
  // already limits this work to the cards currently on screen.
  const chapterCounts =
    settings.desktopShowBadges === false &&
    settings.desktopShowChapterCount === false
      ? []
      : items.map((item) =>
          item.chapters ? countChapterStatuses(item.chapters) : null,
        );
  return (
    <div
      ref={gridRef}
      className={virtualized ? 'grid grid-virtualized' : 'grid'}
      data-virtualized={virtualized ? 'true' : undefined}
      style={{
        ...(virtualized ? { '--virtual-row-height': String(rowHeight) + 'px' } : {}),
        gridTemplateColumns: `repeat(auto-fill,minmax(${
          { compact: 116, normal: 140, large: 185 }[
            settings.desktopCoverSize
          ] || 140
        }px,1fr))`,
      }}
    >
      {virtualized && before > 0 && (
        <div className="virtual-grid-spacer" aria-hidden="true" style={{ height: before }} />
      )}
      {items.map((item, index) => (
        <div
          className={`book-card ${
            selectedSet.has(item.id) ? 'is-selected' : ''
          }`}
          key={`${item.pluginId || pluginId}:${item.path}`}
          onContextMenu={
            onContext
              ? (event) => {
                  event.preventDefault();
                  onContext(item, event.clientX, event.clientY, event.currentTarget.querySelector('.book'));
                }
              : undefined
          }
        >
          <button
            className="book"
            disabled={busy}
            aria-pressed={onToggle ? selectedSet.has(item.id) : undefined}
            onClick={(event) => {
              if (
                onToggle &&
                (selected.length > 0 || event.ctrlKey || event.metaKey || event.shiftKey)
              ) {
                onToggle(item.id, event);
              } else {
                onOpen(item, item.pluginId || pluginId);
              }
            }}
            onKeyDown={
              onContext
                ? (event) => {
                    if (
                      event.key === 'ContextMenu' ||
                      (event.shiftKey && event.key === 'F10')
                    ) {
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      onContext(item, rect.left + 20, rect.top + 30, event.currentTarget);
                    }
                  }
                : undefined
            }
          >
            <div className="cover-wrap">
              {cover(item) ? (
                <img src={cover(item)} alt="" loading="lazy" />
              ) : (
                <div className="placeholder">
                  <Icon name="book" />
                </div>
              )}
              {item.chapters && settings.desktopShowBadges !== false && (
                <div className="badges">
                  {chapterCounts[index]?.downloaded > 0 && (
                    <span className="download-badge" title="Capítulos baixados">
                      {chapterCounts[index].downloaded}
                    </span>
                  )}
                  {chapterCounts[index]?.unread > 0 && (
                    <span className="unread-badge" title="Capítulos não lidos">
                      {chapterCounts[index].unread}
                    </span>
                  )}
                </div>
              )}
            </div>
            <strong>{item.name}</strong>
            {item.chapters && settings.desktopShowChapterCount !== false && (
              <small>
                {t('Capítulos: {total} · Não lidos: {unread}', {
                  total: item.chapters.length,
                  unread: chapterCounts[index].unread,
                })}
              </small>
            )}
          </button>
          {onToggle && !hideSelectionCheckbox && (
            <input
              className="book-select"
              type="checkbox"
              aria-label={translateMessage('Selecionar obra: {v0}', {
                v0: item.name,
              })}
              checked={selectedSet.has(item.id)}
              onChange={() => onToggle(item.id)}
              disabled={busy}
            />
          )}
        </div>
      ))}
      {virtualized && after > 0 && (
        <div className="virtual-grid-spacer" aria-hidden="true" style={{ height: after }} />
      )}
    </div>
  );
}
