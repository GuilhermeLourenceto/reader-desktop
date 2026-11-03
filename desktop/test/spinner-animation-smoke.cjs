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
        container.innerHTML = '<button>Test</button><nav><button class="active"><span class="nav-icon">Home</span></button></nav><div class="source">Source</div><div class="cover-wrap"></div><button class="palette-swatch">Palette</button><div class="setting-switch"><span></span></div><div class="chapter-download-track"><span></span></div><div class="chapter-download-track is-indeterminate"><span></span></div><div class="reader-view"><header></header><footer></footer></div>';
        document.body.append(container);
        const duration = selector => getComputedStyle(container.querySelector(selector)).transitionDuration;
        const track = container.querySelector('.chapter-download-track.is-indeterminate > span');
        return {
          button: duration('button'),
          navIcon: duration('nav .nav-icon'),
          cover: duration('.cover-wrap'),
          sourceRow: duration('.source'),
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
      for (const name of ['button', 'navIcon', 'cover', 'sourceRow', 'palette', 'toggle', 'switchTrack'])
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



    // Regression: the real Updates layout must never grow its spinner into
    // a rotating, screen-wide ellipse when long novel titles are displayed.
    async function verifyUpdatesProgressLayout(reducedMotion) {
      const metrics = await js(`(() => {
        const wrapper = document.createElement('div');
        wrapper.id = 'updates-spinner-layout-test';
        wrapper.className = 'updates-page history-page';
        wrapper.innerHTML = '<div class="updates-progress" role="status"><span class="spinner spinner-small" aria-hidden="true"></span><span class="updates-progress-text">Verificando 1 de 2: A very long title for a novel being checked for new chapters</span><button>Parar após esta obra</button></div>';
        document.body.append(wrapper);
        const progress = wrapper.querySelector('.updates-progress');
        const spinner = progress.querySelector('.spinner');
        const label = progress.querySelector('.updates-progress-text');
        const style = getComputedStyle(spinner);
        return {
          width: spinner.offsetWidth,
          height: spinner.offsetHeight,
          panelWidth: progress.offsetWidth,
          viewportWidth: document.documentElement.clientWidth,
          labelWidth: label.offsetWidth,
          name: style.animationName,
          duration: style.animationDuration,
          transform: style.transform,
        };
      })()`);
      assert.equal(metrics.width, 18, 'Updates spinner must remain 18px wide, not grow as a flex item');
      assert.equal(metrics.height, 18, 'Updates spinner must remain circular');
      assert.ok(metrics.panelWidth <= Math.min(metrics.viewportWidth, 900), 'Updates status should stay compact');
      assert.ok(metrics.labelWidth > 0, 'Progress text must remain visible');
      assert.equal(metrics.name, 'loading-spin', 'Updates must use the real animated spinner');
      assert.equal(metrics.duration, reducedMotion ? '1.6s' : '0.8s');
      let moved = false;
      for (let i = 0; i < 4; i++) {
        await sleep(140);
        const transform = await js("getComputedStyle(document.querySelector('#updates-spinner-layout-test .spinner')).transform");
        if (transform !== metrics.transform) moved = true;
      }
      assert.ok(moved, 'Circular updates spinner must rotate in real Chromium frames');
      await js("document.getElementById('updates-spinner-layout-test').remove()");
    }

 
    async function verifyCompactGlobalBusy() {
      const metrics = await js(`(() => {
        const busy = document.createElement('div');
        busy.id = 'global-busy-visual-audit';
        busy.className = 'busy';
        busy.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Processando…</span><button>Cancelar operação</button>';
        document.body.appendChild(busy);
        const spinner = busy.querySelector('.spinner');
        const result = {
          width: busy.offsetWidth,
          viewport: document.documentElement.clientWidth,
          spinnerWidth: spinner.offsetWidth,
          spinnerHeight: spinner.offsetHeight,
          flexWrap: getComputedStyle(busy).flexWrap,
        };
        busy.remove();
        return result;
      })()`);
      assert.ok(metrics.width < Math.min(650, metrics.viewport * 0.75), 'Global busy banner must shrink to its content');
      assert.equal(metrics.spinnerWidth, 18, 'Global busy spinner width');
      assert.equal(metrics.spinnerHeight, 18, 'Global busy spinner height');
      assert.equal(metrics.flexWrap, 'wrap', 'Busy labels and buttons must wrap if the window narrows');
    }

    async function verifyActiveNavigation() {
      const nav = await js(`(() => {
        const button = document.querySelector('.app nav button.active');
        if (!button) throw new Error('Selected navigation tab is missing');
        const rect = button.getBoundingClientRect();
        const probe = document.createElement('span');
        probe.style.color = 'var(--primary)';
        probe.style.backgroundColor = 'var(--secondaryContainer)';
        document.body.appendChild(probe);
        const result = {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          expectedColor: getComputedStyle(probe).color,
          expectedBackground: getComputedStyle(probe).backgroundColor,
        };
        probe.remove();
        return result;
      })()`);
      assert.ok(nav.x > 0 && nav.y > 0, 'Selected navigation must be visible');
      win.webContents.sendInputEvent({ type: 'mouseMove', x: nav.x, y: nav.y });
      await sleep(240);
      const current = await js(`(() => {
        const button = document.querySelector('.app nav button.active');
        return {
          hovered: button.matches(':hover'),
          color: getComputedStyle(button).color,
          iconBackground: getComputedStyle(button.querySelector('.nav-icon')).backgroundColor,
        };
      })()`);
      assert.equal(current.hovered, true, 'Real pointer must hover the selected tab');
      assert.equal(current.color, nav.expectedColor, 'Active tab text must retain the theme accent on hover');
      assert.equal(current.iconBackground, nav.expectedBackground, 'Active icon must retain its selected background on hover');
    }

    let attached = false;
    try {
      win.showInactive(); // A visible renderer is needed to test real frames.
      await probe(false, false);
      await probe(true, false);
      await verifyMotion(false);
      await verifyUpdatesProgressLayout(false);
      await verifyCompactGlobalBusy();
      await verifyActiveNavigation();
      win.webContents.debugger.attach('1.3');
      attached = true;
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
      await probe(false, true);
      await verifyMotion(true);
      await verifyUpdatesProgressLayout(true);
      console.log('PASS: compact busy banner, circular Updates spinner layout, progress bar, active navigation hover, source highlight, buttons, palette, switch track/thumb and reader chrome animations across regular and reduced motion');
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
