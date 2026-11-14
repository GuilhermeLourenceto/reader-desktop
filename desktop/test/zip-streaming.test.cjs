const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomBytes } = require('node:crypto');
const { DiskFiles } = require('../src/storage.cjs');
const { emptyState, parseBackup } = require('../dist/backup.cjs');
const { exportBackup, importBackup } = require('../dist/zipStreaming.cjs');
const AdmZip = require('adm-zip');
const { planRestore } = require('../src/restorePlan.cjs');

test('streaming ZIP64 round trip retains source code, offline content and reading progress', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-streaming-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(path.join(root, 'content'));
  const html = Buffer.from('<p>Offline chapter</p>'.repeat(12000));
  const picture = randomBytes(2 * 1024 * 1024);
  const files = store.import({
    'Novels/reader/7/9/index.html': html.toString('base64'),
    'Novels/reader/7/9/0.png': picture.toString('base64'),
    'Plugins/reader/index.js': Buffer.from('exports.default = {}').toString('base64'),
    'Covers/7': Buffer.from('cover').toString('base64'),
  });
  const state = {
    ...emptyState(),
    novels: [{
      id: 7, pluginId: 'reader', name: 'Book', path: '/book', inLibrary: true,
      chapters: [{
        id: 9, novelId: 7, path: '/chapter', name: 'Chapter',
        isDownloaded: true, progress: 42, bookmark: true,
      }],
    }],
    categories: [{ id: 3, name: 'Favorites', novelIds: [7] }],
    plugins: [{ id: 'reader', url: 'https://example.org/reader.js' }],
    repositories: ['https://example.org/repository.json'],
    pluginStorage: { 'plugin_db:reader_DB_a': '{"saved":true}' },
    settings: { desktopTheme: 'oled' },
    files,
  };
  const archive = path.join(root, 'backup.zip');
  assert.deepEqual(await exportBackup({
    state, contentDirectory: store.directory, filename: archive,
  }), { missingCount: 0 });
  // ZIP64 archives also remain readable by the existing in-memory tools.
  const metadata = parseBackup(fs.readFileSync(archive));
  assert.equal(metadata.state.novels[0].chapters[0].progress, 42);
  const output = await importBackup({
    filename: archive, contentDirectory: store.directory,
  });
  assert.deepEqual(output.state.novels, state.novels);
  assert.deepEqual(output.state.plugins, state.plugins);
  assert.deepEqual(output.state.repositories, state.repositories);
  assert.deepEqual(output.state.pluginStorage, state.pluginStorage);
  assert.deepEqual(output.state.files, state.files);
  assert.deepEqual(store.read(output.state.files['Novels/reader/7/9/0.png']), picture);
  const immutable = path.join(store.directory, files['Novels/reader/7/9/0.png'].slice(6));
  const originalMtime = fs.statSync(immutable).mtimeMs;
  await importBackup({ filename: archive, contentDirectory: store.directory });
  assert.equal(fs.statSync(immutable).mtimeMs, originalMtime);
});

test('metadata-only streaming backup omits offline files and keeps cover and progress', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-stream-meta-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(path.join(root, 'content'));
  const state = {
    ...emptyState(),
    novels: [{ id: 2, pluginId: 'site', path: '/book', name: 'Book',
      chapters: [{ id: 3, path: '/chapter', name: 'Chapter',
        progress: 80, isDownloaded: true }] }],
    files: store.import({
      'Novels/site/2/3/index.html': Buffer.from('chapter').toString('base64'),
      'Novels/site/2/cover.png': Buffer.from('cover').toString('base64'),
    }),
  };
  const archive = path.join(root, 'backup.zip');
  await exportBackup({ state, contentDirectory: store.directory,
    filename: archive, includeDownloads: false });
  const parsed = await importBackup({ filename: archive,
    contentDirectory: store.directory });
  assert.equal(parsed.sections.downloadedFiles, false);
  assert.equal(parsed.state.novels[0].chapters[0].isDownloaded, false);
  assert.equal(parsed.state.novels[0].chapters[0].progress, 80);
  assert.equal(parsed.state.files['Covers/2'], state.files['Novels/site/2/cover.png']);
  assert.equal(Object.keys(parsed.state.files).length, 1);
});

