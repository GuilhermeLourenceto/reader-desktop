const test = require('node:test');
const assert = require('node:assert/strict');
const { gridGeometry, virtualWindow } = require('../src/domain/virtualGrid.cjs');

test('virtual book grid mirrors responsive auto-fill columns', () => {
  assert.equal(gridGeometry(760, 'normal', 14, 20).columns, 5);
  assert.equal(gridGeometry(760, 'compact', 14, 20).columns, 5);
  assert.equal(gridGeometry(760, 'large', 14, 20).columns, 3);
  assert.equal(gridGeometry(260, 'normal', 10, 16).columns, 1);
});

test('deep scrolling keeps a small bounded DOM window and exact spacer height', () => {
  const layout = gridGeometry(760, 'normal', 14, 20);
  const count = 10000;
  const viewportHeight = 800;
  const step = layout.rowHeight + layout.rowGap;
  const first = virtualWindow(count, layout, 0, viewportHeight);
  const deep = virtualWindow(count, layout, step * 1500, viewportHeight);
  const last = virtualWindow(count, layout, step * 5000, viewportHeight);
  const totalRows = Math.ceil(count / layout.columns);
  assert.equal(first.start, 0);
  assert.ok(first.end < 100);
  assert.ok(deep.start > 0 && deep.end < count);
  assert.ok(deep.end - deep.start < 100);
  assert.ok(last.end === count);
  assert.equal(last.bottom, 0);
  assert.equal(last.totalRows, totalRows);
  const visibleRows = (deep.end - deep.start) / layout.columns;
  const measuredTotal = deep.top + deep.bottom + visibleRows * layout.rowHeight +
    (visibleRows + Number(deep.top > 0) + Number(deep.bottom > 0) - 1) * layout.rowGap;
  assert.equal(measuredTotal, totalRows * layout.rowHeight + (totalRows - 1) * layout.rowGap);
});

test('empty and tiny libraries keep valid ranges', () => {
  const layout = gridGeometry(800, 'normal', 14, 20);
  assert.deepEqual(virtualWindow(0, layout, 0, 700),
    { start: 0, end: 0, top: 0, bottom: 0, totalRows: 0 });
  assert.deepEqual(virtualWindow(1, layout, 0, 700).end, 1);
  const window = virtualWindow(12, layout, 999999, 700);
  assert.ok(window.start >= 0 && window.end <= 12 && window.end > window.start);
});
