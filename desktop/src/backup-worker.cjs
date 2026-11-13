// ZIP64 streaming I/O stays off the Electron renderer.
const { parentPort, workerData } = require('node:worker_threads');
const { exportBackup, importBackup } = require('./zipStreaming.cjs');
let lastPulse = Date.now();
const progress = () => {
  const now = Date.now();
  if (now - lastPulse > 20000) {
    lastPulse = now;
    parentPort.postMessage({ progress: true });
  }
};
(async () => {
  if (workerData.action === 'export') {
    const result = await exportBackup({
      state: workerData.state, filename: workerData.filename,
      contentDirectory: workerData.contentDirectory,
      includeDownloads: workerData.includeDownloads !== false, progress,
    });
    parentPort.postMessage({ ok: true, result });
  } else if (workerData.action === 'import') {
    const restored = await importBackup({
      filename: workerData.filename,
      contentDirectory: workerData.contentDirectory, progress,
    });
    parentPort.postMessage({ ok: true, restored });
  } else {
    throw new Error('Ação de backup inválida');
  }
})().catch(error => parentPort.postMessage({ ok: false, message: error.message }));
