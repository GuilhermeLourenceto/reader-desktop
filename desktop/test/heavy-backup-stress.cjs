// Large, opt-in cross-platform backup/library stress. Synthetic data only.
// No real profile, source networks, installers, or GitHub release writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { Worker } = require('node:worker_threads');
const { emptyState } = require('../dist/backup.cjs');
const backupJob = input => new Promise((resolve, reject) => {
  // The real compiled worker; source worker cannot import bundled TS contracts.
  const worker = new Worker(path.join(__dirname, '../dist/backup-worker.cjs'), {
    workerData: input,
    resourceLimits: { maxOldGenerationSizeMb: 1024 },
  });
  let settled = false;
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    if (error) reject(error);
    else resolve(value);
  };
  worker.once('message', value => {
    if (value.ok) finish(null, value.restored ?? value.result);
    else finish(new Error(value.message));
  });
  worker.once('error', error => finish(error));
  worker.once('exit', code => {
    if (code !== 0) finish(new Error('Backup worker exited with code ' + code));
  });
});
const { DiskFiles, readState, writeState, validateState } = require('../src/storage.cjs');

const profile = process.argv.find(arg => arg.startsWith('--profile='))?.slice(10) || 'large';
if (!['large', 'extreme', 'near-limit'].includes(profile))
  throw new Error('Unknown stress profile: ' + profile);
const config = profile === 'extreme'
  ? { books: 18000, chaptersPerBook: 26, firstBookChapters: 5200, largeFiles: 80, smallFiles: 384 }
  : profile === 'near-limit'
    ? { books: 6000, chaptersPerBook: 15, firstBookChapters: 3000, largeFiles: 118, smallFiles: 256 }
    : { books: 10000, chaptersPerBook: 20, firstBookChapters: 3200, largeFiles: 32, smallFiles: 192 };
