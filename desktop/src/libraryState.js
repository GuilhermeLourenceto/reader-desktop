import { INSTALLED_PLUGINS_KEY } from '../vendor/lnreader/src/plugins/constants';
import { setLocale } from './i18n.cjs';

export function hydrate(state) {
  setLocale(state.settings?.desktopInterfaceLanguage);
  for (const key of Object.keys(localStorage))
    if (key.startsWith('plugin_db:')) localStorage.removeItem(key);
  localStorage.setItem(INSTALLED_PLUGINS_KEY, JSON.stringify(state.plugins));
  localStorage.setItem('repositories', JSON.stringify(state.repositories));
  for (const [key, value] of Object.entries(state.pluginStorage || {})) {
    try {
      localStorage.setItem(key, value);
    } catch {
      window.dispatchEvent(
        new CustomEvent('notice', {
          detail:
            'O cache das fontes excedeu o espaço disponível. Parte do cache será refeita pelas fontes.',
        }),
      );
      break;
    }
  }
}
export function snapshot(state) {
  const { files: _files, ...metadata } = state;
  return {
    ...metadata,
    plugins: JSON.parse(localStorage.getItem(INSTALLED_PLUGINS_KEY) || '[]'),
    repositories: JSON.parse(localStorage.getItem('repositories') || '[]'),
    pluginStorage: Object.fromEntries(
      Object.entries(localStorage).filter(([key]) =>
        key.startsWith('plugin_db:'),
      ),
    ),
  };
}
export const nextId = (items) => {
  const id = items.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
  if (!Number.isSafeInteger(id))
    throw new Error(
      'O identificador dos dados ultrapassou o limite suportado.',
    );
  return id;
};
export const fileKey = (novel, chapter) =>
  `Novels/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`;
export const loadedPages = (novel) => [
  ...new Set([
    ...(novel.desktopLoadedPages || []),
    ...novel.chapters.map((chapter) => Number(chapter.page || 1)),
  ]),
];
export const nextNovelPage = (novel) =>
  Array.from(
    { length: Number(novel.totalPages || 1) },
    (_, index) => index + 1,
  ).find((page) => !loadedPages(novel).includes(page));
