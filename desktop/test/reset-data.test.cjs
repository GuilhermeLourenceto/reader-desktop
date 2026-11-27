const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { sourcePartitionName, resetSessionForPath, freshSettings, pendingReset, markReset, resetLocale, inspectReset, completeReset } = require('../src/infrastructure/resetData.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-reset-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const profile = path.join(root, 'profile');
  fs.mkdirSync(profile);
  const put = (name, content = 'private data') => {
    const target = path.join(profile, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    return target;
  };
  const reset = (clearSessions = async () => {}, writeInitial = async () => put('library.json', JSON.stringify({ novels: [], settings: freshSettings() }))) =>
    completeReset({ profile, browserRoot: profile, clearSessions, writeInitial });
  return { root, profile, put, reset };
}
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

test('reset only removes owned data, preserves ZIPs and starts onboarding', async t => {
  const { profile, put, reset } = fixture(t);
  const data = ['library.json', 'library.json.bak', 'library.json.tmp', 'library.json.corrupt-123', 'before-restore.json', 'before-restore.json.bak', 'before-restore.json.tmp', 'automatic-backup-status.json', 'automatic-backup-status.json.tmp', 'content/' + 'a'.repeat(64), 'content/' + 'b'.repeat(64) + '.12345678-1234-1234-1234-123456789abc.tmp', 'diagnostics/reader.1.jsonl'].map(name => put(name));
  const keep = ['manual.ZIP', 'ReaderDesktop-auto-2026-11-27T00-00-00-000Z.zip', 'content/my-backup.zip', 'diagnostics/report.txt', 'notes.txt'].map(name => put(name, Buffer.from('504b0506' + '00'.repeat(18), 'hex')));
  const hashes = keep.map(digest);
  const oldPartition = put('Partitions/lnreader-source-removed/Network/Cookies');
  markReset(profile);
  let sessions;
  await reset(async paths => { sessions = paths; fs.unlinkSync(oldPartition); });
  assert.deepEqual(sessions, [path.join(profile, 'Partitions', 'lnreader-source-removed')]);
  assert.equal(pendingReset(profile), false);
  assert.equal(JSON.parse(fs.readFileSync(data[0], 'utf8')).settings.desktopOnboardingCompleted, false);
  for (const filename of data.slice(1)) assert.equal(fs.existsSync(filename), false, filename);
  assert.deepEqual(keep.map(digest), hashes);
});

test('archive in browser tree blocks reset without deleting old library', async t => {
  const { profile, put, reset } = fixture(t);
  const library = put('library.json');
  const archive = put('Cache/hidden-backup.ZIP');
  markReset(profile);
  await assert.rejects(reset(), /RESET_ARCHIVE/);
  assert.equal(fs.existsSync(archive), true);
  assert.equal(fs.existsSync(library), true);
  assert.equal(pendingReset(profile), true);
});

test('ZIP content under a managed name is refused', async t => {
  const { profile, put } = fixture(t);
  put('content/' + 'a'.repeat(64), Buffer.from('504b05060000', 'hex'));
  await assert.rejects(inspectReset(profile, profile), /RESET_ARCHIVE/);
  assert.equal(pendingReset(profile), false);
});

test('interrupted reset remains pending and retry creates a fresh state', async t => {
  const { profile, put, reset } = fixture(t);
  put('library.json'); put('library.json.bak');
  const zip = put('backup.zip'); const hash = digest(zip);
  markReset(profile);
  await assert.rejects(reset(async () => { throw Error('session failure'); }), /session failure/);
  assert.equal(fs.existsSync(path.join(profile, 'library.json')), true);
  await assert.rejects(reset(async () => {}, async () => { throw Error('write failure'); }), /write failure/);
  assert.equal(pendingReset(profile), true);
  await reset();
  assert.equal(pendingReset(profile), false);
  assert.equal(digest(zip), hash);
});

test('links to external directories and invalid markers fail closed', async t => {
  const { root, profile, put, reset } = fixture(t);
  const outside = path.join(root, 'outside'); fs.mkdirSync(outside);
  const external = path.join(outside, 'backup.zip'); fs.writeFileSync(external, 'external');
  fs.symlinkSync(outside, path.join(profile, 'content'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(inspectReset(profile, profile), /RESET_UNSAFE/);
  assert.equal(fs.readFileSync(external, 'utf8'), 'external');
  fs.unlinkSync(path.join(profile, 'content'));
  put('reset-pending.json', 'invalid');
  const library = put('library.json');
  await assert.rejects(reset(), /RESET_UNSAFE/);
  assert.equal(fs.existsSync(library), true);
});

test('separate browser storage and removed source partitions are both included', async t => {
  const { root, profile, put } = fixture(t);
  const browserRoot = path.join(root, 'browser');
  const partition = path.join(browserRoot, 'Partitions', 'lnreader-source-old');
  fs.mkdirSync(partition, { recursive: true });
  fs.writeFileSync(path.join(partition, 'LOCK'), '');
  put('library.json');
  const plan = await inspectReset(profile, browserRoot);
  assert.deepEqual(plan.sessionPaths.sort(), [profile, partition].sort());
  assert.deepEqual(plan.files, [path.join(profile, 'library.json')]);
});

test('renamed archive in browser data is caught on restart, before any deletion', async t => {
  const { profile, put, reset } = fixture(t);
  const library = put('library.json');
  const archive = put('Cookies', Buffer.from('504b0506' + '00'.repeat(18), 'hex'));
  const before = digest(archive);
  await inspectReset(profile, profile, { browserHeaders: false });
  markReset(profile);
  await assert.rejects(reset(), /RESET_ARCHIVE/);
  assert.equal(pendingReset(profile), true);
  assert.equal(fs.existsSync(library), true);
  assert.equal(digest(archive), before);
});

test('legitimate backup subfolders and unrelated partitions are not traversed or removed', async t => {
  const { profile, put, reset } = fixture(t);
  const library = put('library.json');
  const archives = [put('My backups/manual.zip'), put('My backups/Automatic/auto.ZIP'),
    put('Partitions/unrelated/backup.zip')];
  const hashes = archives.map(digest);
  markReset(profile, 'pt-BR');
  assert.equal(resetLocale(profile), 'pt-BR');
  await reset(async paths => assert.deepEqual(paths, []));
  assert.deepEqual(archives.map(digest), hashes);
  assert.equal(JSON.parse(fs.readFileSync(library, 'utf8')).settings.desktopInterfaceLanguage, 'en');
});

test('legacy marker is readable and invalid locale cannot authorize a reset', async t => {
  const { profile, put, reset } = fixture(t);
  const marker = put('reset-pending.json', '{"version":1}\n');
  assert.equal(resetLocale(profile), 'en');
  await reset();
  fs.writeFileSync(marker, JSON.stringify({ version: 1, locale: '../other' }));
  assert.equal(resetLocale(profile), 'en');
  await assert.rejects(reset(), /RESET_UNSAFE/);
  assert.equal(pendingReset(profile), true);
});

test('links in recognized browser storage still block cleanup', async t => {
  const { root, profile, put } = fixture(t);
  const outside = path.join(root, 'outside'); fs.mkdirSync(outside);
  const archive = path.join(outside, 'backup.zip'); fs.writeFileSync(archive, 'keep');
  fs.symlinkSync(outside, path.join(profile, 'IndexedDB'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(inspectReset(profile, profile), /RESET_UNSAFE/);
  assert.equal(fs.readFileSync(archive, 'utf8'), 'keep');
});


test('reset reuses the live source partition key instead of opening a duplicate browser context', async t => {
  const { root, profile } = fixture(t);
  const browserRoot = path.join(root, 'browser');
  const currentPath = path.join(browserRoot, 'Partitions', 'lnreader-source-mixed');
  const legacyPath = path.join(profile, 'Partitions', 'lnreader-source-old');
  const calls = [];
  const live = { getStoragePath: () => currentPath };
  const legacy = { getStoragePath: () => legacyPath };
  const session = {
    fromPartition(name) { calls.push(['partition', name]); return live; },
    fromPath(directory) { calls.push(['path', directory]); return legacy; },
  };
  assert.equal(sourcePartitionName('MiXeD'), 'persist:lnreader-source-mixed');
  assert.equal(resetSessionForPath(session, browserRoot, currentPath), live);
  assert.equal(resetSessionForPath(session, browserRoot, legacyPath), legacy);
  assert.deepEqual(calls, [['partition', sourcePartitionName('MiXeD')], ['path', legacyPath]]);
  assert.throws(() => resetSessionForPath(session, browserRoot, path.join(browserRoot, 'Partitions', 'lnreader-source-wrong')), /RESET_UNSAFE/);
});
