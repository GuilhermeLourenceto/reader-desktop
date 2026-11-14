const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  fromAndroidPreferences,
  toAndroidPreferences,
} = require('../src/state/backupPreferences.cjs');

test('Android language, Material 3 palette and AMOLED are mapped only when supported', () => {
  const incoming = {
    APP_LOCALE: 'pt-BR', THEME_MODE: 'dark', AMOLED_BLACK: true,
    APP_THEME_ID: 104,
  };
  const before = structuredClone(incoming);
  assert.deepEqual(fromAndroidPreferences(incoming), {
    desktopInterfaceLanguage: 'pt-BR', desktopTheme: 'oled',
    desktopPalette: 'lavender',
  });
  assert.deepEqual(incoming, before, 'the source backup must not be mutated');
});

test('every current Material 3 palette maps in both directions', () => {
  const ids = ['default', 'midnight', 'teal', 'yotsuba', 'lavender',
    'strawberry', 'tako', 'catppuccin', 'yinyang'];
  for (let i = 0; i < ids.length; i++) {
    assert.equal(fromAndroidPreferences({ APP_THEME_ID: 100 + i }).desktopPalette, ids[i]);
    assert.equal(toAndroidPreferences({ desktopPalette: ids[i] }).APP_THEME_ID, 100 + i);
  }
  assert.equal(fromAndroidPreferences({ THEME_MODE: 'light', APP_THEME_ID: 14 }).desktopPalette, 'lavender');
  assert.equal(fromAndroidPreferences({ THEME_MODE: 'dark', APP_THEME_ID: 15 }).desktopPalette, 'lavender');
});

test('an absent or unsupported Android preference never creates a Desktop default', () => {
  assert.deepEqual(fromAndroidPreferences({}), {});
  assert.deepEqual(fromAndroidPreferences({
    APP_LOCALE: '', THEME_MODE: 'future-mode', APP_THEME_ID: -1,
    CUSTOM_ACCENT_COLOR: '#aabbcc',
    CHAPTER_READER_SETTINGS: '{bad json',
    CHAPTER_GENERAL_SETTINGS: '{"pageReader":"yes"}',
    APP_SETTINGS: '{"incognitoMode":"false"}',
  }), {});
  assert.deepEqual(fromAndroidPreferences({
    APP_LOCALE: 'pt', THEME_MODE: 'system', AMOLED_BLACK: true,
    APP_THEME_ID: 9,
  }), {}, 'system+AMOLED and legacy ambiguous palette are not representable');
});

test('Android reader settings transfer only exact equivalents, never Desktop toolbar controls', () => {
  const source = {
    APP_SETTINGS: JSON.stringify({ incognitoMode: true, downloadedOnlyMode: false,
      downloadNewChapters: true }),
    CHAPTER_READER_SETTINGS: JSON.stringify({
      textAlign: 'justify', fontFamily: 'noto-sans',
      lineHeight: 2.1, theme: '#292832', textColor: '#cccccc',
      tts: { rate: 1.2 },
    }),
    CHAPTER_GENERAL_SETTINGS: JSON.stringify({ pageReader: true, swipeGestures: true }),
  };
  assert.deepEqual(fromAndroidPreferences(source), {
    desktopIncognito: true, desktopDownloadedOnly: false,
    desktopTextAlign: 'justify', desktopFontFamily: 'sans',
    desktopLineHeight: 2.1, desktopReaderTheme: 'original-dark',
    desktopPagination: 'pages',
  });
  const unsupported = fromAndroidPreferences({
    CHAPTER_READER_SETTINGS: JSON.stringify({
      theme: '#129947', textColor: '#eeddaa', fontFamily: 'lora',
      textAlign: 'center', lineHeight: 5, textSize: 14,
    }),
  });
  assert.deepEqual(unsupported, {});
});

