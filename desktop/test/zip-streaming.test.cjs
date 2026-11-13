const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomBytes } = require('node:crypto');
const { DiskFiles } = require('../src/storage.cjs');
const { emptyState, parseBackup } = require('../dist/backup.cjs');
const { exportBackup, importBackup } = require('../dist/zipStreaming.cjs');

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
