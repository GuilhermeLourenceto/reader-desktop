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
  assert.equal(exported.ok, true);
  assert.equal(exported.result.missingCount, 2);
  const parsed = parseBackup(fs.readFileSync(filename));
  assert.equal(parsed.state.novels[0].chapters[0].isDownloaded, true);
  assert.equal(parsed.state.novels[0].chapters[1].isDownloaded, false);
  assert.equal(parsed.state.novels[0].chapters[1].progress, 50);
  const imported = await job({
    action: 'import',
    filename,
    contentDirectory: store.directory,
  });
  assert.equal(imported.ok, true);
  assert.ok(
    Object.values(imported.restored.state.files).every(value =>
      value.startsWith('@file:'),
    ),
  );
});
