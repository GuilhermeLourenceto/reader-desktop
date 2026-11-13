const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDiagnostics, redact } = require('../src/diagnostics.cjs');

async function withLogger(fn, options = {}) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reader-diagnostics-test-'));
  try {
    const folder = path.join(root, 'diagnostics');
    const logger = createDiagnostics({ directory: folder, ...options });
    await fn(logger, folder, root);
  } finally { await fs.promises.rm(root, { recursive: true, force: true }); }
}

test('redact never stores URL, home path, email and common secrets', () => {
  const input = 'Error https://site.com/a?token=ABC at /home/alice/library/test.zip from a@host.com password=hunter2 Bearer ey1.xyz';
  const output = redact(input);
  for (const secret of ['https://site.com', '/home/alice', 'a@host.com', 'hunter2', 'ey1.xyz'])
    assert.equal(output.includes(secret), false, secret);
});

test('persists and reads events after recreating the logger', async () => {
  await withLogger(async (logger, folder) => {
    const result = await logger.record({ code: 'BKP-IMPORT', operation: 'restore', message: 'CRC incorreto' });
    assert.match(result.id, /^[a-f0-9-]+$/);
    const other = createDiagnostics({ directory: folder });
    const { entries } = await other.list();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].code, 'BKP-IMPORT');
  });
});

test('rotates without exceeding three files and reads newest events', async () => {
  await withLogger(async (logger, folder) => {
    for (let i = 0; i < 45; i++)
      await logger.record({ code: 'BKP-TEST', operation: 'backup', message: `falha numero ${i} ${'x'.repeat(24)}` });
    const list = await logger.list({ limit: 100 });
    assert.ok(list.entries.length > 0);
    assert.equal(list.entries[0].message.startsWith('falha numero 44'), true);
    const files = (await fs.promises.readdir(folder)).filter(x => x.endsWith('.jsonl'));
    assert.ok(files.length <= 3);
    const sizes = await Promise.all(files.map(async f => (await fs.promises.stat(path.join(folder, f))).size));
    assert.ok(sizes.every(x => x <= 460));
  }, { maxFileBytes: 460 });
});

test('collapses repeat storms and emits summary on listing', async () => {
  await withLogger(async (logger) => {
    for (let i = 0; i < 50; i++)
      await logger.record({ code: 'SRC-TIMEOUT', operation: 'source', message: 'Fonte não respondeu' });
    const list = await logger.list();
    assert.equal(list.entries.length, 2);
    assert.match(list.entries[0].message, /49/);
  });
});

test('enforces age limit, clears and exports a reviewable text report', async () => {
  let clock = Date.now();
  await withLogger(async (logger, folder, root) => {
    await logger.record({ code: 'UI-ERROR', operation: 'interface', message: 'bug' });
    clock += 20 * 86400000;
    const filtered = await logger.list();
    assert.equal(filtered.entries.length, 0);
    await logger.record({ code: 'UI-ERROR', operation: 'interface', message: 'Second error' });
    const destination = path.join(root, 'report.txt');
    assert.deepEqual(await logger.exportReport(destination, { version: '0.4.5', platform: 'linux', arch: 'x64' }), {saved:true,count:1});
    assert.match(await fs.promises.readFile(destination, 'utf8'), /Second error/);
    assert.equal(await logger.clear(), true);
    assert.equal((await logger.list()).entries.length, 0);
    assert.ok((await fs.promises.stat(destination)).isFile());
  }, { now: () => clock });
});

test('silently fails when log location is unusable', async () => {
  await withLogger(async (_logger, _folder, root) => {
    const badDir = path.join(root, 'not-a-directory');
    await fs.promises.writeFile(badDir, 'file');
    const logger = createDiagnostics({ directory: badDir });
    assert.equal(await logger.record({ code: 'BKP-ERROR', message: 'error' }), null);
    assert.deepEqual((await logger.list()).entries, []);
    assert.equal(await logger.clear(), false);
  });
});

test('redacts arbitrary Unix paths and complete Basic credentials', () => {
  const input = 'at /root/.local/secret at /srv/data/book at /opt/app/worker.js Authorization: Basic dXNlcjpwYXNz';
  const result = redact(input);
  for (const secret of ['/root/.local', '/srv/data', '/opt/app', 'dXNlcjpwYXNz'])
    assert.equal(result.includes(secret), false, secret);
});

