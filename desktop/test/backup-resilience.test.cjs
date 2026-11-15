const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { importBackup } = require('../dist/zipStreaming.cjs');
const { emptyState } = require('../dist/backup.cjs');
const { planRestore } = require('../src/restorePlan.cjs');

const settingsOnly = {
  library: false, settings: true, plugins: false, downloadedFiles: false,
};
const manifest = sections => ({
  appVersion: '2.1.4', formatVersion: 2, sections,
});
function fixture(t, members) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-android-resilience-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const contentDirectory = path.join(root, 'content');
  fs.mkdirSync(contentDirectory);
  const filename = path.join(root, 'android.zip');
  const archive = new AdmZip();
  for (const [name, value] of Object.entries(members))
    archive.addFile(name, Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value)));
  fs.writeFileSync(filename, archive.toBuffer());
  return { root, filename, contentDirectory };
}
const currentState = () => ({
  ...emptyState(),
  settings: {
    desktopInterfaceLanguage: 'pt-BR', desktopTheme: 'oled',
    desktopPalette: 'lavender', desktopReaderHideDelay: 7.4,
    desktopReaderAutoHide: false, desktopIncognito: true,
    desktopDownloadedOnly: true, desktopOnboardingCompleted: true,
    LIBRARY_SETTINGS: '{"incognitoMode":true,"downloadedOnlyMode":true}',
  },
  novels: [{ id: 8, pluginId: 'local', name: 'Local book', path: '/book',
    chapters: [{ id: 9, path: '/chapter', name: 'Chapter', progress: 88 }] }],
});

test('missing Android Setting.json preserves all saved Desktop settings', async t => {
  const input = fixture(t, { 'Version.json': manifest(settingsOnly) });
  const restored = await importBackup(input);
  assert.deepEqual(restored.missingSections, ['settings']);
  const current = currentState();
  const original = structuredClone(current);
  const result = planRestore(current, restored);
  assert.equal(result.changed, false);
  assert.deepEqual(result.next.settings, original.settings);
  assert.deepEqual(current, original);
});

test('invalid and unknown Android preference values cannot change valid Desktop choices', async t => {
  const input = fixture(t, {
    'Version.json': manifest(settingsOnly),
    'Setting.json': {
      APP_LOCALE: 'invalid-xx', THEME_MODE: 'unsupported',
      APP_THEME_ID: -999, AMOLED_BLACK: 'yes',
      LIBRARY_SETTINGS: '{broken JSON',
      CHAPTER_READER_SETTINGS: '{"textAlign":"center","fontFamily":"futureFont","lineHeight":900}',
      CHAPTER_GENERAL_SETTINGS: '{"pageReader":"false"}',
      UNKNOWN_ANDROID_SETTING: { version: 300 },
      desktopTheme: 'light', desktopReaderAutoHide: true,
    },
  });
  const current = currentState(), before = structuredClone(current);
  const restored = await importBackup(input);
  const result = planRestore(current, restored);
  for (const [key, value] of Object.entries(before.settings))
    assert.deepEqual(result.next.settings[key], value, key);
  assert.deepEqual(result.next.novels, before.novels);
  assert.deepEqual(current, before);
  assert.deepEqual(result.next.settings.UNKNOWN_ANDROID_SETTING, { version: 300 },
    'unknown native settings may round-trip but do not affect the Desktop UI');
});

test('a malformed selected Android settings section is rejected without changing local data', async t => {
  const input = fixture(t, {
    'Version.json': manifest(settingsOnly),
    'Setting.json': Buffer.from('{unclosed'),
  });
  const existing = path.join(input.contentDirectory, 'saved-blob');
  fs.writeFileSync(existing, 'keep-original-bytes');
  await assert.rejects(importBackup(input));
  assert.equal(fs.readFileSync(existing, 'utf8'), 'keep-original-bytes');
  assert.deepEqual(fs.readdirSync(input.contentDirectory), ['saved-blob']);
});

test('bad ZIP and broken selected library metadata are rejected, never silently imported', async t => {
  const input = fixture(t, { 'Version.json': manifest({
    library: true, settings: false, plugins: false, downloadedFiles: false,
  }), 'NovelAndChapters/1.json': Buffer.from('{"id":1,"chapters":"bad"}') });
  await assert.rejects(importBackup(input));
  const corrupted = path.join(input.root, 'truncated.zip');
  fs.writeFileSync(corrupted, 'not even a ZIP archive');
  await assert.rejects(importBackup({
    filename: corrupted, contentDirectory: input.contentDirectory,
  }));
  assert.deepEqual(fs.readdirSync(input.contentDirectory), []);
});