test('over-512-MiB offline chapter uses disk streams instead of a global ZIP limit',
  { skip: process.env.READER_LARGE_BACKUP_TEST !== '1' },
  async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-stream-640m-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const store = new DiskFiles(path.join(root, 'content'));
    const block = randomBytes(1024 * 1024);
    const filename = path.join(root, 'source.bin');
    const hasher = createHash('sha256');
    const fd = fs.openSync(filename, 'wx');
    try {
      for (let i = 0; i < 530; i++) {
        fs.writeSync(fd, block);
        hasher.update(block);
      }
    } finally {
      fs.closeSync(fd);
    }
    const hash = hasher.digest('hex');
    fs.renameSync(filename, path.join(store.directory, hash));
    const state = {
      ...emptyState(),
      novels: [{ id: 1, name: 'Offline', path: '/book', pluginId: 'site',
        chapters: [{ id: 2, name: 'Chapter', path: '/ch', isDownloaded: true }] }],
      files: { 'Novels/site/1/2/index.html': '@file:' + hash },
    };
    const archive = path.join(root, 'large.zip');
    await exportBackup({ state, filename: archive, contentDirectory: store.directory });
    const result = await importBackup({ filename: archive,
      contentDirectory: store.directory });
    assert.equal(result.state.files['Novels/site/1/2/index.html'], '@file:' + hash);
    assert.equal(result.state.novels[0].chapters[0].isDownloaded, true);
  });

function androidZip(root, members) {
  const output = path.join(root, 'android.zip');
  const zip = new AdmZip();
  for (const [name, data] of Object.entries(members))
    zip.addFile(name, Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data)));
  fs.writeFileSync(output, zip.toBuffer());
  return output;
}

test('Android v2 settings-only ZIP maps supported appearance but preserves Desktop-only options', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-android-settings-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filename = androidZip(root, {
    'Version.json': { appVersion: '2.1.4', formatVersion: 2,
      sections: { library: false, settings: true, plugins: false, downloadedFiles: false } },
    'Setting.json': {
      THEME_MODE: 'dark', APP_LOCALE: 'ja', APP_THEME_ID: 104,
      APP_SETTINGS: '{"incognitoMode":false}',
      CHAPTER_READER_SETTINGS: '{"fontSize":18}',
    },
  });
  const dir = path.join(root, 'content');
  fs.mkdirSync(dir);
  const restored = await importBackup({ filename, contentDirectory: dir });
  assert.equal(restored.sections.library, false);
  assert.deepEqual(restored.state.novels, []);
  assert.deepEqual(restored.state.plugins, []);
  const current = {
    ...emptyState(),
    novels: [{ id: 3, pluginId: 'local', path: '/book', name: 'Existing', chapters: [] }],
    settings: { desktopTheme: 'oled', desktopPalette: 'lavender',
      desktopReaderTheme: 'app', desktopInterfaceLanguage: 'pt-BR',
      desktopReaderAutoHide: false, desktopReaderHideDelay: 7.4,
      desktopOnboardingCompleted: true },
  };
  const plan = planRestore(current, restored);
  assert.equal(plan.next.novels.length, 1);
  assert.equal(plan.next.settings.desktopTheme, 'dark');
  assert.equal(plan.next.settings.desktopInterfaceLanguage, 'ja');
  assert.equal(plan.next.settings.desktopReaderAutoHide, false);
  assert.equal(plan.next.settings.desktopReaderHideDelay, 7.4);
  assert.equal(plan.next.settings.desktopPalette, 'lavender');
  assert.equal(plan.next.settings.desktopReaderTheme, 'app');
  assert.equal(plan.next.settings.THEME_MODE, 'dark');
});

test('Android v2 plugins-only ZIP does not need library or novel-files.zip', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-android-plugins-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plugins = new AdmZip();
  plugins.addFile('source/index.js', Buffer.from('module.exports = {}'));
  const filename = androidZip(root, {
    'Version.json': { appVersion: '2.1.4', formatVersion: 2,
      sections: { library: false, settings: false, plugins: true, downloadedFiles: false } },
    'Plugins.json': [{ id: 'source', url: 'https://example.org/source.js' }],
    'plugins.zip': plugins.toBuffer(),
  });
  const dir = path.join(root, 'content');
  fs.mkdirSync(dir);
  const restored = await importBackup({ filename, contentDirectory: dir });
  assert.equal(restored.sections.plugins, true);
  assert.equal(restored.state.plugins.length, 1);
  assert.match(restored.state.files['Plugins/source/index.js'], /^@file:/);
  assert.deepEqual(restored.missingSections, []);
});

test('Android v2 library without downloaded files keeps local categories when absent', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-android-library-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filename = androidZip(root, {
    'Version.json': { appVersion: '2.1.4', formatVersion: 2,
      sections: { library: true, settings: false, plugins: false, downloadedFiles: false } },
    'NovelAndChapters/5.json': { id: 5, pluginId: 'site', name: 'From Android',
      path: '/book', inLibrary: true,
      chapters: [{ id: 6, path: '/chapter', name: 'Chapter',
        progress: 60, isDownloaded: false }] },
  });
  const dir = path.join(root, 'content');
  fs.mkdirSync(dir);
  const restored = await importBackup({ filename, contentDirectory: dir });
  assert.deepEqual(restored.missingSections, ['categories']);
  const current = { ...emptyState(),
    categories: [{ id: 1, name: 'Existing category', novelIds: [] }] };
  const plan = planRestore(current, restored);
  assert.equal(plan.next.novels.length, 1);
  assert.deepEqual(plan.next.categories, current.categories);
  assert.equal(plan.next.novels[0].chapters[0].progress, 60);
});

