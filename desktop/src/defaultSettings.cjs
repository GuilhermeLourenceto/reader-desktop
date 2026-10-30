// Only desktop display and reading preferences are reset. Library, progress,
// installed sources, source settings and unrelated imported backup data survive.
const DEFAULT_DESKTOP_SETTINGS = Object.freeze({
  desktopInterfaceLanguage: 'pt-BR',
  desktopTheme: 'dark',
  desktopPalette: 'default',
  desktopCoverSize: 'normal',
  desktopShowBadges: true,
  desktopShowChapterCount: true,
  desktopDownloadedOnly: false,
  desktopIncognito: false,
  desktopFontFamily: 'serif',
  desktopFontSize: 21,
  desktopLineHeight: 1.85,
  desktopReaderWidth: 820,
  desktopTextAlign: 'left',
  desktopReaderTheme: 'app',
  desktopPagination: 'scroll',
  desktopPageStep: 50,
  desktopReaderAutoHide: true,
});

function restoreDesktopDefaults(settings = {}) {
  return { ...settings, ...DEFAULT_DESKTOP_SETTINGS };
}

module.exports = { DEFAULT_DESKTOP_SETTINGS, restoreDesktopDefaults };
