import React from 'react';

export default function Icon({ name, ...props }) {
  const paths = {
    updates:
      'M12 4a8 8 0 0 1 8 8h3l-4 4-4-4h3a6 6 0 0 0-6-6V4m-7 4 4 4H6a6 6 0 0 0 6 6v2a8 8 0 0 1-8-8H1l4-4Z',
    library:
      'M4 6H2v14a2 2 0 0 0 2 2h14v-2H4V6m16-4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2m-2 12-4-2-4 2V4h8v10Z',
    sources:
      'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16m5.5-13.5-8 3-3 8 8-3 3-8m-5.5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
    settings:
      'M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
    search:
      'M9.5 3a6.5 6.5 0 1 0 3.97 11.65L19.82 21 21 19.82l-6.35-6.35A6.5 6.5 0 0 0 9.5 3m0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z',
    filter: 'M3 5h18v2H3V5m3 6h12v2H6v-2m4 6h4v2h-4v-2Z',
    book: 'M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2m-2 12-4-3-4 3V4h8v10Z',
    backup:
      'M19 11h-1.26A6 6 0 0 0 6.1 9.03 5 5 0 0 0 6 19h13a4 4 0 0 0 0-8m-6 1v5h-2v-5H8l4-4 4 4h-3Z',
    back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2Z',
    next: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4v-2Z',
    history:
      'M13 3a9 9 0 0 0-9 8H1l4 4 4-4H6a7 7 0 1 1 2 6l-1.4 1.4A9 9 0 1 0 13 3m-1 4v6l5 3 1-1.6-4-2.4V7h-2Z',
    trash:
      'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12M8 9h2v10H8V9m6 0h2v10h-2V9m1-6-1-1h-4L9 3H4v2h16V3h-5Z',
    check: 'm9 16.2-4.2-4.2L3.4 13.4 9 19 21 7l-1.4-1.4L9 16.2Z',
    unread:
      'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z',
    bookmark: 'M6 2h12v20l-6-4-6 4V2m2 2v14l4-2.7 4 2.7V4H8Z',
    download:
      'M11 3h2v9l3.5-3.5L18 10l-6 6-6-6 1.5-1.5L11 12V3M4 18h16v3H4v-3Z',
    refresh:
      'M17.6 6.4A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h8V3l-3.4 3.4Z',
    heart:
      'M12 21 3.5 12.5a5.5 5.5 0 0 1 8-7.5l.5.5.5-.5a5.5 5.5 0 0 1 8 7.5L12 21Z',
    play: 'M8 4v16l12-8L8 4Z',
    tune: 'M3 6h10v2H3V6m14 0h4v2h-4V6M3 16h4v2H3v-2m8 0h10v2H11v-2M13 3h4v8h-4V3M7 13h4v8H7v-8Z',
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon" {...props}>
      <path d={paths[name] || paths.book} />
    </svg>
  );
}
