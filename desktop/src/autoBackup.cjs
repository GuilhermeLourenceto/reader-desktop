const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const HOURS = Object.freeze({ '6': 6, '12': 12, '24': 24, '48': 48, '168': 168 });
const FILENAME = /^ReaderDesktop-auto-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.zip$/;

/**
 * Uses the existing worker-based ZIP exporter. Never runs while the app is closed.
 * Existing files and manually created backups are never removed by retention.
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

    let previous = {};
    try { previous = JSON.parse(fs.readFileSync(statusPath, 'utf8')); } catch { /* First backup. */ }
    const fingerprint = createHash('sha256').update(JSON.stringify(state)).digest('hex');
    if (fingerprint === previous.fingerprint && folder === previous.folder) return false;
    const instant = now();
    if (frequency !== 'launch' && Number.isFinite(previous.at) &&
        instant - previous.at < HOURS[frequency] * 60 * 60 * 1000 &&
        folder === previous.folder) return false;
    busy = true;
    const timestamp = new Date(instant).toISOString().replace(/[:.]/g, '-');
    const filename = path.join(folder, `ReaderDesktop-auto-${timestamp}.zip`);
    try {
      const includeDownloads = options.desktopBackupIncludeDownloads !== false;
      const backupState = includeDownloads ? state : {
        ...state,
        files: Object.fromEntries(Object.entries(state.files || {}).filter(([name]) => !name.startsWith('Novels/'))),
      };
      await exportBackup({
        action: 'export', state: backupState, contentDirectory, filename,
      });
      const temp = statusPath + '.tmp';
      fs.writeFileSync(temp, JSON.stringify({ at: instant, folder, fingerprint }));
      fs.renameSync(temp, statusPath);
      // Only files with our exact automatic-backup naming scheme are pruned.
      const files = fs.readdirSync(folder).filter(name => FILENAME.test(name)).sort();
      for (const name of files.slice(0, Math.max(0, files.length - 5))) {
        try { fs.unlinkSync(path.join(folder, name)); } catch { /* Retention can be retried. */ }
      }
      return true;
    } catch (error) {
      // Never overwrite a valid backup. The worker writes to a temporary path first.
      // Report failures without blocking the library or reader.
      console.warn('Automatic backup was not completed:', error.message);
      return false;
    } finally { busy = false; }
  }
  return { check };
}
module.exports = { createAutoBackupManager, HOURS };