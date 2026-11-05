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

test('legacy status never guesses ownership: manual lookalike ZIPs survive migration', async t => {
  const f = fixture(t);
  const manual = 'ReaderDesktop-auto-2026-10-01T00-00-00-000Z.zip';
  fs.writeFileSync(path.join(f.folder, manual), 'manual');
  fs.writeFileSync(path.join(f.root, 'automatic-backup-status.json'),
    JSON.stringify({ at: 1, folder: f.folder, fingerprint: 'previous' }));
  assert.equal(await f.make().check({ launch: true }), true);
  assert.equal(fs.readFileSync(path.join(f.folder, manual), 'utf8'), 'manual');
  assert.equal(f.status().ownershipRegistryVersion, 2);
  assert.equal(f.status().managed[f.folder].length, 1);
});

test('manual backup replacing an old automatic archive is protected on rotation', async t => {
  const f = fixture(t);
  let first;
  for (let i = 0; i < 5; i++) {
    f.setState({ ...f.state, settings: { ...f.state.settings, marker: i } });
    assert.equal(await f.make().check({ launch: true }), true);
    if (i === 0) first = f.listAuto()[0];
    f.advance(86400000);
  }
  fs.writeFileSync(path.join(f.folder, first), 'manual replacement with longer content');
  const edited = new Date('2026-11-20T00:00:00Z');
  fs.utimesSync(path.join(f.folder, first), edited, edited);
  f.setState({ ...f.state, settings: { ...f.state.settings, marker: 5 } });
  assert.equal(await f.make().check({ launch: true }), true);
  assert.equal(fs.readFileSync(path.join(f.folder, first), 'utf8'),
    'manual replacement with longer content');
  assert.equal(f.status().managed[f.folder].length, 5);
});

test('partial worker result leaves previous five backups unchanged', async t => {
  const f = fixture(t);
  let result = { missingCount: 0 };
  const make = () => createAutoBackupManager({
    dataDirectory: f.root, contentDirectory: f.root,
    getState: () => f.state,
    now: () => Date.parse('2026-11-05T00:00:00Z') + f.jobs.length * 86400000,
    exportBackup: async ({ filename }) => {
      f.jobs.push(filename);
      fs.writeFileSync(filename, 'zip bytes');
      return result;
    },
  });
  for (let i = 0; i < 5; i++) {
    f.setState({ ...f.state, settings: { ...f.state.settings, marker: i } });
    assert.equal(await make().check({ launch: true }), true);
  }
  const before = f.listAuto();
  result = { missingCount: 1 };
  f.setState({ ...f.state, settings: { ...f.state.settings, marker: 6 } });
  assert.equal(await make().check({ launch: true }), false);
  assert.deepEqual(f.listAuto(), before);
  assert.equal(f.status().managed[f.folder].length, 5);
});

test('clock rollback still keeps the five most recently created automatic backups', async t => {
  const f = fixture(t);
  const times = [
    '2026-11-10T00:00:00Z','2026-11-11T00:00:00Z','2026-11-12T00:00:00Z',
    '2026-11-13T00:00:00Z','2026-11-14T00:00:00Z','2026-11-15T00:00:00Z',
    '2026-11-01T00:00:00Z',
  ].map(Date.parse);
  const made = [];
  for (let i = 0; i < times.length; i++) {
    f.setState({ ...f.state, settings: { ...f.state.settings, marker: i } });
    const manager = createAutoBackupManager({
      dataDirectory: f.root, contentDirectory: f.root, getState: () => f.state,
      now: () => times[i],
      exportBackup: async ({ filename }) => {
        fs.writeFileSync(filename, 'complete'); made.push(path.basename(filename));
      },
    });
    assert.equal(await manager.check({ launch: true }), true);
  }
  const files = f.listAuto();
  assert.equal(files.length, 5);
  assert.equal(files.includes(made[6]), true);
  assert.equal(files.includes(made[0]), false);
  assert.equal(files.includes(made[1]), false);
});

test('real backup worker produces five restorable ZIPs; manual ZIP remains untouched', async t => {
  const { backupJob } = require('../src/backupJobs.cjs');
  const { emptyState, parseBackup, createBackup } = require('../src/backup.cjs');
  const f = fixture(t);
  const contentDirectory = path.join(f.root, 'content');
  fs.mkdirSync(contentDirectory, { recursive: true });
  const manual = path.join(f.folder, 'user-manual.zip');
  fs.writeFileSync(manual, createBackup(emptyState()));
  let time = Date.parse('2026-11-05T00:00:00Z');
  let state = emptyState();
  for (let i = 0; i < 7; i++) {
    state = { ...state, settings: {
      desktopOnboardingCompleted: true, desktopBackupDirectory: f.folder,
      desktopBackupFrequency: 'launch', revision: i,
    } };
    const manager = createAutoBackupManager({
      dataDirectory: f.root, contentDirectory, getState: () => state,
      now: () => time, exportBackup: backupJob,
    });
    assert.equal(await manager.check({ launch: true }), true);
    time += 86400000;
  }
  const status = f.status();
  assert.equal(status.managed[f.folder].length, 5);
  for (const record of status.managed[f.folder]) {
    const restored = parseBackup(fs.readFileSync(path.join(f.folder, record.name)));
    assert.equal(restored.state.settings.desktopOnboardingCompleted, true);
  }
  assert.ok(parseBackup(fs.readFileSync(manual)).state);
});
