const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidDesktopPreference,
  preserveDesktopPreferences,
} = require('../src/state/preserveDesktopPreferences.cjs');

const current = () => ({
  desktopInterfaceLanguage: 'pt-BR',
  desktopTheme: 'oled',
  desktopPalette: 'lavender',
  desktopReaderTheme: 'original-dark',
  desktopFontFamily: 'sans',
  desktopTextAlign: 'justify',
  desktopPagination: 'pages',
  desktopReaderAutoHide: false,
  desktopReaderHideDelay: 8.4,
  desktopFontSize: 24,
  desktopLineHeight: 2.1,
  desktopReaderWidth: 860,
  desktopPageStep: 60,
  desktopDownloadedOnly: true,
  desktopIncognito: false,
  desktopShowBadges: false,
  desktopShowChapterCount: true,
  desktopBackupDirectory: '/backups',
  desktopBackupIncludeDownloads: false,
  desktopOnboardingCompleted: true,
  desktopBackupFrequency: '24',
  APP_LOCALE: 'pt-BR',
  CUSTOM_ACCENT_COLOR: '#abcdef',
});

test('invalid update values cannot reset any existing Desktop preference', () => {
  const before = current();
  const malformed = {
    desktopInterfaceLanguage: 'nonsense',
    desktopTheme: 'unknown',
    desktopPalette: 'missing-palette',
    desktopReaderTheme: 'custom-background',
    desktopFontFamily: 'not-a-font',
    desktopTextAlign: 'center',
    desktopPagination: 'unknown',
    desktopReaderAutoHide: null,
    desktopReaderHideDelay: -50,
    desktopFontSize: 1000,
    desktopLineHeight: Number.NaN,
    desktopReaderWidth: Infinity,
    desktopPageStep: -1,
    desktopDownloadedOnly: 'false',
    desktopIncognito: undefined,
    desktopShowBadges: 0,
    desktopShowChapterCount: 'true',
    desktopBackupDirectory: false,
    desktopBackupFrequency: 'never',
    desktopBackupIncludeDownloads: 'no',
    desktopOnboardingCompleted: 'true',
  };
  const original = { ...before };
  const after = preserveDesktopPreferences(before, malformed);
  for (const key of Object.keys(malformed))
    assert.equal(after[key], before[key], key);
  assert.deepEqual(before, original);
  assert.equal(after.APP_LOCALE, 'pt-BR');
  assert.equal(after.CUSTOM_ACCENT_COLOR, '#abcdef');
});

test('missing fields do not remove the user settings during partial saves', () => {
  const before = current();
  const after = preserveDesktopPreferences(before, {
    desktopFontSize: 28,
    customImportedPreference: { enabled: true },
  });
  assert.equal(after.desktopFontSize, 28);
  for (const [key, value] of Object.entries(before))
    if (key !== 'desktopFontSize') assert.deepEqual(after[key], value, key);
  assert.deepEqual(after.customImportedPreference, { enabled: true });
});

test('valid user choices are accepted including explicit English and false', () => {
  const after = preserveDesktopPreferences(current(), {
    desktopInterfaceLanguage: 'en', desktopTheme: 'light',
    desktopReaderAutoHide: true, desktopDownloadedOnly: false,
    desktopReaderHideDelay: 2.6, desktopPagination: 'scroll',
  });
  assert.equal(after.desktopInterfaceLanguage, 'en');
  assert.equal(after.desktopTheme, 'light');
  assert.equal(after.desktopReaderAutoHide, true);
  assert.equal(after.desktopDownloadedOnly, false);
  assert.equal(after.desktopReaderHideDelay, 2.6);
  assert.equal(after.desktopPagination, 'scroll');
});

test('unknown future preferences are preserved, not silently discarded', () => {
  const before = current();
  const after = preserveDesktopPreferences(before, {
    desktopFutureControl: { mode: 'new' },
  });
  assert.deepEqual(after.desktopFutureControl, { mode: 'new' });
  assert.equal(after.desktopInterfaceLanguage, before.desktopInterfaceLanguage);
  assert.deepEqual(before, current());
});

test('invalid preference with no saved counterpart does not create a default', () => {
  const after = preserveDesktopPreferences({}, {
    desktopInterfaceLanguage: 'invalid',
    desktopReaderHideDelay: -1,
    desktopTheme: 'invalid',
    desktopPalette: 'missing',
    desktopReaderAutoHide: undefined,
    desktopPagination: 'missing',
    APP_SETTINGS: '{"unknown":"value"}',
  });
  assert.deepEqual(after, { APP_SETTINGS: '{"unknown":"value"}' });
});

test('validators reject unsupported values without affecting fresh-install defaults', () => {
  assert.equal(isValidDesktopPreference('desktopInterfaceLanguage', 'pt-BR'), true);
  assert.equal(isValidDesktopPreference('desktopInterfaceLanguage', 'xx'), false);
  assert.equal(isValidDesktopPreference('desktopReaderTheme', 'amoled'), true);
  assert.equal(isValidDesktopPreference('desktopReaderTheme', ''), false);
  assert.equal(isValidDesktopPreference('desktopLineHeight', 1.2), true);
  assert.equal(isValidDesktopPreference('desktopLineHeight', 2.6), true);
  assert.equal(isValidDesktopPreference('desktopLineHeight', 0), false);
  assert.equal(isValidDesktopPreference('desktopReaderAutoHide', false), true);
  assert.equal(isValidDesktopPreference('desktopReaderAutoHide', 'false'), false);
});
