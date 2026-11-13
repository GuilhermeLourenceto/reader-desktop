const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Worker } = require('node:worker_threads');
const { DiskFiles } = require('../src/storage.cjs');
const { emptyState, parseBackup } = require('../dist/backup.cjs');
const job = input =>
  new Promise((resolve, reject) => {
    const worker = new Worker(
      path.join(__dirname, '../dist/backup-worker.cjs'),
      { workerData: input },
    );
    worker.once('message', resolve);
    worker.once('error', reject);
  });
test('background backup preserves library/progress despite damaged files and returns compact import references', async t => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lnreader-backup-worker-'),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(path.join(root, 'content'));
  const files = store.import({
    'Novels/source/1/1/index.html':
      Buffer.from('<p>Chapter</p>').toString('base64'),
    'Novels/source/1/2/index.html':
      Buffer.from('<p>Missing</p>').toString('base64'),
    'Covers/1': Buffer.from('damaged cover').toString('base64'),
  });
  fs.unlinkSync(
    path.join(store.directory, files['Novels/source/1/2/index.html'].slice(6)),
  );
  fs.writeFileSync(
    path.join(store.directory, files['Covers/1'].slice(6)),
    'broken',
  );
  const state = {
    ...emptyState(),
    files,
    novels: [
      {
        id: 1,
        pluginId: 'source',
        name: 'Book',
        path: '/book',
        chapters: [1, 2].map(id => ({
          id,
          novelId: 1,
          name: 'Chapter ' + id,
          path: '/c' + id,
          progress: 50,
          isDownloaded: true,
        })),
      },
    ],
  };
  const filename = path.join(root, 'backup.zip');
  const exported = await job({
    action: 'export',
    state,
    filename,
    contentDirectory: store.directory,
  });
  assert.equal(exported.ok, false);
  assert.match(exported.message, /2 arquivo\(s\) ausente\(s\)/);
  assert.equal(fs.existsSync(filename), false);
  assert.equal(state.novels[0].chapters[1].progress, 50);
});

test('repeated export/import keeps bytes, metadata and existing content blobs unchanged', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-repeat-backup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(path.join(root, 'content'));
  const html = Buffer.from('<p>Repeated import retains precise chapter content</p>');
  const key = 'Novels/site/1/10/index.html';
  const state = {
    ...emptyState(),
    novels: [{
      id: 1, pluginId: 'site', name: 'Saved', path: '/book',
      chapters: [{ id: 10, name: 'Chapter', path: '/ch', isDownloaded: true,
        progress: 72, bookmark: true }],
    }],
    files: { [key]: store.write(html) },
  };
  const archive = path.join(root, 'backup.zip');
  const first = await job({ action: 'export', state, filename: archive, contentDirectory: store.directory });
  assert.equal(first.ok, true);
  assert.equal(first.result.missingCount, 0);
  const reference = state.files[key];
  const existingFile = path.join(store.directory, reference.slice(6));
  const mtime = fs.statSync(existingFile).mtimeMs;
  const original = fs.readFileSync(archive);
  for (let attempt = 0; attempt < 2; attempt++) {
    const imported = await job({ action: 'import', filename: archive, contentDirectory: store.directory });
    assert.equal(imported.ok, true);
    assert.equal(imported.restored.state.files[key], reference);
    assert.equal(imported.restored.state.novels[0].chapters[0].progress, 72);
    assert.equal(imported.restored.state.novels[0].chapters[0].bookmark, true);
  }
  assert.deepEqual(fs.readFileSync(existingFile), html);
  assert.equal(fs.statSync(existingFile).mtimeMs, mtime);
  assert.deepEqual(fs.readFileSync(archive), original);
});

test('an invalid export leaves the existing backup intact and does not leave a partial ZIP', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-atomic-export-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(path.join(root, 'content'));
  const filename = path.join(root, 'existing.zip');
  const state = { ...emptyState(), files: {} };
  const initial = await job({ action: 'export', filename, contentDirectory: store.directory, state });
  assert.equal(initial.ok, true);
  const original = fs.readFileSync(filename);
  const invalid = { ...state, files: { '../invalid': store.write(Buffer.from('content')) } };
  const rejected = await job({ action: 'export', filename, contentDirectory: store.directory, state: invalid });
  assert.equal(rejected.ok, false);
  assert.deepEqual(fs.readFileSync(filename), original);
  assert.equal(fs.existsSync(filename + '.tmp'), false);
});

test('metadata-only automatic export keeps covers and reading progress', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-metadata-only-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(path.join(root, 'content'));
  const state = {
    ...emptyState(),
    novels: [{
      id: 2, pluginId: 'source', path: '/book', name: 'Book',
      chapters: [{
        id: 3, novelId: 2, name: 'Chapter', path: '/chapter',
        isDownloaded: true, progress: 85,
      }],
    }],
    files: store.import({
      'Novels/source/2/3/index.html': Buffer.from('<p>offline</p>').toString('base64'),
      'Novels/source/2/cover.png': Buffer.from('cover').toString('base64'),
    }),
  };
  const filename = path.join(root, 'metadata.zip');
  const exported = await job({
    action: 'export', state, includeDownloads: false,
    filename, contentDirectory: store.directory,
  });
  assert.equal(exported.ok, true);
  const parsed = parseBackup(fs.readFileSync(filename));
  assert.equal(parsed.sections.downloadedFiles, false);
  assert.equal(parsed.state.files['Covers/2'], Buffer.from('cover').toString('base64'));
  assert.equal(parsed.state.novels[0].chapters[0].isDownloaded, false);
  assert.equal(parsed.state.novels[0].chapters[0].progress, 85);
});
