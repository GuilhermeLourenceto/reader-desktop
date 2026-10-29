const { app, dialog } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
app.setPath(
  'userData',
  fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-recovery-ui-')),
);
app.commandLine.appendSwitch('disable-gpu');
const messages = [];
dialog.showErrorBox = (title, message) => messages.push({ title, message });
const timeout = setTimeout(() => app.exit(1), 15000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', () => {
    let reloads = 0;
    win.reload = () => {
      reloads++;
    };
    win.once('closed', () => {
      try {
        assert.equal(reloads, 2);
        assert.equal(messages.length, 3);
        assert.ok(messages.at(-1).title.includes('Não foi possível recuperar'));
        console.log(
          'PASS: repeated renderer failures stop after two recovery attempts instead of reloading forever.',
        );
        clearTimeout(timeout);
        app.exit(0);
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
    for (let index = 0; index < 3; index++)
      win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  });
});
require('../dist/main.cjs');
