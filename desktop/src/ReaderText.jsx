import React, { useLayoutEffect, useRef, useState } from 'react';
import { readerThemes } from './readerThemes.js';
export function readerPresentation(settings = {}) {
  const theme = readerThemes.find(
    theme => theme.id === settings.desktopReaderTheme,
  );
  return {
    surface: theme?.backgroundColor
      ? {
          '--readerBackground': theme.backgroundColor,
          '--readerText': theme.textColor,
        }
      : undefined,
    article: {
      fontSize: settings.desktopFontSize || 21,
      fontFamily:
        {
          serif: "'PT Serif', Georgia, serif",
          sans: "'Noto Sans', sans-serif",
          system: 'system-ui, sans-serif',
        }[settings.desktopFontFamily] || "'PT Serif', Georgia, serif",
      lineHeight: settings.desktopLineHeight || 1.85,
      maxWidth: settings.desktopReaderWidth || 820,
      textAlign: settings.desktopTextAlign || 'left',
    },
  };
}
export default function ReaderText({
  settings,
  html,
  paged = false,
  onLayout,
  layoutKey,
}) {
  const article = readerPresentation(settings).article;
  const textRef = useRef(null);
  const trackRef = useRef(null);
  const callback = useRef(onLayout);
  callback.current = onLayout;
  const [layout, setLayout] = useState(() => ({
    viewport: innerWidth,
    height: innerHeight,
    width: Math.min(
      Number(settings.desktopReaderWidth) || 820,
      innerWidth - 48,
    ),
    pages: 1,
  }));
  useLayoutEffect(() => {
    const text = textRef.current;
    const viewport = paged
      ? trackRef.current?.parentElement
      : text?.parentElement;
    if (!text || !viewport) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      if (paged) {
        const width = viewport.clientWidth;
        const height = viewport.clientHeight;
        if (width < 1 || height < 1) return;
        const column = Math.max(
          1,
          Math.min(Number(settings.desktopReaderWidth) || 820, width - 48),
        );
        const pages = Math.max(
          1,
          Math.ceil(
            (text.scrollWidth + width - column - 1) / Math.max(1, width),
          ),
        );
        setLayout(previous =>
          previous.viewport === width &&
          previous.height === height &&
          previous.width === column &&
          previous.pages === pages
            ? previous
            : { viewport: width, height, width: column, pages },
        );
      }
      if (!paged)
        queueMicrotask(() => {
          if (alive)
            document.fonts.ready.then(() => {
              if (alive) callback.current?.();
            });
        });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(text);
    text.addEventListener('load', measure, true);
    document.fonts.ready.then(measure);
    measure();
    return () => {
      alive = false;
      observer.disconnect();
      text.removeEventListener('load', measure, true);
    };
  }, [
    html,
    layoutKey,
    paged,
    settings.desktopReaderWidth,
    settings.desktopFontSize,
    settings.desktopFontFamily,
    settings.desktopLineHeight,
    settings.desktopTextAlign,
  ]);
  useLayoutEffect(() => {
    if (!paged || !textRef.current) return;
    const gap = layout.viewport - layout.width;
    const pages = Math.max(
      1,
      Math.ceil(
        (textRef.current.scrollWidth + gap - 1) / Math.max(1, layout.viewport),
      ),
    );
    if (pages !== layout.pages) setLayout(previous => ({ ...previous, pages }));
    else {
      const viewport = trackRef.current?.parentElement;
      if (
        viewport?.clientWidth === layout.viewport &&
        viewport?.clientHeight === layout.height
      ) {
        let valid = true;
        document.fonts.ready.then(() => {
          if (valid) callback.current?.();
        });
        return () => {
          valid = false;
        };
      }
    }
  }, [layout, paged, layoutKey]);
  const content = (
    <article
      ref={textRef}
      className={paged ? 'reader-page-flow' : undefined}
      style={
        paged
          ? {
              ...article,
              maxWidth: 'none',
              width: layout.width,
              height: Math.max(1, layout.height - 48),
              left: (layout.viewport - layout.width) / 2,
              columnWidth: layout.width,
              columnGap: layout.viewport - layout.width,
              '--page-height': `${Math.max(1, layout.height - 48)}px`,
            }
          : article
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
  if (paged)
    return (
      <div
        ref={trackRef}
        className="reader-pages-track"
        style={{ width: layout.pages * layout.viewport }}
      >
        {content}
      </div>
    );
  return content;
}
