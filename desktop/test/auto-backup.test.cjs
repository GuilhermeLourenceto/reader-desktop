const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAutoBackupManager } = require('../src/autoBackup.cjs');

function fixture(t, frequency = 'launch') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-auto-'));
  const folder = path.join(root, 'backups');
  fs.mkdirSync(folder);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let clock = Date.parse('2026-11-01T00:00:00Z');
  let state = { novels: [], plugins: [], settings: {
    desktopOnboardingCompleted: true,
    desktopBackupFrequency: frequency, desktopBackupDirectory: folder,
    desktopBackupIncludeDownloads: true,
  }, files: {} };
  let fail = false;
  let delay = null;
  const jobs = [];
  const backup = async ({ filename, state: snapshot }) => {
    jobs.push({ filename, snapshot });
    if (delay) await delay;
    if (fail) {
      fs.writeFileSync(filename + '.tmp', 'partial');
      throw Error('disk full');
    }
    fs.writeFileSync(filename, 'valid-' + jobs.length);
  };
  const make = () => createAutoBackupManager({
    dataDirectory: root, getState: () => state, contentDirectory: root,
    exportBackup: backup, now: () => clock,
  });
  return {
    root, folder, jobs, make, get state() { return state; },
    setState(s) { state = s; }, advance(ms) { clock += ms; },
    setFail(v) { fail = v; }, setDelay(v) { delay = v; },
    listAuto() { return fs.readdirSync(folder).filter(x => x.startsWith('ReaderDesktop-auto-')).sort(); },
    status() { return JSON.parse(fs.readFileSync(path.join(root, 'automatic-backup-status.json'), 'utf8')); },
  };
}

test('first-run incomplete, disabled, invalid directory and unchanged data skip automatic backups', async t => {
  const f = fixture(t, '24'), manager = f.make();
  f.setState({ ...f.state, settings: { ...f.state.settings, desktopOnboardingCompleted: false } });
  assert.equal(await manager.check({ launch: true }), false);
  f.setState({ ...f.state, settings: { ...f.state.settings, desktopOnboardingCompleted: true, desktopBackupDirectory: '/path/that/does/not/exist' } });
  assert.equal(await manager.check({ launch: true }), false);
  f.setState({ ...f.state, settings: { ...f.state.settings, desktopBackupDirectory: f.folder } });
  assert.equal(await manager.check({ launch: true }), true);
  assert.equal(await manager.check(), false);
  assert.equal(await manager.check({ launch: true }), false);
  f.advance(25 * 3600000);
  assert.equal(await manager.check(), false);
  f.setState({ ...f.state, novels: [{ id: 1 }] });
  assert.equal(await manager.check(), true);
  f.setState({ ...f.state, settings: { ...f.state.settings, desktopBackupFrequency: 'off' } });
  assert.equal(await manager.check({ launch: true }), false);
  assert.equal(f.jobs.length, 2);
});

test('sixth automatic deletes exactly the oldest, keeps five newest and never removes manual ZIPs', async t => {
  const f = fixture(t);
  const manual = [];
  for (let i = 0; i < 18; i++) {
    const name = 'My manual backup ' + i + '.zip';
    fs.writeFileSync(path.join(f.folder, name), 'manual-' + i);
    manual.push(name);
  }
  let first, second;
  for (let i = 0; i < 7; i++) {
    f.setState({ ...f.state, settings: { ...f.state.settings, marker: i } });
    const manager = f.make();
    assert.equal(await manager.check({ launch: true }), true);
    const names = f.listAuto();
    if (i === 0) first = names[0];
    if (i === 1) second = names[1];
    assert.equal(names.length, Math.min(i + 1, 5));
    assert.equal(await manager.check({ launch: true }), false);
    f.advance(86400000);
  }
  assert.equal(fs.existsSync(path.join(f.folder, first)), false);
  assert.equal(fs.existsSync(path.join(f.folder, second)), false);
  assert.equal(f.listAuto().length, 5);
  assert.equal(f.status().managed[f.folder].length, 5);
  for (let i = 0; i < manual.length; i++)
    assert.equal(fs.readFileSync(path.join(f.folder, manual[i]), 'utf8'), 'manual-' + i);
});

