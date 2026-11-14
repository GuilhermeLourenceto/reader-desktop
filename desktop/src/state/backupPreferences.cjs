// Translate only preferences that have the same meaning on Android and Desktop.
// Never substitute a default for an absent, unknown or platform-only value.
'use strict';

const { languages } = require('../locales.cjs');
const supportedLocales = new Set(languages.map(([code]) => code));
const paletteIds = [
  'default', 'midnight', 'teal', 'yotsuba', 'lavender',
  'strawberry', 'tako', 'catppuccin', 'yinyang',
];
// Original LNReader v2.1.4 useTheme.ts maps legacy palette IDs by light/dark mode.
const oldLight = { 1: 100, 8: 102, 9: 108, 10: 101, 12: 103,
  14: 104, 16: 105, 18: 106, 20: 107 };
const oldDark = { 2: 100, 9: 102, 10: 108, 11: 101, 13: 103,
  15: 104, 17: 105, 19: 106, 21: 107 };
const originalReaderThemes = [
  ['original-light', '#f5f5fa', '#111111'],
  ['original-sepia', '#F7DFC6', '#593100'],
  ['original-green', '#dce5e2', '#000000'],
  ['original-dark', '#292832', '#CCCCCC'],
  ['amoled', '#000000', '#FFFFFFB3'],
];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameColor = (a, b) => typeof a === 'string' &&
  typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

