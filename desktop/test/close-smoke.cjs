const { app, dialog } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-close-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');
const saved = emptyState();
saved.settings.theme = 'dark';
saved.settings.desktopInterfaceLanguage = 'pt-BR';
fs.writeFileSync(path.join(profile, 'library.json'), JSON.stringify(saved));
let prompts = 0;
dialog.showMessageBox = async (_window, options) => {
  assert.ok(options.message.includes('fechamento'));
  prompts++;
  return { response: prompts === 1 ? 0 : 1 };
};
const timeout = setTimeout(() => app.exit(1), 25000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript(
        'window.desktop.load({metadataOnly:true})',
      );
      const send = win.webContents.send.bind(win.webContents);
      let requests = 0;
      win.webContents.send = (channel, ...args) => {
        if (channel === 'before-close') {
          requests++;
          return;
        }
        return send(channel, ...args);
      };
      win.once('closed', () => {
        try {
          assert.equal(prompts, 2);
          assert.equal(requests, 2);
          assert.deepEqual(
            JSON.parse(
              fs.readFileSync(path.join(profile, 'library.json'), 'utf8'),
            ).settings,
            { ...saved.settings, desktopOnboardingCompleted: true },
          );
          console.log(
            'PASS: missing renderer close acknowledgement offers wait/retry and explicit exit; saved library remains intact.',
          );
          clearTimeout(timeout);
          app.exit(0);
        } catch (error) {
          console.error(error);
          app.exit(1);
        }
      });
      win.close();
      win.close();
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});
require('../dist/main.cjs');