test('failure after importing a plugin removes only new blobs and leaves old ones intact', async t => {
  const plugin = new AdmZip();
  plugin.addFile('source/index.js', Buffer.from('exports.default = {}'));
  const input = fixture(t, {
    'Version.json': manifest({
      library: true, settings: false, plugins: true, downloadedFiles: true,
    }),
    'Category.json': [],
    'Plugins.json': [{ id: 'source', url: 'https://example.org/source.js' }],
    'plugins.zip': plugin.toBuffer(),
    'novel-files.zip': Buffer.from('corrupt nested ZIP'),
  });
  const existing = path.join(input.contentDirectory, 'existing-file');
  fs.writeFileSync(existing, 'leave-it-unchanged');
  await assert.rejects(importBackup(input));
  assert.deepEqual(fs.readdirSync(input.contentDirectory), ['existing-file']);
  assert.equal(fs.readFileSync(existing, 'utf8'), 'leave-it-unchanged');
});

test('unselected malformed Android metadata is ignored while valid preferences import', async t => {
  const input = fixture(t, {
    'Version.json': manifest(settingsOnly),
    'Setting.json': { APP_LOCALE: 'ja', THEME_MODE: 'light' },
    'NovelAndChapters/1.json': Buffer.from('broken JSON'),
    'Plugins.json': Buffer.from('broken JSON'),
  });
  const restored = await importBackup(input);
  const current = currentState();
  const result = planRestore(current, restored);
  assert.equal(result.next.settings.desktopInterfaceLanguage, 'ja');
  assert.equal(result.next.settings.desktopTheme, 'light');
  assert.equal(result.next.novels[0].name, 'Local book');
  assert.equal(result.next.settings.desktopReaderHideDelay, 7.4);
  assert.equal(result.next.settings.desktopReaderAutoHide, false);
});


test('staged Android archive imports only books marked inLibrary and skips their offline blobs', async t => {
  const offline = new AdmZip();
  offline.addFile('site/1/10/index.html', Buffer.from('book in library'));
  offline.addFile('site/2/20/index.html', Buffer.from('browser cache, not in library'));
  const input = fixture(t, {
    'Version.json': manifest({
      library: true, settings: false, plugins: false, downloadedFiles: true,
    }),
    'NovelAndChapters/1.json': {
      id: 1, pluginId: 'site', path: '/kept', name: 'In library',
      inLibrary: true,
      chapters: [{ id: 10, path: '/10', name: 'Read' }],
    },
    'NovelAndChapters/2.json': {
      id: 2, pluginId: 'site', path: '/cached', name: 'Cached only',
      inLibrary: false,
      chapters: [{ id: 20, path: '/20', name: 'Preview' }],
    },
    'Category.json': [{ id: 1, name: 'Padrão', novelIds: [1] }],
    'Covers/1': Buffer.from('kept cover'),
    'Covers/2': Buffer.from('cached cover'),
    'novel-files.zip': offline.toBuffer(),
  });
  const originalZip = fs.readFileSync(input.filename);
  const { parseBackup } = require('../dist/backup.cjs');
  const parsed = parseBackup(originalZip);
  assert.equal(parsed.state.novels.length, 1);
  assert.equal(Object.keys(parsed.state.files).length, 2);
  const restored = await importBackup({ ...input, forceLocalStage: true });
  assert.equal(restored.state.novels.length, 1);
  assert.equal(restored.state.novels[0].name, 'In library');
  assert.equal(Object.keys(restored.state.files).length, 2);
  assert.match(restored.state.files['Novels/site/1/10/index.html'], /^@file:/);
  assert.match(restored.state.files['Covers/1'], /^@file:/);
  assert.equal(restored.state.files['Novels/site/2/20/index.html'], undefined);
  assert.equal(restored.state.files['Covers/2'], undefined);
  assert.equal(planRestore(currentState(), restored).next.novels.length, 2);
  assert.equal(fs.readdirSync(input.contentDirectory).some(
    name => name.startsWith('.reader-import-')), false,
    'local staging and extracted temporary ZIPs must always be cleaned up');
  assert.deepEqual(fs.readFileSync(input.filename), originalZip,
    'never change the original Android backup');
});

test('failed local staging leaves neither copied ZIP nor orphaned imported files', async t => {
  const input = fixture(t, {
    'Version.json': manifest({
      library: true, settings: false, plugins: false, downloadedFiles: true,
    }),
    'NovelAndChapters/1.json': { id: 1, name: 'Bad',
      pluginId: 'site', path: '/book', chapters: [] },
    'novel-files.zip': Buffer.from('this is not a ZIP'),
  });
  await assert.rejects(importBackup({ ...input, forceLocalStage: true }));
  assert.deepEqual(fs.readdirSync(input.contentDirectory), []);
});

test('Desktop metadata may retain a non-library record for compatibility', async t => {
  const input = fixture(t, {
    'Version.json': {
      ...manifest({ library: true, settings: false, plugins: false,
        downloadedFiles: false }),
      desktopState: { repositories: [], pluginStorage: {} },
      desktopNovelCount: 1, desktopNovelOrder: [9],
    },
    'NovelAndChapters/9.json': {
      id: 9, pluginId: 'site', path: '/cached',
      name: 'Previously known record', inLibrary: false, chapters: [],
    },
    'Category.json': [],
  });
  const restored = await importBackup(input);
  assert.equal(restored.isDesktopBackup, true);
  assert.equal(restored.state.novels.length, 1);
  assert.equal(restored.state.novels[0].inLibrary, false);
});
