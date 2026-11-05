const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAutoBackupManager } = require('../src/autoBackup.cjs');
const { Worker } = require('node:worker_threads');
const { emptyState, parseBackup } = require('../dist/backup.cjs');
// Use the production worker bundle; raw upstream TypeScript enums are only
// supported by esbuild, not by Node's strip-only TypeScript loader.
function backupJob(input) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../dist/backup-worker.cjs'), {
      workerData: input,
    });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };
    worker.on('message', value => value.ok
      ? finish(null, value.restored ?? value.result)
      : finish(Error(value.message)));
    worker.on('error', finish);
    worker.on('exit', code => {
      if (!settled) finish(Error('Worker exited: ' + code));
    });
  });
}
const { DiskFiles } = require('../src/storage.cjs');

test('real ZIP worker: six automatic snapshots rotate to five; every ZIP imports; manual archive survives', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-real-auto-'));
  const folder = path.join(root, 'archives');
  const contentDirectory = path.join(root, 'content');
  fs.mkdirSync(folder);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const blobs = new DiskFiles(contentDirectory);
  const html = '<p>Chapter contents preserved across real ZIP worker exports.</p>';
  const key = 'Novels/source/1/1/index.html';
  const state = emptyState();
  state.files[key] = blobs.write(Buffer.from(html));
  state.novels = [{
    id: 1, pluginId: 'source', name: 'Stable Novel', path: '/novel',
    chapters: [{ id: 1, name: 'Chapter 1', path: '/chapter1', isDownloaded: true }],
  }];
  state.settings = {
    desktopOnboardingCompleted: true,
    desktopBackupDirectory: folder,
    desktopBackupFrequency: 'launch',
    desktopBackupIncludeDownloads: true,
    desktopInterfaceLanguage: 'en',
  };
  const manualFile = path.join(folder, 'My personal manual archive.zip');
  await backupJob({ action: 'export', state, contentDirectory, filename: manualFile });
  const manualBytes = fs.readFileSync(manualFile);
  let now = Date.parse('2026-10-10T12:00:00Z');
  const names = [];
  for (let n = 0; n < 6; n++) {
    // Simulate saved progress: only the newest backup contains the newest state.
    state.novels[0].chapters[0].progress = n * 10;
    const manager = createAutoBackupManager({
      dataDirectory: root, contentDirectory,
      getState: () => state, exportBackup: backupJob, now: () => now,
    });
    assert.equal(await manager.check({ launch: true }), true, 'real automatic ZIP export ' + n);
    const recorded = JSON.parse(fs.readFileSync(path.join(root, 'automatic-backup-status.json'), 'utf8'));
    const latest = recorded.managed[folder].at(-1);
    assert.ok(latest);
    names.push(latest);
    const bytes = fs.readFileSync(path.join(folder, latest));
    assert.equal(bytes.subarray(0, 2).toString(), 'PK', 'valid ZIP signature');
    const restored = parseBackup(bytes);
    assert.equal(restored.state.novels[0].chapters[0].progress, n * 10);
    assert.equal(Buffer.from(restored.state.files[key], 'base64').toString(), html);
    assert.equal(restored.state.novels[0].chapters[0].isDownloaded, true);
    now += 86400000;
  }
  assert.equal(fs.existsSync(path.join(folder, names[0])), false, 'sixth export removes first automatic');
  assert.ok(names.slice(1).every(name => fs.existsSync(path.join(folder, name))));
  assert.equal(fs.readdirSync(folder).filter(name => name.startsWith('ReaderDesktop-auto-')).length, 5);
  assert.deepEqual(fs.readFileSync(manualFile), manualBytes, 'manual archive untouched byte-for-byte');
});

test('real ZIP worker: disabling downloaded chapters preserves metadata and makes restored chapters offline-free', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-real-no-download-'));
  const folder = path.join(root, 'archives');
  const contentDirectory = path.join(root, 'content');
  fs.mkdirSync(folder);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const blobs = new DiskFiles(contentDirectory);
  const state = emptyState();
  const key = 'Novels/source/1/1/index.html';
  state.files[key] = blobs.write(Buffer.from('<p>Saved chapter</p>'));
  state.novels = [{
    id: 1, pluginId: 'source', name: 'Another Novel', path: '/novel',
    chapters: [{ id: 1, name: 'Chapter 1', path: '/chapter', isDownloaded: true, progress: 27 }],
  }];
  state.settings = {
    desktopOnboardingCompleted: true, desktopBackupDirectory: folder,
    desktopBackupFrequency: 'launch', desktopBackupIncludeDownloads: false,
  };
  const manager = createAutoBackupManager({
    dataDirectory: root, contentDirectory, getState: () => state, exportBackup: backupJob,
    now: () => Date.parse('2026-10-20T10:00:00Z'),
  });
  assert.equal(await manager.check({ launch: true }), true);
  const archive = fs.readdirSync(folder).find(name => name.endsWith('.zip'));
  const parsed = parseBackup(fs.readFileSync(path.join(folder, archive))).state;
  assert.equal(parsed.novels[0].chapters[0].progress, 27);
  assert.equal(parsed.novels[0].chapters[0].isDownloaded, false);
  assert.equal(Object.hasOwn(parsed.files, key), false);
  assert.equal(state.novels[0].chapters[0].isDownloaded, true, 'source data remains intact');
});
