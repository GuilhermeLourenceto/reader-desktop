const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_DESKTOP_SETTINGS, restoreDesktopDefaults } = require('../src/defaultSettings.cjs');
const { validateState } = require('../src/storage.cjs');

test('restore only desktop preferences, preserving unrelated settings and original input', () => {
  const old = { desktopInterfaceLanguage: 'pt-BR', desktopTheme: 'light', desktopFontSize: 37, desktopPageStep: 90,
    desktopIncognito: true, desktopShowBadges: false, pluginLanguage: 'ja',
    readerOrientation: 'rtl' };
  const next = restoreDesktopDefaults(old);
  assert.deepEqual(next, { ...old, ...DEFAULT_DESKTOP_SETTINGS });
  assert.equal(next.desktopPageStep, 50);
  assert.equal(next.desktopReaderHideDelay, 2.6);
  assert.equal(next.desktopShowBadges, true);
  assert.equal(next.desktopInterfaceLanguage, 'en');
  assert.equal(old.desktopInterfaceLanguage, 'pt-BR', 'Existing saved language is not modified until reset');
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


test('fresh default settings select English without modifying Android or unrelated preferences', () => {
  assert.equal(DEFAULT_DESKTOP_SETTINGS.desktopInterfaceLanguage, 'en');
  assert.equal(restoreDesktopDefaults({}).desktopInterfaceLanguage, 'en');
  const existing = { desktopInterfaceLanguage: 'pt-BR', novelSort: 'date', pluginLanguage: 'ja' };
  assert.equal(existing.desktopInterfaceLanguage, 'pt-BR', 'Saved settings remain untouched before reset');
  assert.deepEqual(restoreDesktopDefaults(existing), { ...existing, ...DEFAULT_DESKTOP_SETTINGS });
  assert.equal(existing.pluginLanguage, 'ja');
});
