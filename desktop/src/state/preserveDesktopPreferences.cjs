// Preserve the user's last valid Desktop choices when a partial or invalid
// update arrives. Never replace a saved preference with a fallback value.
'use strict';

const { languages } = require('../locales.cjs');
const {
  READER_HIDE_DELAY_MIN,
  READER_HIDE_DELAY_MAX,
} = require('../domain/readerChromeDelay.cjs');

const options = {
  desktopInterfaceLanguage: languages.map(([code]) => code),
  desktopTheme: ['light', 'dark', 'system', 'oled'],
  desktopPalette: [
    'default', 'midnight', 'teal', 'yotsuba', 'lavender',
    'strawberry', 'tako', 'catppuccin', 'yinyang',
  ],
  desktopReaderTheme: [
    'app', 'dark', 'light', 'sepia', 'original-light',
    'original-sepia', 'original-green', 'original-dark', 'amoled',
  ],
  desktopFontFamily: ['serif', 'sans', 'system'],
  desktopTextAlign: ['left', 'justify'],
  desktopCoverSize: ['compact', 'normal', 'large'],
  desktopPagination: ['scroll', 'pages'],
  desktopBackupFrequency: ['off', 'launch', '6', '12', '24', '48', '168'],
};

const booleans = new Set([
  'desktopShowBadges', 'desktopShowChapterCount', 'desktopDownloadedOnly',
  'desktopIncognito', 'desktopReaderAutoHide',
  'desktopBackupIncludeDownloads', 'desktopOnboardingCompleted',
]);

const ranges = {
  desktopFontSize: [14, 40],
  desktopLineHeight: [1.2, 2.6],
  desktopReaderWidth: [500, 1200],
  desktopPageStep: [0, 100],
  desktopReaderHideDelay: [READER_HIDE_DELAY_MIN, READER_HIDE_DELAY_MAX],
};

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function isValidDesktopPreference(key, value) {
  if (own(options, key)) return options[key].includes(value);
  if (booleans.has(key)) return typeof value === 'boolean';
  if (own(ranges, key)) {
    const [min, max] = ranges[key];
    return typeof value === 'number' && Number.isFinite(value) &&
      value >= min && value <= max;
  }
  if (key === 'desktopBackupDirectory')
    return typeof value === 'string';
  // Old or future settings must not be erased just because this version
  // does not yet know their names.
  return true;
}

function preserveDesktopPreferences(previous, incoming) {
  if (!isObject(incoming)) return incoming;
  const saved = isObject(previous) ? previous : {};
  const settings = { ...saved, ...incoming };
  for (const [key, value] of Object.entries(incoming)) {
    if (!key.startsWith('desktop') || isValidDesktopPreference(key, value))
      continue;
    if (own(saved, key)) settings[key] = saved[key];
    else delete settings[key];
  }
  return settings;
}

module.exports = {
  isValidDesktopPreference,
  preserveDesktopPreferences,
};
