const { Worker } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs');

let activeJobs = 0;
function isBackupJobActive() { return activeJobs > 0; }

const exportDestinations = new Set();

function destinationKey(filename) {
  const absolute = path.resolve(filename);
  const canonical = path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute));
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical;
}

function backupJob(input) {
  return new Promise((resolve, reject) => {
    const destination = input.action === 'export' ? destinationKey(input.filename) : null;
    if (destination && exportDestinations.has(destination)) {
      reject(new Error('Exportação anterior ainda está em andamento'));
      return;
    }
    const worker = new Worker(path.join(__dirname, 'backup-worker.cjs'), {
      workerData: input,
      resourceLimits: { maxOldGenerationSizeMb: 1024 },
    });
    activeJobs++;
    if (destination) exportDestinations.add(destination);
    worker.once('exit', () => {
      activeJobs--;
      if (destination) exportDestinations.delete(destination);
    });
    let settled = false, timer;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        void worker.terminate();
        reject(error);
      } else resolve(value);
    };
    // No duration cap on libraries containing many gigabytes of offline chapters.
    // A stalled worker still terminates after five minutes without progress.
    const watchdog = () => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new Error(
        'Backup sem progresso por cinco minutos. Os dados atuais foram mantidos.',
      )), 300000);
    };
    watchdog();
    worker.on('message', value => {
      if (value.progress === true) {
        if (!settled) watchdog();
        return;
      }
      value.ok
        ? finish(null, value.restored ?? value.result)
        : finish(new Error(value.message));
    });
    worker.on('error', error => finish(error));
    worker.on('exit', code => {
      if (!settled) finish(new Error(
        'O processamento do backup foi interrompido (' + code + ').',
      ));
    });
  });
}
module.exports = { backupJob, isBackupJobActive };
