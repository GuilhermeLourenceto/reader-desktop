'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MARKER = 'reset-pending.json';
const RESET_LOCALES = new Set(['pt-BR', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ja', 'ko', 'zh-CN']);
// Electron clearData targets browser-managed storage, not arbitrary folders.
// Unknown root directories (including a user-selected backup directory) are
// left alone. Within these storage trees, fail closed on ZIPs and links.
const BROWSER_DIRS = new Set([
  'cache', 'code cache', 'gpucache', 'dawngraphitecache', 'dawnwebgpucache',
  'shadercache', 'grshadercache', 'graphitedawncache', 'dawncache', 'media cache',
  'local storage', 'session storage', 'indexeddb', 'service worker',
  'file system', 'webstorage', 'databases', 'network', 'storage',
  'cachestorage', 'blob_storage', 'shared dictionary', 'sharedstorage',
  'shared_proto_db', 'web applications', 'extension state',
  'local extension settings', 'sync extension settings',
  'extension rules', 'extensions', 'reporting and nel',
]);
const ROOT_DATA = /^(?:library|before-restore)\.json(?:\.bak|\.tmp|\.corrupt-\d+)?$|^automatic-backup-status\.json(?:\.tmp)?$/;
const BLOB = /^[a-f0-9]{64}(?:\.[a-f0-9-]{36}\.tmp|\.tmp)?$/;
const LOG = /^reader(?:\.[12])?\.jsonl$/;
const PARTITION = /^lnreader-source-[a-z0-9_.-]+$/i;
const SINGLETON = /^Singleton(?:Lock|Socket|Cookie)$/;

function freshSettings() {
  return {
    desktopOnboardingCompleted: false,
    desktopInterfaceLanguage: 'en',
    desktopBackupFrequency: '24',
    desktopBackupIncludeDownloads: true,
  };
}

function pendingReset(profile) {
  try { fs.lstatSync(path.join(profile, MARKER)); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function syncDirectory(directory) {
  if (process.platform === 'win32') return;
  const fd = fs.openSync(directory, 'r');
  try { fs.fsyncSync(fd); }
  catch (error) { if (!['EINVAL', 'ENOTSUP'].includes(error.code)) throw error; }
  finally { fs.closeSync(fd); }
}

function readResetMarker(profile) {
  const filename = path.join(profile, MARKER);
  const info = fs.lstatSync(filename);
  if (!info.isFile() || info.nlink !== 1 || info.size > 128) unsafe(filename);
  let marker;
  try { marker = JSON.parse(fs.readFileSync(filename, 'utf8')); }
  catch { unsafe(filename); }
  if (!marker || marker.version !== 1 ||
      Object.keys(marker).some(key => !['version', 'locale'].includes(key)) ||
      (Object.hasOwn(marker, 'locale') && !RESET_LOCALES.has(marker.locale))) unsafe(filename);
  return marker;
}

function resetLocale(profile) {
  try { return readResetMarker(profile).locale || 'en'; }
  catch { return 'en'; }
}

function markReset(profile, locale = 'en') {
  if (pendingReset(profile)) throw new Error('Reset already pending');
  const target = path.join(profile, MARKER);
  const temporary = target + '.' + randomUUID() + '.tmp';
  let published = false;
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
      const language = RESET_LOCALES.has(locale) ? locale : 'en';
      fs.writeFileSync(fd, JSON.stringify({ version: 1, locale: language }) + '\n');
      fs.fsyncSync(fd);
    }
    finally { fs.closeSync(fd); }
    fs.renameSync(temporary, target);
    published = true;
    syncDirectory(profile);
  } finally {
    if (!published) fs.rmSync(temporary, { force: true });
  }
}

async function getInfo(filename) {
  try { return await fsp.lstat(filename); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function unsafe(filename) {
  throw new Error('RESET_UNSAFE: ' + filename);
}

async function safeDirectory(filename, device) {
  const info = await getInfo(filename);
  if (!info) return null;
  if (!info.isDirectory() || (device !== undefined && info.dev !== device)) unsafe(filename);
  return info;
}

async function assertFile(filename, info, device, inspectHeader = true) {
  if (!info.isFile() || info.dev !== device || info.nlink !== 1) unsafe(filename);
  if (/\.zip$/i.test(filename)) throw new Error('RESET_ARCHIVE: ' + filename);
  // Empty Chromium lock files cannot contain a ZIP signature and may be
  // opened exclusively by the browser process on Windows.
  if (!inspectHeader || info.size < 4) return;
  // A user can save an archive under a name without the .zip extension.
  // Also refuse ZIP signatures at the start of a file slated for cleanup.
  const handle = await fsp.open(filename, 'r');
  try {
    const header = Buffer.alloc(4);
    const { bytesRead } = await handle.read(header, 0, 4, 0);
    if ((bytesRead === 4 && header[0] === 0x50 && header[1] === 0x4b &&
        ((header[2] === 3 && header[3] === 4) || (header[2] === 5 && header[3] === 6) ||
         (header[2] === 7 && header[3] === 8)))) {
      throw new Error('RESET_ARCHIVE: ' + filename);
    }
  } finally { await handle.close(); }
}

// Never recursively remove the profile, even if an unexpected file is present.
// Only application-owned filenames are eligible for unlinking.
async function inspectReset(profile, browserRoot, { browserHeaders = true } = {}) {
  const roots = [...new Set([profile, browserRoot].map(value => path.resolve(value)))];
  const profileRoot = roots[0];
  const files = [];
  const sessionPaths = [];
  for (const root of roots) {
    const rootInfo = await safeDirectory(root);
    if (!rootInfo) {
      if (root === profileRoot) unsafe(root);
      continue;
    }
    if (path.relative(root, await fsp.realpath(root)) !== '') unsafe(root);
    const isProfile = root === profileRoot;
    const device = rootInfo.dev;
    // The browser's data removal API may remove whole internal subdirectories.
    // Conservatively refuse ZIPs or links in those trees, rather than guess
    // whether a file placed there by the user is safe to remove.
    async function scanBrowser(directory) {
      for (const name of await fsp.readdir(directory)) {
        const filename = path.join(directory, name);
        const info = await getInfo(filename);
        if (!info) continue;
        if (info.isDirectory()) {
          if (info.dev !== device) unsafe(filename);
          await scanBrowser(filename);
        } else await assertFile(filename, info, device, browserHeaders);
      }
    }
    async function managedFiles(directory, pattern) {
      if (!await safeDirectory(directory, device)) return;
      for (const name of await fsp.readdir(directory)) {
        if (!pattern.test(name)) continue;
        const filename = path.join(directory, name);
        const info = await getInfo(filename);
        if (!info) continue;
        await assertFile(filename, info, device);
        files.push(filename);
      }
    }
    for (const name of await fsp.readdir(root)) {
      const filename = path.join(root, name);
      const info = await getInfo(filename);
      if (!info) continue;
      if (isProfile && (name === 'content' || name === 'diagnostics')) {
        await managedFiles(filename, name === 'content' ? BLOB : LOG);
      } else if (isProfile && ROOT_DATA.test(name)) {
        await assertFile(filename, info, device);
        files.push(filename);
      } else if (name === MARKER || SINGLETON.test(name)) {
        // Chromium singleton locks are not part of the data being removed.
        continue;
      } else if (name.toLowerCase() === 'partitions') {
        if (!await safeDirectory(filename, device)) continue;
        for (const partition of await fsp.readdir(filename)) {
          if (!PARTITION.test(partition)) continue;
          const target = path.join(filename, partition);
          if (await safeDirectory(target, device)) {
            await scanBrowser(target);
            sessionPaths.push(target);
          }
        }
      } else if (BROWSER_DIRS.has(name.toLowerCase())) {
        if (!await safeDirectory(filename, device)) continue;
        await scanBrowser(filename);
      } else if (/^(?:Cookies|History|Web Data|Login Data|Network Persistent State|Trust Tokens|QuotaManager|TransportSecurity|Preferences|Local State)(?:-journal|-wal|-shm)?$/i.test(name)) {
        await assertFile(filename, info, device, browserHeaders);
      }
      // Root-level exports and other ordinary files are not deleted by us.
    }
    if (root !== path.resolve(browserRoot)) sessionPaths.push(root);
  }
  return { files: [...new Set(files)], sessionPaths: [...new Set(sessionPaths)] };
}

async function completeReset({ profile, browserRoot, clearSessions, writeInitial }) {
  const marker = path.join(profile, MARKER);
  readResetMarker(profile);
  const plan = await inspectReset(profile, browserRoot);
  // No renderer, backup manager or library recovery is running at this point.
  // If the browser refuses cleanup, leave the marker and library untouched.
  await clearSessions(plan.sessionPaths);
  const changedDirectories = new Set();
  for (const filename of plan.files) {
    const directory = path.dirname(filename);
    const dirInfo = await safeDirectory(directory);
    if (!dirInfo || path.relative(directory, await fsp.realpath(directory)) !== '') unsafe(directory);
    const info = await getInfo(filename);
    if (!info) continue;
    await assertFile(filename, info, dirInfo.dev);
    await fsp.unlink(filename);
    changedDirectories.add(directory);
  }
  for (const directory of changedDirectories) syncDirectory(directory);
  // The callback uses the existing atomic state writer, not the merge path.
  await writeInitial();
  syncDirectory(profile);
  await fsp.unlink(marker);
  syncDirectory(profile);
}

module.exports = { freshSettings, pendingReset, markReset, resetLocale, inspectReset, completeReset };
