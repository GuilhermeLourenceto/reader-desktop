// Exercise Google Drive settings in Electron without accounts or live APIs.
const { app } = require('electron');
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
      console.log('PASS: Drive backup page, translation, navigation and zero user API-key inputs.');
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
