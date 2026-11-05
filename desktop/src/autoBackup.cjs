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
  if (!status.managed || typeof status.managed !== 'object' || Array.isArray(status.managed))
    status.managed = {};
  if (!Array.isArray(status.managed[folder])) {
    // Older releases kept the last-success metadata, not a file registry.
    // Migrate only files using the reserved automatic name in that exact
    // previously recorded directory. Ordinary manual ZIPs never match.
    status.managed[folder] = status.folder === folder && Number.isFinite(status.at)
      ? fs.readdirSync(folder).filter(name => FILENAME.test(name))
      : [];
  }
  const unique = [...new Set(status.managed[folder].filter(name => typeof name === 'string' && FILENAME.test(name)))];
  status.managed[folder] = unique.filter(name => {
    try { return fs.statSync(path.join(folder, name)).isFile(); }
    catch { return false; }
  }).sort();
  return status.managed[folder];
}
function prune(status, folder) {
  const names = managedFiles(status, folder);
  const excess = Math.max(0, names.length - KEEP);
  if (!excess) return false;
  let changed = false;
  for (const name of names.slice(0, excess)) {
    try {
      fs.unlinkSync(path.join(folder, name));
      status.managed[folder] = status.managed[folder].filter(value => value !== name);
      changed = true;
    } catch (error) {
      // Never remove an unrelated ZIP, and retry cleanup on later checks.
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
    if (!fs.existsSync(path.join(folder, name))) return name;
  }
  throw new Error('No unique automatic backup filename available');
}

/**
 * Uses the existing ZIP worker. Automatic retention deletes only archives
 * registered as app-created. User-created manual backups are never managed.
 */
function createAutoBackupManager({ dataDirectory, getState, contentDirectory, exportBackup, now = () => Date.now() }) {
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
    if (frequency === 'launch') launchAttempted = true;

    const status = readStatus(statusPath);
    busy = true;
    let filename;
    try {
      // Retry unfinished retention even when no new backup is due.
      const previouslyManaged = JSON.stringify(status.managed || {});
      const managed = managedFiles(status, folder);
      const removed = prune(status, folder);
      if (removed || JSON.stringify(status.managed) !== previouslyManaged)
        writeStatus(statusPath, status);

      const instant = now();
      const fingerprint = createHash('sha256').update(JSON.stringify(state)).digest('hex');
      if (fingerprint === status.fingerprint && folder === status.folder) return false;
      if (frequency !== 'launch' && Number.isFinite(status.at) &&
          instant - status.at < HOURS[frequency] * 60 * 60 * 1000 &&
          folder === status.folder) return false;

      const name = availableName(folder, instant);
      filename = path.join(folder, name);
      const includeDownloads = options.desktopBackupIncludeDownloads !== false;
      const backupState = includeDownloads ? state : {
        ...state,
        files: Object.fromEntries(Object.entries(state.files || {})
          .filter(([key]) => !key.startsWith('Novels/'))),
      };

      await exportBackup({
        action: 'export', state: backupState, contentDirectory, filename,
      });

      // Record ownership before deleting anything. If recording fails, remove
      // only this new archive and preserve the previous valid five.
      const next = {
        ...status, at: instant, folder, fingerprint,
        managed: { ...status.managed, [folder]: [...managed, name].sort() },
      };
      try { writeStatus(statusPath, next); }
      catch (error) {
        try { fs.unlinkSync(filename); } catch { /* Keep existing backups safe. */ }
        throw error;
      }
      // Successful export only: remove the oldest app-created automatic ZIP.
      if (prune(next, folder)) writeStatus(statusPath, next);
      return true;
    } catch (error) {
      // The ZIP worker writes to a temporary path before committing a ZIP.
      // A failed export must never consume an older valid backup.
      if (filename) {
        try { fs.unlinkSync(filename + '.tmp'); } catch { /* No partial ZIP. */ }
      }
      console.warn('Automatic backup was not completed:', error.message);
      return false;
    } finally {
      busy = false;
    }
  }
  return { check };
}
module.exports = { createAutoBackupManager, HOURS };
