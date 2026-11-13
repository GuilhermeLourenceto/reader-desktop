const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const HOURS = Object.freeze({ '6': 6, '12': 12, '24': 24, '48': 48, '168': 168 });
const FILENAME = /^ReaderDesktop-auto-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.zip$/;
const KEEP = 5;

function readStatus(filename) {
  try {
    const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
function writeStatus(filename, status) {
  const temporary = filename + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(status));
    fs.renameSync(temporary, filename);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function managedFiles(status, folder) {
  // Only records written by the versioned ownership register are trusted.
  // Older status files identified backups by filename, which could mistake
  // a manually named ZIP for an automatic one. Never guess ownership.
  if (status.ownershipRegistryVersion !== 2) {
    status.managed = {};
    status.ownershipRegistryVersion = 2;
  }
  if (!status.managed || typeof status.managed !== 'object' || Array.isArray(status.managed))
    status.managed = {};
  if (!Array.isArray(status.managed[folder])) status.managed[folder] = [];
  const unique = [];
  const seen = new Set();
  for (const record of status.managed[folder]) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    const { name, size, mtimeMs } = record;
    if (typeof name !== 'string' || !FILENAME.test(name) || seen.has(name) ||
        !Number.isFinite(size) || size <= 0 || !Number.isFinite(mtimeMs)) continue;
    try {
      const stats = fs.lstatSync(path.join(folder, name));
      // If an old automatic file was overwritten by the user, it is no
      // longer the same managed file and must never be deleted by rotation.
      if (!stats.isFile() || stats.size !== size || stats.mtimeMs !== mtimeMs)
        continue;
      seen.add(name);
      unique.push(record);
    } catch { /* Deleted or moved outside the application. */ }
  }
  // Preserve the order in which backups were successfully made; changing
  // the system clock must not cause the newest backup to be deleted.
  status.managed[folder] = unique;
  return unique;
}
function prune(status, folder) {
  const entries = managedFiles(status, folder);
  const excess = Math.max(0, entries.length - KEEP);
  if (!excess) return false;
  let changed = false;
  for (const record of entries.slice(0, excess)) {
    try {
      fs.unlinkSync(path.join(folder, record.name));
      status.managed[folder] = status.managed[folder].filter(value => value.name !== record.name);
      changed = true;
    } catch (error) {
      console.warn('Could not remove old automatic backup:', error.message);
    }
  }
  return changed;
}
function availableName(folder, timestamp) {
  // Never overwrite even an unrelated manually created file that happens to
  // use the reserved automatic naming pattern.
  for (let offset = 0; offset < 10000; offset++) {
    const stamp = new Date(timestamp + offset).toISOString().replace(/[:.]/g, '-');
    const name = 'ReaderDesktop-auto-' + stamp + '.zip';
    if (!fs.existsSync(path.join(folder, name)) && !fs.existsSync(path.join(folder, name + '.tmp'))) return name;
  }
  throw new Error('No unique automatic backup filename available');
}

/**
 * Uses the existing ZIP worker. Automatic retention deletes only archives
 * registered as app-created. User-created manual backups are never managed.
 */
function createAutoBackupManager({ dataDirectory, getState, contentDirectory, exportBackup, now = () => Date.now(), report = () => {} }) {
  const statusPath = path.join(dataDirectory, 'automatic-backup-status.json');
  let busy = false;
  let launchAttempted = false;

  async function check({ launch = false } = {}) {
    if (busy) return false;
    const state = getState();
    if (!state || state.settings?.desktopOnboardingCompleted !== true) return false;
    const options = state.settings || {};
    const frequency = String(options.desktopBackupFrequency ?? 'off');
    if (frequency !== 'launch' && frequency !== 'off' && !Object.hasOwn(HOURS, frequency)) return false;
    if (frequency === 'off') return false;
    const folder = options.desktopBackupDirectory;
    if (typeof folder !== 'string' || !path.isAbsolute(folder)) return false;
    let stats;
    try { stats = fs.statSync(folder); } catch { return false; }
    if (!stats.isDirectory()) return false;
    if (frequency === 'launch' && (!launch || launchAttempted)) return false;

    const status = readStatus(statusPath);
    busy = true;
    let filename;
    try {
      // Retry unfinished retention even when no new backup is due.
      const previouslyManaged = JSON.stringify(status.managed || {});
      const previousRegistryVersion = status.ownershipRegistryVersion;
      managedFiles(status, folder);
      const removed = prune(status, folder);
      if (removed || JSON.stringify(status.managed) !== previouslyManaged || previousRegistryVersion !== 2)
        writeStatus(statusPath, status);

      const instant = now();
      const fingerprint = createHash('sha256').update(JSON.stringify(state)).digest('hex');
      if (fingerprint === status.fingerprint && folder === status.folder) return false;
      if (frequency !== 'launch' && Number.isFinite(status.at) &&
          instant >= status.at && instant - status.at < HOURS[frequency] * 60 * 60 * 1000 &&
          folder === status.folder) return false;

      const name = availableName(folder, instant);
      filename = path.join(folder, name);
      const includeDownloads = options.desktopBackupIncludeDownloads !== false;
      const result = await exportBackup({
        action: 'export', state, includeDownloads, contentDirectory, filename,
      });
      // A partial export (for example, missing offline chapters) must not
      // replace or cause deletion of an older verified good backup.
      const archived = fs.statSync(filename);
      if (!archived.isFile() || archived.size === 0 ||
          Number(result?.missingCount || 0) > 0) {
        try { fs.unlinkSync(filename); } catch { /* Never rotate this file. */ }
        throw new Error('Automatic backup export was incomplete.');
      }

      // Record ownership before deleting anything. If recording fails, remove
      // only this new archive and preserve the previous valid five.
      const next = {
        ...status, at: instant, folder, fingerprint,
        managed: {
          ...status.managed,
          [folder]: [...managedFiles(status, folder), {
            name, size: archived.size, mtimeMs: archived.mtimeMs,
          }],
        },
      };
      try { writeStatus(statusPath, next); }
      catch (error) {
        try { fs.unlinkSync(filename); } catch { /* Keep existing backups safe. */ }
        throw error;
      }
      // Successful export only: remove the oldest app-created automatic ZIP.
      if (prune(next, folder)) writeStatus(statusPath, next);
      if (frequency === 'launch') launchAttempted = true;
      try { report({ level: 'info', code: 'BKP-AUTO-OK', operation: 'backup',
        message: 'Backup automático concluído.' }); } catch {}
      return true;
    } catch (error) {
      // The ZIP worker writes to a temporary path before committing a ZIP.
      // A failed export must never consume an older valid backup.
      if (filename) {
        try { fs.unlinkSync(filename + '.tmp'); } catch { /* No partial ZIP. */ }
      }
      console.warn('Automatic backup was not completed:', error.message);
      try { report({ level: 'warning', code: 'BKP-AUTO-FAILED', operation: 'backup',
        message: error.message }); } catch {}
      return false;
    } finally {
      busy = false;
    }
  }
  return { check };
}
module.exports = { createAutoBackupManager, HOURS };
