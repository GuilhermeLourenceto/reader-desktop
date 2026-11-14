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

test('partial restore preserves existing offline chapters', () => {
  const current = oldState();
  const backedUp = structuredClone(current);
  backedUp.novels[0].chapters[0].isDownloaded = false;
  delete backedUp.files['Novels/site/4/10/index.html'];
  const result = planRestore(current, restore(backedUp));
  assert.equal(result.next.novels[0].chapters[0].isDownloaded, true);
  assert.equal(result.next.files['Novels/site/4/10/index.html'],
    current.files['Novels/site/4/10/index.html']);
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
  assert.equal(result.changed, false);
  assert.equal(result.next.settings.desktopTheme, 'dark');
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

test('imported cover cannot overwrite the existing local cover', () => {
  const current = oldState();
  const backedUp = structuredClone(current);
  // Backups enter through the worker with already imported immutable file refs.
  backedUp.files['Covers/4'] = '@file:' + 'd'.repeat(64);
  const result = planRestore(current, restore(backedUp), files => ({ ...files }));
  assert.equal(result.changed, false);
  assert.equal(result.next.files['Covers/4'], current.files['Covers/4']);
});

test('missing Android metadata preserves existing categories, settings and plugin bundles', () => {
  const current = oldState();
  const incoming = structuredClone(current);
  incoming.novels[0].name = 'Imported book';
  incoming.categories = [];
  incoming.settings = {};
  incoming.plugins = [];
  delete incoming.files['Plugins/site/index.js'];
  const result = planRestore(current, {
    ...restore(incoming),
    missingSections: ['categories', 'settings', 'plugins'],
  });
  assert.equal(result.next.novels[0].name, 'Imported book');
  assert.deepEqual(result.next.categories, current.categories);
  assert.deepEqual(result.next.settings, current.settings);
  assert.deepEqual(result.next.plugins, current.plugins);
  assert.equal(result.next.files['Plugins/site/index.js'], current.files['Plugins/site/index.js']);
});

test('empty backup cannot remove existing library or offline files', () => {
  const current = oldState();
  const result = planRestore(current, restore({
    ...oldState(), novels: [], categories: [], files: {},
  }));
  assert.deepEqual(result.next.novels, current.novels);
  assert.deepEqual(result.next.files, current.files);
});

test('novel and chapter ID collisions remap offline HTML, images and categories', () => {
  const current = oldState();
  const imported = restore({
    ...oldState(),
    novels: [{
      id: 4, pluginId: 'other', path: '/new', name: 'Imported',
      chapters: [{ id: 10, path: '/first', name: 'Chapter',
        progress: 78, bookmark: true, isDownloaded: true }],
    }],
    categories: [{ id: 8, name: 'Imported category', novelIds: [4] }],
    files: {
      'Novels/other/4/10/index.html': '<img src="file:///Novels/other/4/10/0.b64.png">',
      'Novels/other/4/10/0.b64.png': 'image',
      'Covers/4': 'cover',
    },
  });
  const result = planRestore(current, imported, files => files,
    (_name, value, replacements) => replacements.reduce(
      (html, { from, to }) => html.split(from).join(to), value,
    ));
  const book = result.next.novels.find(n => n.pluginId === 'other');
  assert.ok(book);
  assert.notEqual(book.id, 4);
  assert.notEqual(book.chapters[0].id, 10);
  const key = `Novels/other/${book.id}/${book.chapters[0].id}/index.html`;
  assert.ok(result.next.files[key].includes(`/Novels/other/${book.id}/${book.chapters[0].id}/`));
  assert.equal(result.next.files[`Novels/other/${book.id}/${book.chapters[0].id}/0.b64.png`], 'image');
  assert.equal(result.next.files[`Covers/${book.id}`], 'cover');
  assert.deepEqual(result.next.categories.find(c => c.name === 'Imported category').novelIds, [book.id]);
});

test('same novel retains identity, merges chapters, and restores reading progress', () => {
  const current = oldState();
  const result = planRestore(current, restore({
    ...oldState(),
    novels: [{
      id: 100, pluginId: 'site', path: '/book/4', name: 'Restored',
      chapters: [
        { id: 200, path: '/ch/10', name: 'Chapter', progress: 34, isDownloaded: false },
        { id: 201, path: '/ch/11', name: 'Another', progress: 12, isDownloaded: false },
      ],
    }], files: {},
  }));
  assert.equal(result.next.novels.length, 1);
  assert.equal(result.next.novels[0].id, 4);
  assert.equal(result.next.novels[0].chapters[0].id, 10);
  assert.equal(result.next.novels[0].chapters[0].progress, 34);
  assert.equal(result.next.novels[0].chapters[0].isDownloaded, true);
  assert.equal(result.next.novels[0].chapters[1].path, '/ch/11');
});

test('theme, palette, reader colors and backup destination stay local', () => {
  const current = oldState();
  current.settings = { ...current.settings, desktopPalette: 'lavender',
    desktopReaderTheme: 'app', desktopBackupFrequency: '24',
    desktopBackupDirectory: '/home/user/backups' };
  const incoming = restore({ ...oldState(), settings: {
    desktopTheme: 'light', desktopPalette: 'default',
    desktopReaderTheme: 'red', desktopBackupFrequency: 'off',
    desktopBackupDirectory: '/another/machine', fontSize: 20,
  } });
  const result = planRestore(current, incoming);
  assert.equal(result.next.settings.desktopTheme, 'dark');
  assert.equal(result.next.settings.desktopPalette, 'lavender');
  assert.equal(result.next.settings.desktopReaderTheme, 'app');
  assert.equal(result.next.settings.desktopBackupFrequency, '24');
  assert.equal(result.next.settings.desktopBackupDirectory, '/home/user/backups');
  assert.equal(result.next.settings.fontSize, 20);
});

test('source code, registry and repositories merge without replacing existing source data', () => {
  const current = oldState();
  const result = planRestore(current, restore({
    ...oldState(),
    repositories: ['https://example.org/repository.json', 'https://other.org/repo.json'],
    pluginStorage: { 'plugin_db:site': 'overwritten', 'plugin_db:new_DB_key': 'saved' },
    plugins: [
      { id: 'site', url: 'https://example.org/plugin.js' },
      { id: 'new', url: 'https://other.org/plugin.js' },
    ],
    files: { ...oldState().files, 'Plugins/new/index.js': 'new-code',
      'Plugins/site/index.js': 'do-not-overwrite' },
  }));
  assert.deepEqual(result.next.repositories, [
    'https://example.org/repository.json', 'https://other.org/repo.json',
  ]);
  assert.equal(result.next.pluginStorage['plugin_db:site'], '{}');
  assert.equal(result.next.pluginStorage['plugin_db:new_DB_key'], 'saved');
  assert.equal(result.next.plugins.length, 2);
  assert.equal(result.next.files['Plugins/site/index.js'], current.files['Plugins/site/index.js']);
  assert.equal(result.next.files['Plugins/new/index.js'], 'new-code');
});

test('Android preferences apply only supported values and retain Desktop-only reader controls', () => {
  const current = oldState();
  current.settings = {
    ...current.settings, desktopOnboardingCompleted: false,
    desktopInterfaceLanguage: 'pt-BR', desktopTheme: 'light',
    desktopPalette: 'teal', desktopReaderTheme: 'app',
    desktopReaderAutoHide: false, desktopReaderHideDelay: 8.4,
    desktopBackupDirectory: '/home/user/backups',
  };
  const backup = { ...oldState(), settings: {
    APP_LOCALE: 'ja', THEME_MODE: 'dark', AMOLED_BLACK: true, APP_THEME_ID: 104,
    LIBRARY_SETTINGS: JSON.stringify({ incognitoMode: true }),
    CHAPTER_READER_SETTINGS: JSON.stringify({ theme: '#f5f5fa',
      textColor: '#111111', fontFamily: 'noto-sans' }),
    CHAPTER_GENERAL_SETTINGS: JSON.stringify({ pageReader: true }),
  } };
  const result = planRestore(current, restore(backup, {
    library: false, settings: true, plugins: false, downloadedFiles: false,
  }));
  assert.equal(result.next.settings.desktopInterfaceLanguage, 'ja');
  assert.equal(result.next.settings.desktopTheme, 'oled');
  assert.equal(result.next.settings.desktopPalette, 'lavender');
  assert.equal(result.next.settings.desktopReaderTheme, 'original-light');
  assert.equal(result.next.settings.desktopFontFamily, 'sans');
  assert.equal(result.next.settings.desktopPagination, 'pages');
  assert.equal(result.next.settings.desktopIncognito, true);
  assert.equal(result.next.settings.desktopReaderAutoHide, false);
  assert.equal(result.next.settings.desktopReaderHideDelay, 8.4);
  assert.equal(result.next.settings.desktopBackupDirectory, '/home/user/backups');
  assert.equal(result.next.settings.desktopOnboardingCompleted, false);
  assert.equal(current.settings.desktopInterfaceLanguage, 'pt-BR');
});

test('unsupported Android locale, system AMOLED and custom reader colors cannot reset Desktop', () => {
  const current = oldState();
  current.settings = {
    ...current.settings, desktopInterfaceLanguage: 'pt-BR',
    desktopTheme: 'oled', desktopPalette: 'lavender',
    desktopReaderTheme: 'original-dark', desktopFontFamily: 'serif',
    desktopReaderAutoHide: true, desktopReaderHideDelay: 4.2,
  };
  const incoming = restore({ ...oldState(), settings: {
    APP_LOCALE: 'zh-TW', APP_THEME_ID: -1,
    THEME_MODE: 'system', AMOLED_BLACK: true,
    CUSTOM_ACCENT_COLOR: '#abcdef',
    CHAPTER_READER_SETTINGS: JSON.stringify({
      theme: '#abcdef', textColor: '#123456', fontFamily: 'lora',
    }),
  } }, { library: false, settings: true, plugins: false, downloadedFiles: false });
  const result = planRestore(current, incoming);
  for (const key of [
    'desktopInterfaceLanguage', 'desktopTheme', 'desktopPalette',
    'desktopReaderTheme', 'desktopFontFamily',
    'desktopReaderAutoHide', 'desktopReaderHideDelay',
  ]) assert.equal(result.next.settings[key], current.settings[key], key);
  assert.equal(result.next.settings.APP_LOCALE, 'zh-TW');
  assert.equal(result.next.settings.CUSTOM_ACCENT_COLOR, '#abcdef');
});

test('a Desktop-origin ZIP cannot overwrite local preferences using its Android mirror', () => {
  const current = oldState();
  current.settings = { ...current.settings, desktopInterfaceLanguage: 'pt-BR',
    desktopTheme: 'oled', desktopPalette: 'lavender' };
  const backup = restore({ ...oldState(), settings: {
    desktopInterfaceLanguage: 'en', desktopTheme: 'light',
    APP_LOCALE: 'ja', THEME_MODE: 'light', APP_THEME_ID: 102,
  } }, { library: false, settings: true, plugins: false, downloadedFiles: false });
  backup.isDesktopBackup = true;
  const result = planRestore(current, backup);
  assert.equal(result.next.settings.desktopInterfaceLanguage, 'pt-BR');
  assert.equal(result.next.settings.desktopTheme, 'oled');
  assert.equal(result.next.settings.desktopPalette, 'lavender');
});

test('missing settings section cannot change locale or appearance even if Android keys exist', () => {
  const current = oldState();
  current.settings = { ...current.settings, desktopInterfaceLanguage: 'pt-BR',
    desktopPalette: 'lavender', desktopReaderAutoHide: false };
  const backup = restore({ ...oldState(), settings: {
    APP_LOCALE: 'ja', THEME_MODE: 'light', APP_THEME_ID: 102,
  } }, { library: false, settings: false, plugins: false, downloadedFiles: false });
  const result = planRestore(current, backup);
  assert.equal(result.changed, false);
  assert.deepEqual(result.next.settings, current.settings);
});
