const { app } = require('electron');
const { Worker } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = fs.mkdtempSync(
  path.join(os.tmpdir(), 'lnreader-packaged-backup-'),
);
const { emptyState } = require('../dist/backup.cjs');
// Electron's packaged ASAR worker must work on both Windows and Linux.
const packageDirectory =
  process.platform === 'win32'
    ? 'win-unpacked'
    : process.platform === 'linux'
      ? 'linux-unpacked'
      : null;
if (!packageDirectory) throw new Error('Packaged backup smoke supports Windows/Linux only');
const timeout = setTimeout(() => app.exit(1), 15000);
app.whenReady().then(() => {
  const worker = new Worker(
    path.join(
      __dirname,
      '../release',
      packageDirectory,
      'resources/app.asar/dist/backup-worker.cjs',
    ),
    {
      workerData: {
        action: 'export',
        state: emptyState(),
        filename: path.join(root, 'test.zip'),
        contentDirectory: path.join(root, 'content'),
      },
    },
  );
  worker.on('message', result => {
    clearTimeout(timeout);
    if (!result.ok) console.error(result.message);
    else
      console.log(
        'PASS: backup worker from packaged ASAR and packaged dependencies.',
      );
    app.exit(result.ok ? 0 : 1);
  });
  worker.on('error', error => {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
  });
});
