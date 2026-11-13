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
    const diagnosticFile = path.join(folder, 'reader.jsonl');
    await fs.promises.utimes(diagnosticFile, new Date(clock - 20 * 86400000), new Date(clock - 20 * 86400000));
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
