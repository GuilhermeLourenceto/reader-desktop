// Extreme renderer test: large synthetic library in a disposable Electron
// userData directory, using the REAL application bundle and navigation.
// This must never touch the actual user profile, networks, or release files.
const { app } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-huge-ui-'));
const bookCount = 10000;
const chapterCount = 20;
const state = {
  novels: Array.from({ length: bookCount }, (_, i) => ({
    id: i + 1,
    name: 'Synthetic Library Entry ' + String(i + 1).padStart(5, '0'),
    pluginId: 'stress',
    path: '/stress/' + (i + 1),
    inLibrary: true,
    chapters: Array.from({ length: chapterCount }, (_, j) => ({
      id: i * chapterCount + j + 1,
      novelId: i + 1,
      name: 'Chapter ' + (j + 1),
      path: '/stress/' + (i + 1) + '/' + (j + 1),
      progress: (i + j) % 4 === 0 ? 100 : 0,
      bookmark: j === 1,
      unread: (i + j) % 4 !== 0,
    })),
  })),
  categories: [
    { id: 1, name: 'Stress Selection',
      novelIds: Array.from({ length: 2500 }, (_, i) => i * 4 + 1) },
  ],
  files: {}, settings: {}, plugins: [], repositories: [], pluginStorage: {},
};
fs.writeFileSync(path.join(root, 'library.json'), JSON.stringify(state));
app.setPath('userData', root);
app.commandLine.appendSwitch('disable-gpu');
const started = performance.now();
let finished = false;
let window;
const deadline = setTimeout(() => {
  console.error('Giant library UI timed out after 150 seconds');
  finish(1);
}, 150000);
function finish(code) {
  if (finished) return;
  finished = true;
  clearTimeout(deadline);
  if (window && !window.isDestroyed()) window.destroy();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (error) {
    console.warn('Unable to delete disposable stress profile:', error.message);
  }
  app.exit(code);
}
app.on('browser-window-created', (_event, win) => {
  if (window) return;
  window = win;
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const js = source => win.webContents.executeJavaScript(source, true);
    const wait = async (predicate, label, timeout = 120000) => {
      const began = performance.now();
      while (performance.now() - began < timeout) {
        if (await js(predicate)) return;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      throw new Error('Timed out: ' + label);
    };
    try {
      await wait("document.querySelectorAll('.book').length===10000 && !document.querySelector('.busy')", '10,000 book cards');
      const startup = +((performance.now() - started) / 1000).toFixed(2);
      assert.equal(await js("document.querySelectorAll('.book').length"), bookCount);
      const nav = async label => js(`(()=>{let b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||x.textContent.trim())===${JSON.stringify(label)});if(!b)throw Error('Missing nav '+${JSON.stringify(label)});b.click();return true})()`);
      await nav('Atualizações');
      await wait("Boolean(document.querySelector('.updates-page'))", 'Updates');
      await nav('Biblioteca');
      await wait("document.querySelectorAll('.book').length===10000", 'Library re-entry');
      const persisted = await js('window.desktop.load({metadataOnly:true})');
      assert.equal(persisted.novels.length, bookCount);
      assert.equal(persisted.novels[0].chapters.length, chapterCount);
      assert.equal(persisted.categories[0].novelIds.length, 2500);
      const metrics = {
        pass: true,
        os: process.platform,
        books: bookCount,
        chapters: bookCount * chapterCount,
        startupSeconds: startup,
        fullNavigationSeconds: +((performance.now() - started) / 1000).toFixed(2),
        appMetrics: app.getAppMetrics().map(({ type, memory }) => ({
          type,
          workingSetMiB: memory?.workingSetSize,
          privateMiB: memory?.privateBytes,
        })),
      };
      console.log('GIANT UI RESULT', JSON.stringify(metrics));
      finish(0);
    } catch (error) {
      console.error('GIANT UI FAILURE', error);
      finish(1);
    }
  });
});
require('../dist/main.cjs');
