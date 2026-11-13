const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  DiskFiles,
  readState,
  writeState,
  validateState,
} = require('../src/storage.cjs');
const empty = () => ({ novels: [], plugins: [], files: {} });

test('failed content write cleans its temporary file and preserves saved content', t => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lnreader-write-failure-'),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(root);
  const ref = store.write(Buffer.from('saved chapter'));
  const original = fs.writeFileSync;
  fs.writeFileSync = () => {
    const error = new Error('disk full');
    error.code = 'ENOSPC';
    throw error;
  };
  try {
    assert.throws(() => store.write(Buffer.from('new chapter')), {
      code: 'ENOSPC',
    });
  } finally {
    fs.writeFileSync = original;
  }
  assert.equal(fs.readdirSync(root).length, 1);
  assert.equal(store.read(ref).toString(), 'saved chapter');
});

test('concurrent backup and app writes of identical content do not share a temporary filename', async t => {
  const { Worker } = require('node:worker_threads');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-concurrent-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const workers = Array.from(
    { length: 4 },
    () =>
      new Promise((resolve, reject) => {
        const worker = new Worker(
          `const {parentPort,workerData}=require('node:worker_threads');const {DiskFiles}=require(workerData.module);const store=new DiskFiles(workerData.root);parentPort.postMessage(store.write(Buffer.alloc(4*1024*1024,42)));`,
          {
            eval: true,
            workerData: { root, module: require.resolve('../src/storage.cjs') },
          },
        );
        worker.once('message', resolve);
        worker.once('error', reject);
        worker.once('exit', code => {
          if (code) reject(new Error('Worker failed'));
        });
      }),
  );
  const refs = await Promise.all(workers);
  assert.equal(new Set(refs).size, 1);
  assert.deepEqual(
    new DiskFiles(root).read(refs[0]),
    Buffer.alloc(4 * 1024 * 1024, 42),
  );
  assert.equal(
    fs.readdirSync(root).filter(name => name.endsWith('.tmp')).length,
    0,
  );
});
test('legacy file data moves to immutable blobs without entering metadata saves', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-storage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(path.join(root, 'content'));
  const content = Buffer.alloc(2 * 1024 * 1024, 42);
  const files = store.import({
    'Novels/source/1/1/index.html': content.toString('base64'),
  });
  assert.ok(JSON.stringify(files).length < 160);
  assert.deepEqual(store.read(Object.values(files)[0]), content);
  const file = path.join(root, 'library.json');
  writeState(file, { ...empty(), files });
  writeState(file, { ...empty(), files, settings: { desktopFontSize: 25 } });
  assert.ok(fs.statSync(file).size < 400);
  assert.equal(fs.readdirSync(store.directory).length, 1);
  assert.deepEqual(store.export(files), {
    'Novels/source/1/1/index.html': content.toString('base64'),
  });
});
test('interrupted metadata writes preserve old state and recover corrupted JSON from backup', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-recovery-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'library.json');
  writeState(file, { ...empty(), settings: { desktopFontSize: 21 } });
  writeState(file, { ...empty(), settings: { desktopFontSize: 24 } });
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (to === file) throw new Error('Simulated write failure');
    return rename(from, to);
  };
  try {
    assert.throws(
      () => writeState(file, { ...empty(), settings: { desktopFontSize: 30 } }),
      /Simulated/,
    );
  } finally {
    fs.renameSync = rename;
  }
  assert.equal(
    JSON.parse(fs.readFileSync(file, 'utf8')).settings.desktopFontSize,
    24,
  );
  fs.writeFileSync(file, '{broken');
  const restored = readState(file, empty);
  assert.equal(restored.recovered, true);
  assert.equal(restored.state.settings.desktopFontSize, 24);
  assert.ok(
    fs.readdirSync(root).some(name => name.startsWith('library.json.corrupt-')),
  );
  fs.writeFileSync(file, '{broken');
  fs.writeFileSync(file + '.bak', '{also broken');
  fs.writeFileSync(file + '.tmp', '{unfinished');
  assert.throws(() => readState(file, empty), /preservados/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});
