// Exercise Google Drive settings in Electron without accounts or live APIs.
const { app, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-drive-ui-'));
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const deadline = setTimeout(() => app.exit(1), 30000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const js = source => win.webContents.executeJavaScript(source, true);
    const wait = async predicate => {
      for (let i = 0; i < 300; i++) {
        if (await js(predicate)) return;
        await new Promise(r => setTimeout(r, 40));
      }
      throw Error('Timed out: ' + predicate);
    };
    const click = text => js('(()=>{const button=Array.from(document.querySelectorAll("button")).find(b=>(b.getAttribute("aria-label")||b.textContent.trim())===' + JSON.stringify(text) + ');if(!button)throw Error("Missing button");button.click()})()');
    try {
      await wait("document.documentElement.lang==='en' && document.querySelector('nav')");
      await click('More');
      await click('Settings');
      await click('Backups');
      await click('Google Drive');
      await wait("document.querySelector('.cloud-settings') && document.querySelector('.cloud-settings button')");
      assert.equal(await js("document.querySelector('.settings-screen').dataset.settingsPage"), 'drive');
      assert.equal(await js("document.querySelectorAll('.cloud-settings input[type=text]').length"), 0);
      const status = await js('window.desktop.driveStatus()');
      assert.equal(typeof status.configured, 'boolean');
      assert.equal(typeof status.secure, 'boolean');
      if (!status.configured) {
        assert.ok(await js("document.querySelector('.cloud-settings').textContent.includes('Google Drive is not enabled')"));
        assert.equal(await js("Array.from(document.querySelectorAll('.cloud-settings button')).some(b=>b.textContent.includes('Connect Google account')&&!b.disabled)"), false);
      }
      await click('Back in settings');
      assert.equal(await js("document.querySelector('.settings-screen').dataset.settingsPage"), 'backup');

      // Simulate connected Drive APIs with deliberately UNSORTED backups;
      // no user credentials and no actual remote requests are involved.
      const newest = 'backupNewest12345';
      const older = 'backupOlder12345';
      const requested = [];
      ipcMain.removeHandler('drive-status');
      ipcMain.handle('drive-status', async () => ({
        configured: true, connected: true, secure: true,
        automatic: false, lastBackupAt: null, busy: false,
      }));
      ipcMain.removeHandler('drive-list');
      ipcMain.handle('drive-list', async () => [
        { id: older, name: 'LNReader-older.zip', size: 1024,
          createdTime: '2025-01-03T10:00:00Z' },
        { id: newest, name: 'LNReader-newest.zip', size: 2048,
          createdTime: '2026-11-03T11:00:00Z' },
      ]);
      ipcMain.removeHandler('drive-restore');
      ipcMain.handle('drive-restore', async (_, id) => {
        requested.push(id);
        return null; // Cancelled confirmation; must not modify any library.
      });

      await click('Google Drive');
      await wait("document.querySelector('.cloud-latest') && document.querySelector('.cloud-latest').textContent.includes('LNReader-newest.zip')");
      assert.equal(await js("document.querySelectorAll('.cloud-choice input').length"), 0, 'Choices start collapsed');
      assert.equal(await js("document.querySelector('.cloud-latest button').disabled"), false);
      await click('Choose another backup');
      await wait("document.querySelectorAll('.cloud-choice input[type=radio]').length===2");
      assert.equal(await js("document.querySelector('.cloud-restore-selected').disabled"), true);
      assert.deepEqual(await js("Array.from(document.querySelectorAll('.cloud-choice input')).map(el=>el.value)"), [newest, older]);

      await js("document.querySelectorAll('.cloud-choice input')[1].click()");
      await wait("!document.querySelector('.cloud-restore-selected').disabled");
      await click('Restore selected backup');
      for (let attempt = 0; requested.length < 1 && attempt < 200; attempt++)
        await new Promise(resolve => setTimeout(resolve, 30));
      assert.deepEqual(requested, [older], 'Manual choice must restore exactly the selected older ID');
      await wait("!document.querySelector('.cloud-latest button').disabled");
      await click('Restore latest backup');
      for (let attempt = 0; requested.length < 2 && attempt < 200; attempt++)
        await new Promise(resolve => setTimeout(resolve, 30));
      assert.deepEqual(requested, [older, newest], 'Latest shortcut must choose newest ID by date');
      assert.equal(fs.existsSync(path.join(directory, 'before-restore.json')), false,
        'Cancelled restores must not overwrite local data');
      console.log('PASS: Drive UI sorts latest, chooses older backup, uses correct IDs and no unintended restore.');
      clearTimeout(deadline);
      win.destroy();
      app.exit(0);
    } catch (error) {
      console.error(error);
      clearTimeout(deadline);
      win.destroy();
      app.exit(1);
    }
  });
});
require('../dist/main.cjs');
