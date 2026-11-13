// Manual stress test: workspace-only synthetic data, excluded from npm test.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { emptyState } = require('../dist/backup.cjs');
const { DiskFiles, writeState, readState } = require('../src/storage.cjs');
const { Worker } = require('node:worker_threads');
const backupJob = input =>
  new Promise((resolve, reject) => {
    const worker = new Worker(
      process.argv.find(arg => arg.startsWith('--worker='))?.slice(9) ||
        path.join(__dirname, '../dist/backup-worker.cjs'),
      { workerData: input, resourceLimits: { maxOldGenerationSizeMb: 1024 } },
    );
    worker.on('message', v => {
      if (v.progress === true) return;
      v.ok ? resolve(v.restored ?? v.result) : reject(new Error(v.message));
    });
    worker.once('error', reject);
    worker.once('exit', code => {
      if (code) reject(new Error('Worker exit ' + code));
    });
  });
const root = fs.mkdtempSync(path.join(__dirname, '../.tmp/load-benchmark-'));
const metrics = { root, node: process.version, steps: [] };
let peak = 0;
const sample = setInterval(() => {
  peak = Math.max(peak, process.memoryUsage().rss);
}, 50);
async function measure(name, action) {
  const start = performance.now();
  const result = await action();
  const metric = {
    name,
    seconds: +((performance.now() - start) / 1000).toFixed(3),
  };
  metrics.steps.push(metric);
  console.log(JSON.stringify(metric));
  return result;
}
(async () => {
  const state = emptyState();
  let chapterId = 0;
  state.novels = Array.from({ length: 7000 }, (_, i) => ({
    id: i + 1,
    name: `Obra de teste ${i + 1}`,
    path: `/book/${i + 1}`,
    pluginId: 'stress',
    inLibrary: true,
    chapters: Array.from({ length: i === 0 ? 4000 : 20 }, (_, j) => ({
      id: ++chapterId,
      novelId: i + 1,
      name: `Capítulo ${j + 1}`,
      path: `/book/${i + 1}/${j + 1}`,
      chapterNumber: j + 1,
      unread: j % 3 !== 0,
      progress: j % 3 === 0 ? 100 : 25,
      desktopProgressUnit: 'percent',
      bookmark: j % 11 === 0,
    })),
  }));
  metrics.novels = state.novels.length;
  metrics.chapters = chapterId;
  const filename = path.join(root, 'library.json');
  await measure('write_metadata', () => writeState(filename, state));
  const loaded = await measure(
    'read_validate_metadata',
    () => readState(filename, emptyState).state,
  );
  assert.equal(loaded.novels.length, 7000);
  const contentDirectory = path.join(root, 'content');
  const files = new DiskFiles(contentDirectory);
  for (let i = 0; i < 64; i++)
    state.files[`Covers/${i + 1}`] = files.write(randomBytes(1024 * 1024));
  const archive = path.join(root, 'large.zip');
  const exported = await measure('export_64MiB_7000_books', () =>
    backupJob({ action: 'export', state, filename: archive, contentDirectory }),
  );
  assert.equal(exported.missingCount, 0);
  const restored = await measure('import_64MiB_7000_books', () =>
    backupJob({
      action: 'import',
      filename: archive,
      contentDirectory: path.join(root, 'restored-content'),
    }),
  );
  assert.equal(restored.state.novels.length, 7000);
  assert.equal(
    restored.state.novels.reduce((n, b) => n + b.chapters.length, 0),
    chapterId,
  );
  assert.deepEqual(
    restored.state.novels[0].chapters,
    state.novels[0].chapters.map(c => ({ ...c, isDownloaded: false })),
  );
  assert.equal(Object.keys(restored.state.files).length, 64);
  const recoveredStore = new DiskFiles(path.join(root, 'restored-content'));
  for (const [key, value] of Object.entries(state.files))
    assert.deepEqual(
      files.read(value),
      recoveredStore.read(restored.state.files[key]),
    );
  // A sparse oversized ZIP tests the guard without allocating 513 MB of RAM.
  const oversized = path.join(root, 'oversized.zip');
  fs.closeSync(fs.openSync(oversized, 'w'));
  fs.truncateSync(oversized, 513 * 1024 * 1024);
  await assert.rejects(
    backupJob({ action: 'import', filename: oversized, contentDirectory }),
    /512 MB/,
  );
  fs.unlinkSync(oversized);
  metrics.zipMiB = +(fs.statSync(archive).size / 1024 / 1024).toFixed(2);
  metrics.peakProcessRSSMiB = +(
    Math.max(peak, process.memoryUsage().rss) /
    1024 /
    1024
  ).toFixed(1);
  metrics.pass = true;
  fs.writeFileSync(
    path.join(__dirname, '../.tmp/load-benchmark-latest.json'),
    JSON.stringify(metrics, null, 2),
  );
  // Retain only the small metadata fixture and measurements for the UI test.
  for (const name of ['content', 'restored-content']) {
    const target = path.resolve(root, name);
    const workspaceTemp = path.resolve(__dirname, '../.tmp') + path.sep;
    if (
      !target.startsWith(workspaceTemp) ||
      path.dirname(target) !== path.resolve(root)
    )
      throw new Error('Refusing cleanup outside the benchmark directory');
    fs.rmSync(target, { recursive: true, force: true });
  }
  fs.unlinkSync(archive);
  console.log(JSON.stringify(metrics));
})()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearInterval(sample));