test('manually named ZIP resembling an automatic archive is not deleted unless registered as automatic', async t => {
  const f = fixture(t);
  const manualName = 'ReaderDesktop-auto-2000-01-01T00-00-00-000Z.zip';
  // Start an automatic history first so legacy migration does not claim
  // unrelated later files based solely on their name.
  assert.equal(await f.make().check({ launch: true }), true);
  fs.writeFileSync(path.join(f.folder, manualName), 'manually created');
  for (let i = 1; i < 7; i++) {
    f.advance(86400000);
    f.setState({ ...f.state, settings: { ...f.state.settings, marker: i } });
    assert.equal(await f.make().check({ launch: true }), true);
  }
  assert.equal(fs.readFileSync(path.join(f.folder, manualName), 'utf8'), 'manually created');
  assert.equal(f.status().managed[f.folder].length, 5);
});

test('failed export leaves five valid archives and cleans temporary ZIP; subsequent launch succeeds', async t => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) {
    f.setState({ ...f.state, settings: { ...f.state.settings, marker: i } });
    assert.equal(await f.make().check({ launch: true }), true);
    f.advance(86400000);
  }
  const old = f.listAuto();
  f.setFail(true);
  f.setState({ ...f.state, settings: { ...f.state.settings, marker: 5 } });
  assert.equal(await f.make().check({ launch: true }), false);
  assert.deepEqual(f.listAuto(), old);
  assert.equal(fs.readdirSync(f.folder).some(name => name.endsWith('.zip.tmp')), false);
  f.setFail(false);
  assert.equal(await f.make().check({ launch: true }), true);
  assert.equal(f.listAuto().length, 5);
  assert.equal(fs.existsSync(path.join(f.folder, old[0])), false);
});

test('same timestamp does not overwrite a manual file and concurrent checks export once', async t => {
  const f = fixture(t, '24');
  const conflicting = 'ReaderDesktop-auto-2026-11-01T00-00-00-000Z.zip';
  fs.writeFileSync(path.join(f.folder, conflicting), 'protected');
  let resolve;
  f.setDelay(new Promise(r => { resolve = r; }));
  const manager = f.make();
  const first = manager.check({ launch: true });
  assert.equal(await manager.check({ launch: true }), false);
  resolve();
  assert.equal(await first, true);
  assert.equal(f.jobs.length, 1);
  assert.equal(fs.readFileSync(path.join(f.folder, conflicting), 'utf8'), 'protected');
  assert.notEqual(path.basename(f.jobs[0].filename), conflicting);
});

test('frequency thresholds and folder switch are independent, downloaded chapters can be excluded', async t => {
  for (const [frequency, hours] of [['6',6],['12',12],['24',24],['48',48],['168',168]]) {
    await t.test(frequency, async inner => {
      const f = fixture(inner, frequency);
      f.setState({ ...f.state, files: {
        'Novels/source/1/1/index.html': 'download',
        'Covers/1': 'cover',
      }, settings: { ...f.state.settings, desktopBackupIncludeDownloads: false } });
      const manager = f.make();
      assert.equal(await manager.check({ launch: true }), true);
      assert.deepEqual(Object.keys(f.jobs[0].snapshot.files), ['Covers/1']);
      f.setState({ ...f.state, novels: [{ id: 2 }] });
      f.advance(hours * 3600000 - 1);
      assert.equal(await manager.check(), false);
      f.advance(1);
      assert.equal(await manager.check(), true);
      const newFolder = path.join(f.root, 'new');
      fs.mkdirSync(newFolder);
      f.setState({ ...f.state, settings: { ...f.state.settings, desktopBackupDirectory: newFolder } });
      assert.equal(await manager.check(), true, 'switching to a different directory must not wait for the old interval');
      assert.equal(fs.readdirSync(f.folder).filter(name => name.endsWith('.zip')).length, 2);
      assert.equal(fs.readdirSync(newFolder).filter(name => name.endsWith('.zip')).length, 1);
    });
  }
});

test('legacy metadata migrates only auto-named files from its recorded folder', async t => {
  const f = fixture(t);
  const filenames = [];
  for (let i = 1; i <= 5; i++) {
    const filename = 'ReaderDesktop-auto-2026-10-0' + i + 'T00-00-00-000Z.zip';
    filenames.push(filename);
    fs.writeFileSync(path.join(f.folder, filename), 'old-auto-' + i);
  }
  fs.writeFileSync(path.join(f.root, 'automatic-backup-status.json'),
    JSON.stringify({ at: 1, folder: f.folder, fingerprint: 'old' }));
  f.setState({ ...f.state, settings: { ...f.state.settings, marker: 123 } });
  assert.equal(await f.make().check({ launch: true }), true);
  assert.equal(fs.existsSync(path.join(f.folder, filenames[0])), false);
  assert.equal(f.status().managed[f.folder].length, 5);
});
