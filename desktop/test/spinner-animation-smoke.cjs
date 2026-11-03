// Check real Chromium animation frames in the packaged desktop renderer.
// Disposable profile only: no real library, source, backup or account is used.
const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-spinner-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');
let mainWindow;
let finished = false;

function finish(code) {
  if (finished) return;
  finished = true;
  clearTimeout(deadline);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(code);
}
const deadline = setTimeout(() => {
  console.error('Spinner animation test timed out');
  finish(1);
}, 30000);

app.on('browser-window-created', (_event, win) => {
  if (mainWindow) return;
  mainWindow = win;
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const js = source => win.webContents.executeJavaScript(source, true);
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function probe(small, reducedMotion) {
      const first = await js(`(() => {
        const element = document.createElement('span');
        element.className = ${JSON.stringify(small ? 'spinner spinner-small' : 'spinner')};
        element.id = 'spinner-animation-test';
        element.style.position = 'fixed';
        element.style.top = '45%';
        element.style.left = '50%';
        document.body.appendChild(element);
        const style = getComputedStyle(element);
        return {
          name: style.animationName,
          count: style.animationIterationCount,
          state: style.animationPlayState,
          duration: style.animationDuration,
          change: style.willChange,
          transform: style.transform,
        };
      })()`);
      assert.equal(first.name, 'loading-spin', 'real spinner CSS must load');
      assert.equal(first.count, 'infinite', 'spinner must not stop after one turn');
      assert.equal(first.state, 'running', 'spinner must not be paused');
      assert.ok(first.change.includes('transform'), 'spinner must be composited');
      if (reducedMotion) {
        assert.equal(first.duration, '1.6s');
      } else {
        assert.equal(first.duration, '0.8s');
      }
      let moved = false;
      for (let i = 0; i < 4; i++) {
        await sleep(150);
        const transform = await js(
          "getComputedStyle(document.getElementById('spinner-animation-test')).transform",
        );
        if (transform !== first.transform) moved = true;
      }
      assert.ok(moved, 'spinner must change rotation across actual frames');
      await js("document.getElementById('spinner-animation-test').remove()");
    }

    let attached = false;
    try {
      win.showInactive(); // A visible renderer is needed to test real frames.
      await probe(false, false);
      await probe(true, false);
      win.webContents.debugger.attach('1.3');
      attached = true;
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
      await probe(false, true);
      console.log('PASS: regular/small and reduced-motion loading spinners rotate on real Electron frames');
      finish(0);
    } catch (error) {
      console.error('SPINNER ANIMATION FAILURE', error);
      finish(1);
    } finally {
      if (attached && !win.webContents.isDestroyed()) {
        try { win.webContents.debugger.detach(); } catch {}
      }
    }
  });
});
require('../dist/main.cjs');