test('Desktop export provides only genuine Android equivalents', () => {
  const settings = {
    desktopInterfaceLanguage: 'ja', desktopTheme: 'oled',
    desktopPalette: 'lavender', desktopReaderTheme: 'original-dark',
    desktopTextAlign: 'justify', desktopFontFamily: 'sans',
    desktopLineHeight: 1.7, desktopPagination: 'pages',
    desktopIncognito: true, desktopDownloadedOnly: false,
    desktopReaderAutoHide: false, desktopReaderHideDelay: 7.4,
    APP_SETTINGS: JSON.stringify({ timeTrackingEnabled: true }),
    CHAPTER_READER_SETTINGS: JSON.stringify({ customCSS: 'body{}' }),
  };
  const original = structuredClone(settings);
  const exported = toAndroidPreferences(settings);
  assert.equal(exported.APP_LOCALE, 'ja');
  assert.equal(exported.THEME_MODE, 'dark');
  assert.equal(exported.AMOLED_BLACK, true);
  assert.equal(exported.APP_THEME_ID, 104);
  assert.deepEqual(JSON.parse(exported.APP_SETTINGS), {
    timeTrackingEnabled: true, incognitoMode: true, downloadedOnlyMode: false,
  });
  assert.deepEqual(JSON.parse(exported.CHAPTER_READER_SETTINGS), {
    customCSS: 'body{}', textAlign: 'justify', fontFamily: 'noto-sans',
    lineHeight: 1.7, theme: '#292832', textColor: '#CCCCCC',
  });
  assert.deepEqual(JSON.parse(exported.CHAPTER_GENERAL_SETTINGS), { pageReader: true });
  assert.equal(exported.desktopReaderAutoHide, false);
  assert.equal(exported.desktopReaderHideDelay, 7.4);
  assert.deepEqual(settings, original);
});

test('unrecognized Android values survive a Desktop export unchanged', () => {
  const settings = {
    APP_LOCALE: 'pt', // Portuguese (Portugal) is not the Desktop pt-BR locale.
    APP_THEME_ID: -1, // Android wallpaper dynamic colors.
    THEME_MODE: 'system', AMOLED_BLACK: true,
    CUSTOM_ACCENT_COLOR: '#123abc',
    APP_SETTINGS: '{malformed:',
    CHAPTER_READER_SETTINGS: JSON.stringify({
      theme: '#123456', textColor: '#f0dede',
      fontFamily: 'lora', lineHeight: 4, customJS: 'console.log(1)',
    }),
    desktopInterfaceLanguage: 'en', desktopPalette: 'teal',
    desktopTheme: 'dark', desktopReaderTheme: 'original-light',
    desktopFontFamily: 'serif', desktopLineHeight: 1.8,
    desktopReaderAutoHide: true, desktopReaderHideDelay: 9.6,
  };
  const exported = toAndroidPreferences(settings);
  for (const key of ['APP_LOCALE','APP_THEME_ID','THEME_MODE','AMOLED_BLACK',
    'CUSTOM_ACCENT_COLOR','APP_SETTINGS','CHAPTER_READER_SETTINGS'])
    assert.deepEqual(exported[key], settings[key], key + ' must remain unchanged');
  assert.equal(exported.desktopReaderAutoHide, true);
  assert.equal(exported.desktopReaderHideDelay, 9.6);
});

test('absence of a Desktop counterpart never creates Android settings', () => {
  const values = { desktopReaderAutoHide: false, desktopReaderHideDelay: 3.4,
    CUSTOM_ACCENT_COLOR: '#ffbc00' };
  assert.deepEqual(toAndroidPreferences(values), values);
});

test('invalid JSON and unrepresentable Android reader themes remain unchanged', () => {
  const input = {
    APP_SETTINGS: 'not JSON',
    CHAPTER_GENERAL_SETTINGS: '[]',
    CHAPTER_READER_SETTINGS: JSON.stringify({
      theme: '#010203', textColor: '#abcdef', fontFamily: 'arbutus-slab',
    }),
    desktopIncognito: false, desktopPagination: 'scroll',
    desktopReaderTheme: 'original-sepia', desktopFontFamily: 'sans',
  };
  const result = toAndroidPreferences(input);
  assert.equal(result.APP_SETTINGS, 'not JSON');
  assert.equal(result.CHAPTER_GENERAL_SETTINGS, '[]');
  assert.equal(result.CHAPTER_READER_SETTINGS, input.CHAPTER_READER_SETTINGS);
});

test('desktop settings exported to Android can be mapped back without using fallbacks', () => {
  const source = {
    desktopInterfaceLanguage: 'fr', desktopTheme: 'light',
    desktopPalette: 'strawberry', desktopPagination: 'scroll',
    desktopReaderTheme: 'original-green',
  };
  const exported = toAndroidPreferences(source);
  assert.deepEqual(fromAndroidPreferences(exported), {
    desktopInterfaceLanguage: 'fr',
    desktopTheme: 'light',
    desktopPalette: 'strawberry',
    desktopPagination: 'scroll',
    desktopReaderTheme: 'original-green',
  });
});
