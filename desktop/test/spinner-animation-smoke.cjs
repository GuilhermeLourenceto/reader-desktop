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

    async function verifyMotion(reduced) {
      const metrics = await js(`(() => {
        const container = document.createElement('div');
        container.id = 'motion-test';
        container.innerHTML = '<button>Test</button><nav><button class="active"><span class="nav-icon">Home</span></button></nav><div class="cover-wrap"></div><button class="palette-swatch">Palette</button><div class="setting-switch"><span></span></div><div class="chapter-download-track"><span></span></div><div class="chapter-download-track is-indeterminate"><span></span></div><div class="reader-view"><header></header><footer></footer></div>';
        document.body.append(container);
        const duration = selector => getComputedStyle(container.querySelector(selector)).transitionDuration;
        const track = container.querySelector('.chapter-download-track.is-indeterminate > span');
        return {
          button: duration('button'),
          navIcon: duration('nav .nav-icon'),
          cover: duration('.cover-wrap'),
          palette: duration('button.palette-swatch'),
          toggle: duration('.setting-switch > span'),
          switchTrack: duration('.setting-switch'),
          progress: duration('.chapter-download-track:not(.is-indeterminate) > span'),
          chrome: duration('.reader-view > header'),
          indeterminate: getComputedStyle(track).animationDuration,
          name: getComputedStyle(track).animationName,
          transform: getComputedStyle(track).transform,
        };
      })()`);
      const quick = reduced ? '0s' : '0.16s';
      const standard = reduced ? '0s' : '0.22s';
      const progress = reduced ? '0s' : '0.18s';
      for (const name of ['button', 'navIcon', 'cover', 'palette', 'toggle', 'switchTrack'])
        assert.ok(metrics[name].split(',').every(value => value.trim() === quick), name + ': ' + JSON.stringify(metrics));
      assert.ok(metrics.chrome.split(',').every(value => value.trim() === standard), 'Reader chrome transition');
      assert.equal(metrics.progress, progress, 'Progress transition');
      assert.equal(metrics.name, 'chapter-download-indeterminate', 'Progress animation must be defined');
      assert.equal(metrics.indeterminate, reduced ? '2.4s' : '1.2s', 'Indeterminate progress uses accessible speed');
      let moved = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        await sleep(140);
        const transform = await js("getComputedStyle(document.querySelector('#motion-test .is-indeterminate > span')).transform");
        if (transform !== metrics.transform) moved = true;
      }
      assert.ok(moved, 'Download progress must move across real renderer frames');
      await js("document.getElementById('motion-test').remove()");
    }

    let attached = false;
    try {
      win.showInactive(); // A visible renderer is needed to test real frames.
      await probe(false, false);
      await probe(true, false);
      await verifyMotion(false);
      win.webContents.debugger.attach('1.3');
      attached = true;
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
      await probe(false, true);
      await verifyMotion(true);
      console.log('PASS: spinner, progress bar, nav highlight, buttons, palette, switch track/thumb and reader chrome animations across regular and reduced motion');
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
