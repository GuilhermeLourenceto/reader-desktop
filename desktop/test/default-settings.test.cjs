const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_DESKTOP_SETTINGS, restoreDesktopDefaults } = require('../src/defaultSettings.cjs');
const { validateState } = require('../src/storage.cjs');

test('restore only desktop preferences, preserving unrelated settings and original input', () => {
  const old = { desktopTheme: 'light', desktopFontSize: 37, desktopPageStep: 90,
    desktopIncognito: true, desktopShowBadges: false, pluginLanguage: 'ja',
    readerOrientation: 'rtl' };
  const next = restoreDesktopDefaults(old);
  assert.deepEqual(next, { ...old, ...DEFAULT_DESKTOP_SETTINGS });
  assert.equal(next.desktopPageStep, 50);
  assert.equal(next.desktopShowBadges, true);
  assert.equal(next.desktopInterfaceLanguage, 'pt-BR');
  assert.equal(next.pluginLanguage, 'ja');
  assert.equal(next.readerOrientation, 'rtl');
  assert.equal(old.desktopFontSize, 37);
  const state = { novels: [], plugins: [], settings: next };
  assert.equal(validateState(state).settings.desktopFontSize, 21);
});

test('restoration is idempotent and does not mutate caller values', () => {
  const first = restoreDesktopDefaults();
  const second = restoreDesktopDefaults(first);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
});
