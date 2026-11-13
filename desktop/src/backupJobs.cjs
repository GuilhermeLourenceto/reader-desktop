const { Worker } = require('node:worker_threads');
const path = require('node:path');

function backupJob(input) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'backup-worker.cjs'), {
      workerData: input,
      resourceLimits: { maxOldGenerationSizeMb: 1024 },
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
module.exports = { backupJob };
