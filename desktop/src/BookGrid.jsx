import React from 'react';
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
}) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(auto-fill,minmax(${
          { compact: 116, normal: 140, large: 185 }[
            settings.desktopCoverSize
          ] || 140
        }px,1fr))`,
      }}
    >
      {items.map(item => (
        <div
          className={`book-card ${
            selected.includes(item.id) ? 'is-selected' : ''
          }`}
          key={`${item.pluginId || pluginId}:${item.path}`}
          onContextMenu={
            onContext
              ? event => {
                  event.preventDefault();
                  onContext(item, event.clientX, event.clientY);
                }
              : undefined
          }
        >
          <button
            className="book"
            disabled={busy}
            aria-pressed={onToggle ? selected.includes(item.id) : undefined}
            onClick={() =>
              selected.length && onToggle
                ? onToggle(item.id)
                : onOpen(item, item.pluginId || pluginId)
            }
            onKeyDown={
              onContext
                ? event => {
                    if (
                      event.key === 'ContextMenu' ||
                      (event.shiftKey && event.key === 'F10')
                    ) {
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      onContext(item, rect.left + 20, rect.top + 30);
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
                  {item.chapters.some(chapter => chapter.isDownloaded) && (
                    <span className="download-badge" title="Capítulos baixados">
                      {
                        item.chapters.filter(chapter => chapter.isDownloaded)
                          .length
                      }
                    </span>
                  )}
                  {item.chapters.some(chapter => chapter.unread !== false) && (
                    <span className="unread-badge" title="Capítulos não lidos">
                      {
                        item.chapters.filter(
                          chapter => chapter.unread !== false,
                        ).length
                      }
                    </span>
                  )}
                </div>
              )}
            </div>
            <strong>{item.name}</strong>
            {item.chapters && settings.desktopShowChapterCount !== false && (
              <small>
                {
                  item.chapters.filter(chapter => chapter.unread !== false)
                    .length
                }{' '}
                não lidos · {item.chapters.length} capítulos
              </small>
            )}
          </button>
          {onToggle && (
            <input
              className="book-select"
              type="checkbox"
              aria-label={`Selecionar obra: ${item.name}`}
              checked={selected.includes(item.id)}
              onChange={() => onToggle(item.id)}
              disabled={busy}
            />
          )}
        </div>
      ))}
    </div>
  );
}