function parseObject(value) {
  if (isObject(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : null;
  } catch { return null; }
}

function androidPaletteId(value, mode) {
  const number = typeof value === 'number' ? value :
    (typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : NaN);
  if (!Number.isSafeInteger(number)) return null;
  if (number >= 100 && number <= 108) return number;
  if (mode === 'light') return oldLight[number] ?? null;
  if (mode === 'dark') return oldDark[number] ?? null;
  return null;
}

function fromAndroidPreferences(android) {
  if (!isObject(android)) return {};
  const result = {};
  // Empty locale means "follow Android device", not English or pt-BR.
  if (supportedLocales.has(android.APP_LOCALE))
    result.desktopInterfaceLanguage = android.APP_LOCALE;

  const mode = android.THEME_MODE;
  const amoled = android.AMOLED_BLACK;
  const validAmoled = amoled === undefined || typeof amoled === 'boolean';
  if (validAmoled) {
    if (mode === 'light') result.desktopTheme = 'light';
    if (mode === 'dark') result.desktopTheme = amoled === true ? 'oled' : 'dark';
    // Android supports system theme + AMOLED-at-night; Desktop cannot
    // represent both at once, so retain the user's Desktop appearance.
    if (mode === 'system' && amoled !== true)
      result.desktopTheme = 'system';
  }

  const themeId = androidPaletteId(android.APP_THEME_ID, mode);
  if (themeId !== null) result.desktopPalette = paletteIds[themeId - 100];

  const app = parseObject(android.APP_SETTINGS);
  if (app) {
    if (typeof app.incognitoMode === 'boolean')
      result.desktopIncognito = app.incognitoMode;
    if (typeof app.downloadedOnlyMode === 'boolean')
      result.desktopDownloadedOnly = app.downloadedOnlyMode;
  }

  const chapter = parseObject(android.CHAPTER_READER_SETTINGS);
  if (chapter) {
    if (chapter.textAlign === 'left' || chapter.textAlign === 'justify')
      result.desktopTextAlign = chapter.textAlign;
    if (chapter.fontFamily === 'pt-serif') result.desktopFontFamily = 'serif';
    if (chapter.fontFamily === 'noto-sans') result.desktopFontFamily = 'sans';
    if (typeof chapter.lineHeight === 'number' &&
        Number.isFinite(chapter.lineHeight) &&
        chapter.lineHeight >= 1.2 && chapter.lineHeight <= 2.6)
      result.desktopLineHeight = chapter.lineHeight;
    const match = originalReaderThemes.find(theme =>
      sameColor(chapter.theme, theme[1]) &&
      sameColor(chapter.textColor, theme[2]));
    if (match) result.desktopReaderTheme = match[0];
  }

  const general = parseObject(android.CHAPTER_GENERAL_SETTINGS);
  if (general && typeof general.pageReader === 'boolean')
    result.desktopPagination = general.pageReader ? 'pages' : 'scroll';

  // Android-only custom accents, fonts, dynamic themes, TTS and other
  // preferences stay in Setting.json; do not invent Desktop counterparts.
  return result;
}

function toAndroidPreferences(settings) {
  if (!isObject(settings)) return settings;
  const result = { ...settings };
  const canUpdate = (key, supports) => !own(settings, key) || supports(settings[key]);

  if (supportedLocales.has(settings.desktopInterfaceLanguage) &&
      canUpdate('APP_LOCALE', value => supportedLocales.has(value)))
    result.APP_LOCALE = settings.desktopInterfaceLanguage;

  const desktopMode = settings.desktopTheme;
  const validDesktopMode = ['light', 'dark', 'system', 'oled'].includes(desktopMode);
  const androidMode = settings.THEME_MODE;
  const androidAmoled = settings.AMOLED_BLACK;
  const unmatchedSystemAmoled = androidMode === 'system' && androidAmoled === true;
  if (validDesktopMode && !unmatchedSystemAmoled &&
      canUpdate('THEME_MODE', value => ['light', 'dark', 'system'].includes(value)) &&
      canUpdate('AMOLED_BLACK', value => typeof value === 'boolean')) {
    result.THEME_MODE = desktopMode === 'oled' ? 'dark' : desktopMode;
    if (desktopMode === 'oled') result.AMOLED_BLACK = true;
    if (desktopMode === 'dark') result.AMOLED_BLACK = false;
    // Light mode does not use AMOLED; system+AMOLED is unsupported by
    // Desktop. Never erase those existing Android-only preferences.
  }

  const paletteIndex = paletteIds.indexOf(settings.desktopPalette);
  if (paletteIndex >= 0 &&
      canUpdate('APP_THEME_ID', value =>
        androidPaletteId(value, settings.THEME_MODE) !== null))
    result.APP_THEME_ID = 100 + paletteIndex;

  const mergeJson = (key, apply) => {
    const exists = own(settings, key);
    const old = exists ? parseObject(settings[key]) : {};
    // Invalid Android data stays byte-for-byte untouched.
    if (!old) return;
    const updated = { ...old };
    apply(updated, old);
    if (JSON.stringify(updated) !== JSON.stringify(old))
      result[key] = JSON.stringify(updated);
  };
  const mergeValue = (target, old, key, value, supports) => {
    if (value !== undefined && (!own(old, key) || supports(old[key])))
      target[key] = value;
  };

  mergeJson('APP_SETTINGS', (target, old) => {
    mergeValue(target, old, 'incognitoMode', settings.desktopIncognito,
      value => typeof value === 'boolean',
    );
    mergeValue(target, old, 'downloadedOnlyMode', settings.desktopDownloadedOnly,
      value => typeof value === 'boolean',
    );
  });

  mergeJson('CHAPTER_READER_SETTINGS', (target, old) => {
    const align = settings.desktopTextAlign;
    mergeValue(target, old, 'textAlign',
      align === 'left' || align === 'justify' ? align : undefined,
      value => value === 'left' || value === 'justify');
    const family = { serif: 'pt-serif', sans: 'noto-sans' }[settings.desktopFontFamily];
    mergeValue(target, old, 'fontFamily', family,
      value => value === 'pt-serif' || value === 'noto-sans');
    const height = settings.desktopLineHeight;
    mergeValue(target, old, 'lineHeight',
      typeof height === 'number' && Number.isFinite(height) &&
      height >= 1.2 && height <= 2.6 ? height : undefined,
      value => typeof value === 'number' && Number.isFinite(value) &&
        value >= 1.2 && value <= 2.6);
    const theme = originalReaderThemes.find(item => item[0] === settings.desktopReaderTheme);
    const rawThemeIsPreset = originalReaderThemes.some(item =>
      sameColor(old.theme, item[1]) && sameColor(old.textColor, item[2]));
    // Custom Android color pairs have no editable Desktop equivalent.
    if (theme && ((!own(old, 'theme') && !own(old, 'textColor')) || rawThemeIsPreset)) {
      target.theme = theme[1];
      target.textColor = theme[2];
    }
  });

  mergeJson('CHAPTER_GENERAL_SETTINGS', (target, old) => {
    const pagination = settings.desktopPagination;
    mergeValue(target, old, 'pageReader',
      pagination === 'pages' ? true : pagination === 'scroll' ? false : undefined,
      value => typeof value === 'boolean');
  });

  return result;
}

module.exports = { fromAndroidPreferences, toAndroidPreferences };