test('expires individual events inside an actively written log', async () => {
  let clock = Date.now();
  await withLogger(async (logger, folder) => {
    await logger.record({ code: 'OLD-EVENT', level: 'error', message: 'old event' });
    clock += 15 * 86400000;
    // Keep file mtime fresh: the age filter must inspect individual entries.
    await fs.promises.utimes(path.join(folder, 'reader.jsonl'), new Date(clock), new Date(clock));
    await logger.record({ code: 'NEW-EVENT', level: 'error', message: 'new event' });
    const { entries } = await logger.list();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].code, 'NEW-EVENT');
  }, { now: () => clock });
});

test('does not follow a symlink masquerading as the diagnostics folder', async t => {
  await withLogger(async (_logger, folder, root) => {
    const other = path.join(root, 'other');
    await fs.promises.mkdir(other);
    try { await fs.promises.symlink(other, folder, 'dir'); }
    catch (error) {
      if (['EPERM', 'ENOSYS', 'EACCES'].includes(error.code)) return t.skip();
      throw error;
    }
    const logger = createDiagnostics({ directory: folder });
    assert.equal(await logger.record({ code: 'SAFE-TEST', message: 'try writing' }), null);
    assert.deepEqual(await fs.promises.readdir(other), []);
  });
});

test('sanitizes older on-disk logs before displaying or exporting', async () => {
  await withLogger(async (logger, folder, root) => {
    await fs.promises.mkdir(folder, { recursive: true });
    const event = {
      id: 'legacy-log-id', at: new Date().toISOString(), level: 'error',
      operation: 'storage', code: 'STO-FAILED', message: 'Arquivo /srv/secret/private.txt'
    };
    const filename = path.join(folder, 'reader.jsonl');
    await fs.promises.writeFile(filename, JSON.stringify(event) + '\n');
    const { entries } = await logger.list();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].message, 'Arquivo [PATH]');
    assert.equal((await fs.promises.readFile(filename, 'utf8')).includes('/srv/secret'), false);
    const out = path.join(root, 'redacted.txt');
    assert.equal((await logger.exportReport(out)).saved, true);
    assert.equal((await fs.promises.readFile(out, 'utf8')).includes('/srv/secret'), false);
  });
});

test('ignores malformed disk entries with untrusted IDs and types', async () => {
  await withLogger(async (logger, folder) => {
    await fs.promises.mkdir(folder, { recursive: true });
    const invalid = {
      id: 'bad\\nentry', at: new Date().toISOString(), level: 'error',
      operation: 'backup', code: 'BKP-TEST', message: 'abc',
    };
    await fs.promises.writeFile(path.join(folder, 'reader.jsonl'), JSON.stringify(invalid) + '\n');
    assert.equal((await logger.list()).entries.length, 0);
  });
});

test('log directory and exported reports use private POSIX permissions', async t => {
  if (process.platform === 'win32') return t.skip();
  await withLogger(async (logger, folder, root) => {
    await logger.record({ code: 'SEC-TEST', operation: 'app', message: 'test' });
    assert.equal((await fs.promises.stat(folder)).mode & 0o777, 0o700);
    assert.equal((await fs.promises.stat(path.join(folder, 'reader.jsonl'))).mode & 0o777, 0o600);
    const report = path.join(root, 'private-report.txt');
    assert.equal((await logger.exportReport(report)).saved, true);
    assert.equal((await fs.promises.stat(report)).mode & 0o777, 0o600);
  });
});

test('large error bursts are bounded and do not crash the logger', async () => {
  await withLogger(async logger => {
    const sent = await Promise.all(Array.from({ length: 1024 }, (_, n) =>
      logger.record({ code: 'SRC-ERROR', operation: 'source', message: `issue ${n}` })));
    assert.ok(sent.some(item => item === null));
    assert.ok(sent.some(item => item && item.code === 'SRC-ERROR'));
    const listed = await logger.list();
    assert.ok(listed.entries.length > 0);
    assert.ok(listed.usedBytes <= listed.limitBytes);
  });
});
