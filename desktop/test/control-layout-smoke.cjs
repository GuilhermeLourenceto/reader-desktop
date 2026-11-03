// Regression for native select arrow spacing, rounded surfaces and alignment.
// Uses the real React renderer with a disposable synthetic library.
const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { emptyState } = require('../dist/backup.cjs');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-controls-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');
const state = emptyState();
state.settings = { ...state.settings, desktopInterfaceLanguage: 'pt-BR' };
state.novels = [{
  id: 1, name: 'Uma obra com nome longo para verificar o alinhamento',
  pluginId: 'local', path: '/demo', inLibrary: true,
  chapters: [{ id: 11, novelId: 1, name: 'Capítulo de exemplo', path: '/chapter', unread: true }],
}];
fs.writeFileSync(path.join(profile, 'library.json'), JSON.stringify(state));

let window;
let finished = false;
const deadline = setTimeout(() => {
  console.error('Control layout test timed out');
  finish(1);
}, 45000);
function finish(code) {
  if (finished) return;
  finished = true;
  clearTimeout(deadline);
  if (window && !window.isDestroyed()) window.destroy();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  app.exit(code);
}

app.on('browser-window-created', (_event, win) => {
  if (window) return;
  window = win;
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const js = code => win.webContents.executeJavaScript(code, true);
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    async function wait(predicate) {
      for (let i = 0; i < 160; i++) {
        if (await js(predicate)) return;
        await sleep(50);
      }
      throw new Error('Timed out: ' + predicate);
    }
    const click = label => js("(() => { const el = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || b.textContent.trim()) === " + JSON.stringify(label) + "); if (!el) throw new Error('Button unavailable: ' + " + JSON.stringify(label) + "); el.click(); return true })()");
    async function audit(selector, name) {
      const measures = await js("(() => { const nodes = Array.from(document.querySelectorAll(" + JSON.stringify(selector) + ")).filter(el => el.getClientRects().length); return {viewport:innerWidth,document:document.documentElement.scrollWidth,items:nodes.map(el => {const s=getComputedStyle(el);const r=el.getBoundingClientRect();return {appearance:s.appearance,paddingRight:parseFloat(s.paddingRight),radius:parseFloat(s.borderTopRightRadius),height:r.height,left:r.left,right:r.right,background:s.backgroundImage,position:s.backgroundPositionX}})} })()");
      assert.ok(measures.items.length, name + ': expected visible dropdown controls');
      assert.ok(measures.document <= measures.viewport + 1, name + ': no page overflow');
      for (const [index, m] of measures.items.entries()) {
        const tag = name + ' #' + index;
        assert.equal(m.appearance, 'none', tag + ': use consistent chevron on all platforms');
        assert.ok(m.paddingRight >= 44, tag + ': label needs 44px clearance');
        assert.ok(m.radius >= 12, tag + ': rounded corners');
        assert.ok(m.height >= 44, tag + ': minimum target height');
        assert.ok(m.background.includes('linear-gradient'), tag + ': chevron image missing');
        assert.ok(m.position.includes('23px') && m.position.includes('17px'), tag + ': chevron must remain inset');
        assert.ok(m.left >= -1 && m.right <= measures.viewport + 1, tag + ': dropdown clipped');
      }
      console.log('CONTROLS PASS:', name, measures.items.length, 'dropdowns');
    }
    try {
      await wait("document.querySelector('.book') && !document.querySelector('.busy')");
      await click('Filtrar biblioteca');
      await wait("document.querySelectorAll('.library-filter-field select').length === 2");
      await audit('.library-filter-field select', 'library category and sort');
      await js("document.querySelector('.book').click()");
      await wait("document.querySelector('.novel-page')");
      await click('Filtrar e ordenar capítulos');
      await wait("document.querySelectorAll('.chapter-filters select').length === 3");
      await audit('.chapter-filters select', 'chapter filter Todos / ordering');
      await click('Mais');
      await wait("document.querySelector('[data-settings-page=more]')");
      await click('Configurações');
      await wait("document.querySelector('[data-settings-page=settings]')");
      await click('Aparência');
      await wait("document.querySelector('select[aria-label=\"Tema do aplicativo\"]')");
      for (const theme of ['light', 'dark', 'oled']) {
        await js("(() => { const input = document.querySelector('select[aria-label=\"Tema do aplicativo\"]'); input.value = " + JSON.stringify(theme) + "; input.dispatchEvent(new Event('change', {bubbles:true})); return true })()");
        await wait("document.documentElement.dataset.appTheme === " + JSON.stringify(theme));
        await audit('.choice-row select', 'appearance ' + theme);
      }
      win.setSize(800, 650);
      await wait('innerWidth <= 800');
      await audit('.choice-row select', 'compact settings 800px');
      console.log('PASS: real Library/Novel/Settings selects have inset arrows, round fields and no overflow in light/dark/OLED and compact layouts.');
      finish(0);
    } catch (error) {
      console.error('CONTROLS GEOMETRY FAILURE', error);
      finish(1);
    }
  });
});
require('../dist/main.cjs');
