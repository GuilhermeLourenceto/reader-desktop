const { Worker } = require('node:worker_threads');
const path = require('node:path');
function backupJob(input) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'backup-worker.cjs'), {
      workerData: input,
      resourceLimits: { maxOldGenerationSizeMb: 1024 },
    });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        void worker.terminate();
        reject(error);
      } else resolve(value);
    };
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            'O processamento do backup excedeu cinco minutos. Os dados atuais foram mantidos.',
          ),
        ),
      300000,
    );
    worker.on('message', value =>
      value.ok
        ? finish(null, value.restored ?? value.result)
        : finish(new Error(value.message)),
    );
    worker.on('error', error => finish(error));
    worker.on('exit', code => {
      if (!settled)
        finish(
          new Error(`O processamento do backup foi interrompido (${code}).`),
        );
    });
  });
}
module.exports = { backupJob };