test('Android legacy ZIP without Version.json is still importable', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-android-legacy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = new AdmZip();
  files.addFile('Novels/site/5/6/index.html', Buffer.from('<p>Legacy offline</p>'));
  const filename = androidZip(root, {
    'NovelAndChapters/5.json': { id: 5, pluginId: 'site',
      path: '/legacy', name: 'Legacy', chapters: [{ id: 6, path: '/chapter',
        name: 'Chapter', isDownloaded: true }] },
    'Category.json': [],
    'Setting.json': {},
    'Plugins.json': [],
    'download.zip': files.toBuffer(),
  });
  const dir = path.join(root, 'content');
  fs.mkdirSync(dir);
  const restored = await importBackup({ filename, contentDirectory: dir });
  assert.equal(restored.state.novels.length, 1);
  assert.equal(restored.state.novels[0].name, 'Legacy');
  assert.match(restored.state.files['Novels/site/5/6/index.html'], /^@file:/);
  assert.equal(restored.sections.downloadedFiles, true);
});

test('partial Android backup ignores invalid JSON in unselected sections', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-android-ignore-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = androidZip(root, {
    'Version.json': { appVersion: '2.1.4', formatVersion: 2,
      sections: { library: false, settings: true, plugins: false, downloadedFiles: false } },
    'Setting.json': { THEME_MODE: 'dark' },
    'NovelAndChapters/123.json': Buffer.from('{invalid and unselected}'),
    'Plugins.json': Buffer.from('{invalid and unselected}'),
  });
  const contentDirectory = path.join(root, 'content');
  fs.mkdirSync(contentDirectory);
  const restored = await importBackup({ filename: file, contentDirectory });
  assert.deepEqual(restored.state.novels, []);
  assert.deepEqual(restored.state.plugins, []);
  assert.equal(restored.state.settings.THEME_MODE, 'dark');
});

test('malformed legacy Version.json uses Android v1 fallback when download.zip exists', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-android-oldmanifest-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = new AdmZip();
  files.addFile('Novels/source/1/2/index.html', Buffer.from('Old downloaded chapter'));
  const file = androidZip(root, {
    'Version.json': Buffer.from('malformed legacy manifest'),
    'NovelAndChapters/1.json': { id: 1, name: 'Legacy book',
      pluginId: 'source', path: '/book', chapters: [{ id: 2, name: 'Chapter',
        path: '/chapter', isDownloaded: true }] },
    'Category.json': [], 'Setting.json': {}, 'Plugins.json': [],
    'download.zip': files.toBuffer(),
  });
  const contentDirectory = path.join(root, 'content');
  fs.mkdirSync(contentDirectory);
  const restored = await importBackup({ filename: file, contentDirectory });
  assert.equal(restored.state.novels.length, 1);
  assert.equal(restored.state.novels[0].chapters[0].isDownloaded, true);
  assert.match(restored.state.files['Novels/source/1/2/index.html'], /^@file:/);
});

test('streaming exporter emits Android-readable appearance keys without changing local-only options', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-preference-export-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const state = {
    ...emptyState(),
    settings: {
      desktopInterfaceLanguage: 'pt-BR', desktopTheme: 'oled',
      desktopPalette: 'lavender', desktopReaderAutoHide: false,
      desktopReaderHideDelay: 8.2, CUSTOM_ACCENT_COLOR: '#112233',
    },
  };
  const filename = path.join(root, 'backup.zip');
  await exportBackup({ filename, state, contentDirectory: root });
  const zip = new AdmZip(fs.readFileSync(filename));
  const settings = JSON.parse(zip.readAsText('Setting.json'));
  assert.equal(settings.APP_LOCALE, 'pt-BR');
  assert.equal(settings.THEME_MODE, 'dark');
  assert.equal(settings.AMOLED_BLACK, true);
  assert.equal(settings.APP_THEME_ID, 104);
  assert.equal(settings.CUSTOM_ACCENT_COLOR, '#112233');
  assert.equal(settings.desktopReaderAutoHide, false);
  assert.equal(settings.desktopReaderHideDelay, 8.2);
  assert.equal(state.settings.APP_LOCALE, undefined);
  const restored = await importBackup({ filename, contentDirectory: root });
  assert.equal(restored.isDesktopBackup, true);
});
