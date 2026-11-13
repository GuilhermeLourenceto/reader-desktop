import React, { useLayoutEffect, useRef, useState } from 'react';
import BookGrid from './BookGrid';
import { gridGeometry, virtualWindow } from '../../domain/virtualGrid.cjs';

// The parent <main> remains the only scroll container: no nested scrollbars,
// no changes to category/search/selection behavior, and no extra dependencies.
export default function VirtualBookGrid({
  items,
  settings,
  scrollContainerRef,
  ...cardProps
}) {
  const gridRef = useRef(null);
  const [range, setRange] = useState(null);
  const virtualized = items.length > 100;

  useLayoutEffect(() => {
    if (!virtualized) return;
    const grid = gridRef.current;
    // A child layout effect can run before the parent's ref is attached.
    // The ancestor DOM node already exists, so resolve it directly on mount.
    const scroll = scrollContainerRef?.current || grid?.closest('main');
    if (!scroll || !grid) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!grid.isConnected) return;
      const css = getComputedStyle(grid);
      const geometry = gridGeometry(
        grid.clientWidth,
        settings.desktopCoverSize,
        parseFloat(css.columnGap),
        parseFloat(css.rowGap),
      );
      const top = Math.max(
        0,
        scroll.getBoundingClientRect().top - grid.getBoundingClientRect().top,
      );
      const next = {
        ...virtualWindow(items.length, geometry, top, scroll.clientHeight),
        rowHeight: geometry.rowHeight,
        columns: geometry.columns,
      };
      setRange((old) => {
        if (
          old &&
          Object.keys(next).every((key) => old[key] === next[key])
        ) return old;
        return next;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    scroll.addEventListener('scroll', schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(scroll);
    resize.observe(grid);
    window.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule).catch(() => {});
    return () => {
      scroll.removeEventListener('scroll', schedule);
      resize.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [virtualized, items.length, scrollContainerRef, settings.desktopCoverSize]);

  // Before the first DOM measurement only a handful of cards are created.
  // Small libraries keep the original grid, with no placeholders.
  const visible = virtualized
    ? items.slice(range?.start || 0, range?.end || 24)
    : items;
  return (
    <BookGrid
      {...cardProps}
      items={visible}
      settings={settings}
      gridRef={gridRef}
      virtualized={virtualized && !!range}
      rowHeight={range?.rowHeight}
      before={range?.top || 0}
      after={range?.bottom || 0}
    />
  );
}
