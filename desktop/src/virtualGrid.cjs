// Pure geometry for the desktop library's virtualized, responsive CSS grid.
// Book cards reserve up to two lines each for titles and chapter counters.
const COVER_MIN_WIDTH = { compact: 116, normal: 140, large: 185 };
const CARD_TEXT_HEIGHT = 86;

function gridGeometry(width, size, columnGap, rowGap) {
  const minWidth = COVER_MIN_WIDTH[size] || 140;
  const usableWidth = Math.max(1, Number(width) || 1);
  const xGap = Math.max(0, Number(columnGap) || 0);
  const yGap = Math.max(0, Number(rowGap) || 0);
  const columns = Math.max(1, Math.floor((usableWidth + xGap) / (minWidth + xGap)));
  const cardWidth = (usableWidth - xGap * (columns - 1)) / columns;
  const rowHeight = Math.ceil(Math.max(1, cardWidth) * 1.5 + CARD_TEXT_HEIGHT);
  return { columns, rowHeight, rowGap: yGap };
}

function virtualWindow(count, layout, viewportTop, viewportHeight, overscan = 3) {
  const total = Math.max(0, Math.floor(count));
  const columns = Math.max(1, layout.columns);
  const totalRows = Math.ceil(total / columns);
  const step = layout.rowHeight + layout.rowGap;
  if (!totalRows || step <= 0) {
    return { start: 0, end: 0, top: 0, bottom: 0, totalRows };
  }
  const firstVisible = Math.max(0, Math.floor(Math.max(0, viewportTop) / step));
  const lastVisible = Math.max(
    firstVisible + 1,
    Math.ceil((Math.max(0, viewportTop) + Math.max(1, viewportHeight)) / step),
  );
  const startRow = Math.min(totalRows - 1, Math.max(0, firstVisible - overscan));
  const endRow = Math.min(totalRows, Math.max(startRow + 1, lastVisible + overscan));
  const hiddenAfter = totalRows - endRow;
  return {
    start: startRow * columns,
    end: Math.min(total, endRow * columns),
    top: startRow ? startRow * step - layout.rowGap : 0,
    bottom: hiddenAfter ? hiddenAfter * step - layout.rowGap : 0,
    totalRows,
  };
}

module.exports = { gridGeometry, virtualWindow };