test('blob integrity failures are detected and an online retry can repair them', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-integrity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(root);
  const data = Buffer.from('chapter');
  const reference = store.write(data);
  fs.writeFileSync(path.join(root, reference.slice(6)), 'damaged');
  assert.throws(() => store.read(reference), /corrompido/);
  assert.equal(store.write(data), reference);
  assert.deepEqual(store.read(reference), data);
  const obsolete = store.write(Buffer.from('obsolete'));
  store.prune({}, { keep: reference });
  assert.deepEqual(store.read(reference), data);
  assert.throws(() => store.read(obsolete), /ENOENT/);
});
test('invalid chapter and category records are rejected before replacing a library', () => {
  assert.throws(
    () =>
      validateState({
        ...empty(),
        settings: { desktopFontSize: { bad: true } },
      }),
    /Configuração/,
  );
  assert.throws(
    () =>
      validateState({
        ...empty(),
        novels: [
          { id: 1, name: 'A', path: '/a', pluginId: 's', chapters: [null] },
        ],
      }),
    /Capítulo/,
  );
  assert.throws(
    () => validateState({ ...empty(), categories: [null] }),
    /Categoria/,
  );
});

test('new reader options are validated before saving', () => {
  const valid = validateState({
    ...empty(),
    settings: { desktopPageStep: 85, desktopPagination: 'pages' },
  });
  assert.equal(valid.settings.desktopPageStep, 85);
  assert.equal(validateState({ ...empty(), settings: { desktopPageStep: 0 } }).settings.desktopPageStep, 0);
  assert.equal(valid.settings.desktopPagination, 'pages');
  assert.throws(
    () => validateState({ ...empty(), settings: { desktopPageStep: -5 } }),
    /desktopPageStep/,
  );
  assert.throws(
    () => validateState({ ...empty(), settings: { desktopPageStep: 200 } }),
    /desktopPageStep/,
  );
  assert.throws(
    () =>
      validateState({
        ...empty(),
        settings: { desktopPagination: 'diagonal' },
      }),
    /desktopPagination/,
  );
});

test('writing an identical backup blob reuses it without replacing the file', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-idempotent-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(root);
  const data = Buffer.alloc(1024 * 1024, 77);
  const reference = store.write(data);
  const filename = path.join(root, reference.slice(6));
  const original = fs.statSync(filename);
  assert.equal(store.write(Buffer.from(data)), reference);
  assert.deepEqual(fs.readdirSync(root), [reference.slice(6)]);
  assert.equal(fs.statSync(filename).mtimeMs, original.mtimeMs);
  assert.deepEqual(store.read(reference), data);
});

test('an existing blob with the right name but corrupted bytes is repaired', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-repair-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(root);
  const data = Buffer.from('valid chapter data');
  const reference = store.write(data);
  const filename = path.join(root, reference.slice(6));
  // Same size: a stat-only optimization would accidentally trust this file.
  fs.writeFileSync(filename, Buffer.alloc(data.length, 33));
  assert.equal(store.write(data), reference);
  assert.deepEqual(store.read(reference), data);
});

test('reader chrome delay accepts 1 to 10 seconds and remains optional for older profiles', () => {
  for (const seconds of [1, 2.6, 4.2, 10]) {
    assert.equal(validateState({ ...empty(), settings: { desktopReaderHideDelay: seconds } }).settings.desktopReaderHideDelay, seconds);
  }
  assert.deepEqual(validateState({ ...empty(), settings: {} }).settings, {});
  for (const seconds of [0, -1, 10.2, Infinity, '2.6']) {
    assert.throws(() => validateState({ ...empty(), settings: { desktopReaderHideDelay: seconds } }), /desktopReaderHideDelay/);
  }
});

test('cancelled import removes only its new blobs and retains existing library files', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-import-cancel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new DiskFiles(root);
  const existing = store.write(Buffer.from('existing offline chapter'));
  const incoming = store.write(Buffer.from('new imported chapter'));
  const unrelated = store.write(Buffer.from('unrelated preserved file'));
  store.cleanupImported([
    incoming.slice(6), existing.slice(6), '../../../invalid', incoming.slice(6),
  ], { 'Novels/site/1/2/index.html': existing });
  assert.equal(fs.existsSync(path.join(root, incoming.slice(6))), false);
  assert.equal(store.read(existing).toString(), 'existing offline chapter');
  assert.equal(store.read(unrelated).toString(), 'unrelated preserved file');
  assert.doesNotThrow(() => store.cleanupImported([incoming.slice(6)], {}));
});
