const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planRestore } = require('../src/restorePlan.cjs');

const oldState = () => ({
  novels: [{
    id: 4, pluginId: 'site', path: '/book/4', name: 'Book',
    chapters: [{
      id: 10, name: 'Chapter', path: '/ch/10', progress: 70,
      bookmark: true, isDownloaded: true,
    }],
  }],
  categories: [{ name: 'Favorites', novelIds: [4] }],
  settings: { desktopOnboardingCompleted: true, desktopTheme: 'dark' },
  plugins: [{ id: 'site', url: 'https://example.org/plugin.js' }],
  repositories: ['https://example.org/repository.json'],
  pluginStorage: { 'plugin_db:site': '{}' },
  files: {
    'Novels/site/4/10/index.html': '@file:' + 'a'.repeat(64),
    'Covers/4': '@file:' + 'b'.repeat(64),
    'Plugins/site/index.js': '@file:' + 'c'.repeat(64),
  },
  progressUnit: 'percent',
});
const selection = {
  library: true, settings: true, plugins: true, downloadedFiles: true,
};
const restore = (state, sections = selection) => ({
  state: structuredClone(state), sections,
});

test('identical restore is a no-op and retains the current metadata', () => {
  const current = oldState();
  const result = planRestore(current, restore(current));
  assert.equal(result.changed, false);
  assert.deepEqual(result.next, current);
});

test('a changed reading position and bookmarks still restore exactly', () => {
  const current = oldState();
  const backedUp = structuredClone(current);
  backedUp.novels[0].chapters[0].progress = 20;
  backedUp.novels[0].chapters[0].bookmark = false;
  const result = planRestore(current, restore(backedUp));
  assert.equal(result.changed, true);
  assert.equal(result.next.novels[0].chapters[0].progress, 20);
  assert.equal(result.next.novels[0].chapters[0].bookmark, false);
  assert.equal(current.novels[0].chapters[0].progress, 70);
});

test('a selected library restore removes absent files instead of keeping stale chapters', () => {
  const current = oldState();
  const backedUp = structuredClone(current);
  delete backedUp.files['Novels/site/4/10/index.html'];
  const result = planRestore(current, restore(backedUp));
  assert.equal(result.changed, true);
  assert.equal(result.next.novels[0].chapters[0].isDownloaded, false);
  assert.equal(Object.hasOwn(result.next.files, 'Novels/site/4/10/index.html'), false);
});

test('partial backup changes only selected sections and preserves other files', () => {
  const current = oldState();
  const backedUp = structuredClone(current);
  backedUp.settings.desktopTheme = 'light';
  backedUp.novels = [];
  backedUp.plugins = [];
  backedUp.files = {};
  const result = planRestore(current, restore(backedUp, {
    library: false, settings: true, plugins: false, downloadedFiles: false,
  }));
  assert.equal(result.changed, true);
  assert.equal(result.next.settings.desktopTheme, 'light');
  assert.deepEqual(result.next.novels, current.novels);
  assert.deepEqual(result.next.plugins, current.plugins);
  assert.deepEqual(result.next.files, current.files);
  assert.deepEqual(result.next.repositories, current.repositories);
  assert.deepEqual(result.next.pluginStorage, current.pluginStorage);
});

test('settings-only no-op backup does not trigger a metadata rewrite', () => {
  const current = oldState();
  const backedUp = structuredClone(current);
  backedUp.novels = [];
  backedUp.files = {};
  backedUp.plugins = [];
  const result = planRestore(current, restore(backedUp, {
    library: false, settings: true, plugins: false, downloadedFiles: false,
  }));
  assert.equal(result.changed, false);
});

test('imported disk file references are used, and an actually different file changes state', () => {
  const current = oldState();
  const backedUp = structuredClone(current);
  // Backups enter through the worker with already imported immutable file refs.
  backedUp.files['Covers/4'] = '@file:' + 'd'.repeat(64);
  const result = planRestore(current, restore(backedUp), files => ({ ...files }));
  assert.equal(result.changed, true);
  assert.equal(result.next.files['Covers/4'], '@file:' + 'd'.repeat(64));
});
