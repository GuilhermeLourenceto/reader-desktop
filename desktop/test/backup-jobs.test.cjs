const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-backup-lock-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const workers = [];
  class FakeWorker extends EventEmitter {
    constructor() { super(); workers.push(this); }
    terminate() { return Promise.resolve(); }
  }
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/backupJobs.cjs'), 'utf8');
  vm.runInNewContext(source, {
    module, require: name => name === 'node:worker_threads' ? { Worker: FakeWorker } : require(name),
    process, __dirname, setTimeout: () => 1, clearTimeout: () => {},
  });
  return { ...module.exports, root, workers };
}

test('destination remains reserved until its worker exits, including directory aliases', async t => {
  const { root, workers, backupJob, isBackupJobActive } = fixture(t);
  const real = path.join(root, 'real');
  const alias = path.join(root, 'alias');
  fs.mkdirSync(real);
  fs.symlinkSync(real, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const input = { action: 'export', filename: path.join(real, 'backup.zip') };
  const duplicate = { ...input, filename: path.join(alias, 'backup.zip') };
  const first = backupJob(input);
  assert.equal(isBackupJobActive(), true);
  await assert.rejects(backupJob(duplicate), /Exportação anterior/);
  assert.equal(workers.length, 1);
  workers[0].emit('message', { ok: true, result: 1 });
  assert.equal(await first, 1);
  await assert.rejects(backupJob(duplicate), /Exportação anterior/);
  workers[0].emit('exit', 0);
  assert.equal(isBackupJobActive(), false);
  const next = backupJob(duplicate);
  workers[1].emit('message', { ok: true, result: 2 });
  workers[1].emit('exit', 0);
  assert.equal(await next, 2);
  assert.equal(isBackupJobActive(), false);
});

test('failed workers keep their destination reserved until exit; other destinations remain usable', async t => {
  const { root, workers, backupJob, isBackupJobActive } = fixture(t);
  const input = { action: 'export', filename: path.join(root, 'one.zip') };
  const first = backupJob(input);
  const second = backupJob({ ...input, filename: path.join(root, 'two.zip') });
  workers[0].emit('error', Error('disk full'));
  await assert.rejects(first, /disk full/);
  await assert.rejects(backupJob(input), /Exportação anterior/);
  workers[0].emit('exit', 1);
  workers[1].emit('message', { ok: true, result: 2 });
  workers[1].emit('exit', 0);
  assert.equal(await second, 2);
  assert.equal(isBackupJobActive(), false);
  const next = backupJob(input);
  workers[2].emit('message', { ok: true, result: 3 });
  workers[2].emit('exit', 0);
  assert.equal(await next, 3);
});