const MiB = 1024 * 1024;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-giant-stress-'));
const report = { profile, config, platform: process.platform, node: process.version, timings: {}, checks: [] };
let peakParentRSS = 0;
const memorySampler = setInterval(() => {
  peakParentRSS = Math.max(peakParentRSS, process.memoryUsage().rss);
}, 75);
const start = performance.now();
const digest = value => createHash('sha256').update(value).digest('hex');
async function step(label, task) {
  const now = performance.now();
  const result = await task();
  report.timings[label] = +((performance.now() - now) / 1000).toFixed(2);
  console.log('STRESS', JSON.stringify({ step: label, seconds: report.timings[label] }));
  return result;
}
function assertIntegrity(state, expected, contentStore) {
  assert.equal(state.novels.length, config.books);
  for (let i = 0; i < state.novels.length; i++)
    assert.equal(state.novels[i].id, expected.books[i].id, 'Original book order changed at index ' + i);
  assert.equal(state.novels.reduce((n, novel) => n + novel.chapters.length, 0), expected.chapterCount);
  assert.equal(state.categories.length, 16);
  assert.equal(Object.keys(state.files).length, expected.hashes.size);
  for (const bookIndex of [0, Math.floor(config.books / 2), config.books - 1]) {
    const original = expected.books[bookIndex];
    const restored = state.novels[bookIndex];
    assert.equal(restored.id, original.id);
    assert.equal(restored.name, original.name);
    assert.equal(restored.chapters.length, original.chapters.length);
    for (const chapterIndex of [0, Math.floor(original.chapters.length / 2), original.chapters.length - 1]) {
      for (const key of ['id', 'progress', 'bookmark', 'unread'])
        assert.equal(restored.chapters[chapterIndex][key], original.chapters[chapterIndex][key]);
    }
  }
  for (const [name, expectedHash] of expected.hashes) {
    assert.match(state.files[name], /^@file:[a-f0-9]{64}$/);
    assert.equal(digest(contentStore.read(state.files[name])), expectedHash, name);
  }
  report.checks.push('exact order, counts, sampled progress/bookmarks and categories verified');
  report.checks.push('sha256 checked for every imported binary blob');
}
(async () => {
  const state = emptyState();
  let chapterId = 0;
  state.novels = Array.from({ length: config.books }, (_, i) => ({
    id: i + 1,
    pluginId: 'stress',
    name: 'Giant synthetic novel ' + (i + 1),
    path: '/stress/' + (i + 1),
    inLibrary: true,
    chapters: Array.from({ length: i === 0 ? config.firstBookChapters : config.chaptersPerBook }, (_, j) => ({
      id: ++chapterId,
      novelId: i + 1,
      name: 'Chapter ' + (j + 1),
      path: '/stress/' + (i + 1) + '/' + (j + 1),
      progress: j % 5 === 0 ? 100 : 25,
      unread: j % 5 !== 0,
      bookmark: j % 13 === 0,
      isDownloaded: false,
    })),
  }));
  state.categories = Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    name: 'Category ' + (i + 1),
    novelIds: Array.from({ length: Math.ceil(config.books / 16) }, (_, j) => i + 1 + j * 16).filter(id => id <= config.books),
  }));
  report.books = state.novels.length;
  report.chapters = chapterId;
  const statePath = path.join(root, 'library.json');
  await step('write_validate_massive_library', () => {
    validateState(state);
    writeState(statePath, state);
  });
  const read = await step('read_validate_massive_library', () => readState(statePath, emptyState));
  assert.equal(read.state.novels.length, config.books);
  assert.equal(read.state.novels[0].chapters.length, config.firstBookChapters);
  const blobStore = new DiskFiles(path.join(root, 'original-blobs'));
  const hashes = new Map();
  const chunkBytes = 4 * MiB;
  await step('generate_large_unique_binary_content', () => {
    for (let i = 0; i < config.largeFiles; i++) {
      const name = 'Covers/' + (i + 1);
      const data = randomBytes(chunkBytes);
      hashes.set(name, digest(data));
      state.files[name] = blobStore.write(data);
    }
    for (let i = 0; i < config.smallFiles; i++) {
      const novel = state.novels[i + 1];
      const chapter = novel.chapters[0];
      const name = `Novels/stress/${novel.id}/${chapter.id}/index.html`;
      const data = Buffer.from('<p>' + randomBytes(4 * 1024).toString('hex') + '</p>');
      hashes.set(name, digest(data));
      state.files[name] = blobStore.write(data);
      chapter.isDownloaded = true;
    }
  });
  const unpacked = Object.values(state.files).reduce((n, value) => n + blobStore.size(value), 0);
  const stateBytes = Buffer.byteLength(JSON.stringify({ ...state, files: {} }));
  assert.ok(unpacked + stateBytes < 506 * MiB, 'Synthetic fixture exceeds the 512MiB format budget');
  report.uncompressedContentMiB = +(unpacked / MiB).toFixed(2);
  report.libraryJSONMiB = +(stateBytes / MiB).toFixed(2);
  report.fileCount = hashes.size;
  const archive = path.join(root, 'giant-backup.zip');
  const exported = await step('export_worker', () => backupJob({
    action: 'export', state, filename: archive, contentDirectory: blobStore.directory,
  }));
  assert.equal(exported.missingCount, 0);
  const archiveSize = fs.statSync(archive).size;
  report.zipMiB = +(archiveSize / MiB).toFixed(2);
  assert.ok(archiveSize > config.largeFiles * chunkBytes * 0.95, 'Uncompressed/random payload was lost');
  const expected = { chapterCount: chapterId, books: state.novels, hashes };
  for (let cycle = 1; cycle <= 2; cycle++) {
    const restoredStore = new DiskFiles(path.join(root, 'import-' + cycle));
    const restored = await step('import_worker_cycle_' + cycle, () => backupJob({
      action: 'import', filename: archive, contentDirectory: restoredStore.directory,
    }));
    assert.ok(restored.sections.library);
    await step('verify_import_integrity_cycle_' + cycle, () => {
      assertIntegrity(restored.state, expected, restoredStore);
      for (let i = 0; i < config.smallFiles; i++) {
        const chapter = restored.state.novels[i + 1].chapters[0];
        assert.equal(chapter.isDownloaded, true);
      }
    });
    const roundTrip = path.join(root, 'roundtrip-' + cycle + '.json');
    await step('persist_and_reload_cycle_' + cycle, () => {
      writeState(roundTrip, restored.state);
      writeState(roundTrip, restored.state); // preserve a valid .bak for recovery
      assert.equal(readState(roundTrip, emptyState).state.novels.length, config.books);
    });
    // Mutate only synthetic files, never the real application userData.
    if (cycle === 2) {
      fs.writeFileSync(roundTrip, '{malformed JSON after an interrupted write');
      const recovered = await step('recover_broken_metadata', () => readState(roundTrip, emptyState));
      assert.equal(recovered.recovered, true);
      assert.equal(recovered.state.novels.length, config.books);
      report.checks.push('huge metadata recovered from .bak after deliberate corruption');
    }
    fs.rmSync(restoredStore.directory, { recursive: true, force: true });
  }
  const tooLarge = path.join(root, 'over-limit.zip');
  fs.closeSync(fs.openSync(tooLarge, 'w'));
  fs.truncateSync(tooLarge, 513 * MiB); // sparse file, no 513MiB allocation
  await step('reject_oversized_archive_without_mutation', async () => {
    const before = digest(fs.readFileSync(statePath));
    await assert.rejects(backupJob({
      action: 'import', filename: tooLarge, contentDirectory: blobStore.directory,
    }), /512 MB/);
    assert.equal(digest(fs.readFileSync(statePath)), before);
  });
  report.checks.push('513MiB import rejected without changing the library');
  report.pass = true;
  report.peakParentRSSMiB = +(Math.max(peakParentRSS, process.memoryUsage().rss) / MiB).toFixed(1);
  report.elapsedSeconds = +((performance.now() - start) / 1000).toFixed(1);
  console.log('STRESS RESULT', JSON.stringify(report));
})().catch(error => {
  report.pass = false;
  console.error('STRESS FAILURE', error);
  process.exitCode = 1;
}).finally(() => {
  clearInterval(memorySampler);
  fs.rmSync(root, { recursive: true, force: true });
});
