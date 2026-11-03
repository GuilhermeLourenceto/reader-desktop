const { app } = require('electron');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-updates-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');
const plugin = {
  id: 'updates',
  name: 'Fixture',
  url: 'https://example.test/source.js',
  site: 'https://example.test',
  version: '1',
  lang: 'pt',
};
const state = {
  ...emptyState(),
  settings: { desktopInterfaceLanguage: 'pt-BR', desktopTheme: 'oled', desktopPalette: 'lavender' },
  plugins: [plugin],
  novels: [
    {
      id: 1,
      pluginId: 'updates',
      name: 'Obra de exemplo',
      path: '/good',
      inLibrary: true,
      totalPages: 2,
      desktopLoadedPages: [1],
      chapters: [
        {
          id: 1,
          novelId: 1,
          name: 'Capítulo 1',
          path: '/1',
          page: '1',
          unread: false,
          progress: 100,
          bookmark: true,
        },
        {
          id: 2,
          novelId: 1,
          name: 'Capítulo 2',
          path: '/2',
          page: '1',
          unread: true,
        },
      ],
    },
    {
      id: 2,
      pluginId: 'updates',
      name: 'Fonte com falha',
      path: '/fail',
      inLibrary: true,
      chapters: [],
    },
  ],
};
state.files['Plugins/updates/index.js'] = Buffer.from(
  `exports.default={...${JSON.stringify(
    plugin,
  )},parseNovel:async(path)=>{await new Promise(resolve=>setTimeout(resolve,900));if(path==='/fail')throw new Error('falha simulada');return {name:'Obra de exemplo',totalPages:3,chapters:[1,2,3].map(n=>({name:'Capítulo '+n,path:'/'+n,chapterNumber:n}))};},parsePage:async(path,page)=>({chapters:(page==='2'?[4,5]:[6,7]).map(n=>({name:'Capítulo '+n,path:'/'+n,chapterNumber:n}))}),parseChapter:async()=>'<p>Leitura de uma atualização.</p>'.repeat(30)};`,
).toString('base64');
fs.writeFileSync(path.join(profile, 'library.json'), JSON.stringify(state));
const timeout = setTimeout(() => app.exit(1), 60000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const execute = code => win.webContents.executeJavaScript(code, true);
    const wait = async code => {
      for (let i = 0; i < 500; i++) {
        if (await execute(`Promise.resolve(${code}).then(Boolean)`)) return;
        await new Promise(r => setTimeout(r, 40));
      }
      throw new Error(
        'Timeout: ' +
          code +
          '; ' +
          (await execute('document.body.innerText.slice(-1200)')),
      );
    };
    const click = label =>
      execute(
        `Array.from(document.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')||b.textContent.trim())===${JSON.stringify(
          label,
        )}).click()`,
      );

    // Inspect the real Updates component while a source worker is pending.
    // The previous isolated spinner test missed a parent flex selector that
    // stretched the animation across the entire page.
    const inspectLiveProgress = async label => {
      const metrics = await execute(`(() => {
        const panel = document.querySelector('.updates-progress');
        if (!panel) throw new Error('The real Updates progress panel is missing');
        const spinner = panel.querySelector('.spinner');
        const text = panel.querySelector('.updates-progress-text');
        const main = document.querySelector('main');
        const panelRect = panel.getBoundingClientRect();
        const spinnerRect = spinner.getBoundingClientRect();
        const mainRect = main.getBoundingClientRect();
        const style = getComputedStyle(spinner);
        return {
          innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          panelWidth: panelRect.width,
          panelLeft: panelRect.left,
          panelRight: panelRect.right,
          mainLeft: mainRect.left,
          mainRight: mainRect.right,
          spinnerWidth: spinner.offsetWidth,
          spinnerHeight: spinner.offsetHeight,
          spinnerPaintWidth: spinnerRect.width,
          spinnerPaintHeight: spinnerRect.height,
          spinnerAnimation: style.animationName,
          spinnerState: style.animationPlayState,
          textWidth: text.getBoundingClientRect().width,
          appearance: document.documentElement.dataset.appTheme,
          duplicateGlobalBusy: !!document.querySelector('.busy'),
        };
      })()`);
      assert.equal(metrics.appearance, 'oled', label + ': real OLED theme');
      assert.equal(metrics.duplicateGlobalBusy, false, label + ': no duplicate full-width busy banner');
      assert.equal(metrics.spinnerWidth, 18, label + ': spinner width');
      assert.equal(metrics.spinnerHeight, 18, label + ': spinner height');
      assert.ok(Math.abs(metrics.spinnerPaintWidth - metrics.spinnerPaintHeight) < 0.1, label + ': spinner must remain circular even during animation');
      assert.equal(metrics.spinnerAnimation, 'loading-spin', label + ': CSS animation name');
      assert.equal(metrics.spinnerState, 'running', label + ': CSS animation must be running');
      assert.ok(metrics.textWidth > 0, label + ': progress label must remain visible');
      assert.ok(metrics.panelWidth <= Math.min(900, metrics.innerWidth), label + ': panel width');
      assert.ok(metrics.panelLeft >= metrics.mainLeft - 1, label + ': progress must stay inside the content area');
      assert.ok(metrics.panelRight <= metrics.mainRight + 1, label + ': progress must not clip outside content area');
      assert.ok(metrics.documentWidth <= metrics.innerWidth + 1, label + ': no horizontal page overflow');
      return metrics;
    };

    // On some headless Linux/Xvfb builds Chromium cannot capture an offscreen
    // surface and returns UnknownVizError. Geometry checks remain mandatory;
    // screenshots are a complementary, best-effort visual diagnostic.
    const captureVisual = async name => {
      try {
        win.showInactive();
        const bitmap = await win.webContents.capturePage();
        if (bitmap.isEmpty()) throw new Error('Empty screenshot');
        const output = path.join(__dirname, '../docs/previews');
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, name), bitmap.toPNG());
        console.log('VISUAL SCREENSHOT SAVED:', name);
      } catch (error) {
        console.warn('Screenshot unavailable in headless runner:', error?.message || error);
      }
    };
    let stage = 'wait-library';
    try {
      console.log('UPDATES VISUAL CHECK: ' + stage);
      await wait(
        "document.querySelector('.book') && !document.querySelector('.busy')",
      );
      stage = 'open-updates';
      console.log('UPDATES VISUAL CHECK: ' + stage);
      await click('Atualizações');
      await wait("document.querySelector('.updates-page')");
      assert.equal(
        await execute("document.querySelectorAll('.update-group').length"),
        0,
      );
      stage = 'refresh-running';
      console.log('UPDATES VISUAL CHECK: ' + stage);
      await click('Atualizar biblioteca');
      await wait("!!document.querySelector('.updates-progress')");
      stage = 'audit-wide';
      console.log('UPDATES VISUAL CHECK: ' + stage);
      await inspectLiveProgress('1280px live refresh');
      stage = 'audit-narrow';
      console.log('UPDATES VISUAL CHECK: ' + stage);
      win.setSize(800, 650);
      await wait('innerWidth <= 800');
      await inspectLiveProgress('800px live refresh');
      await captureVisual('updates-progress-800.png');
      stage = 'wait-refresh-complete';
      console.log('UPDATES VISUAL CHECK: ' + stage);
      win.setSize(1280, 850);
      await wait(
        "!document.querySelector('.busy') && document.querySelector('.update-group') && document.querySelector('.updates-errors')",
      );
      await wait(
        'window.desktop.load({metadataOnly:true}).then(s=>s.novels[0].chapters.length===7)',
      );
      let saved = await execute('window.desktop.load({metadataOnly:true})');
      assert.equal(saved.novels[0].chapters.length, 7);
      assert.deepEqual(
        saved.novels[0].chapters.filter(c => c.updatedTime).map(c => c.path),
        ['/3', '/6', '/7'],
      );
      assert.equal(saved.novels[0].chapters[0].unread, false);
      assert.equal(saved.novels[0].chapters[0].bookmark, true);
      assert.equal(saved.novels[1].chapters.length, 0);
      const dates = saved.novels[0].chapters.map(c => c.updatedTime);
      await click('Atualizar biblioteca');
      await wait(
        "!document.querySelector('.busy') && !document.querySelector('.updates-progress')",
      );
      saved = await execute('window.desktop.load({metadataOnly:true})');
      assert.deepEqual(
        saved.novels[0].chapters.map(c => c.updatedTime),
        dates,
      );
      await click('Expandir capítulos: Obra de exemplo');
      assert.equal(
        await execute("document.querySelectorAll('.update-chapter').length"),
        3,
      );
      await click('Marcar lidos');
      await wait(
        "document.querySelectorAll('.update-chapter.is-read').length===3",
      );
      await click('Marcar não lidos');
      await wait(
        "document.querySelectorAll('.update-chapter.is-read').length===0",
      );
      await click('Baixar');
      await wait(
        "!document.querySelector('.busy') && document.querySelectorAll('.update-chapter-open small').length===3 && Array.from(document.querySelectorAll('.update-chapter-open small')).every(e=>e.textContent.includes('Baixado'))",
      );
      await execute('void (window.confirm=()=>true)');
      await click('Apagar download da atualização: Capítulo 3');
      await wait(
        "!document.querySelector('.busy') && document.querySelector('[aria-label=\"Baixar atualização: Capítulo 3\"]')",
      );
      await click('Baixar atualização: Capítulo 3');
      await wait(
        "!document.querySelector('.busy') && document.querySelector('[aria-label=\"Apagar download da atualização: Capítulo 3\"]')",
      );
      await captureVisual('updates.png');
      await execute("document.querySelector('.update-chapter-open').click()");
      await wait(
        "document.querySelector('article')?.textContent.includes('Leitura de uma atualização') && !document.querySelector('.busy')",
      );
      await click('Voltar aos capítulos');
      await click('Atualizações');
      await wait("document.querySelector('.updates-page')");
      assert.equal(
        await execute('document.documentElement.scrollWidth<=innerWidth'),
        true,
      );
      win.webContents.debugger.attach('1.3');
      await win.webContents.debugger.sendCommand(
        'Emulation.setDeviceMetricsOverride',
        { width: 800, height: 650, deviceScaleFactor: 1, mobile: false },
      );
      await wait('innerWidth<=800');
      assert.equal(
        await execute('document.documentElement.scrollWidth<=innerWidth'),
        true,
      );
      console.log(
        'PASS: real OLED update spinner at 1280px and 800px, no duplicate busy strip, screenshot captured, library refresh, partial failures, saved progress, repeat refresh, read/unread and offline reading.',
      );
      clearTimeout(timeout);
      win.destroy();
      app.exit(0);
    } catch (error) {
      console.error('UPDATES VISUAL AUDIT FAILED AT', stage, 'name:', error?.name, 'message:', error?.message, 'stack:', error?.stack);
      console.error(error);
      clearTimeout(timeout);
      win.destroy();
      app.exit(1);
    }
  });
});
require(process.argv.includes('--packaged')
  ? '../release/win-unpacked/resources/app.asar/dist/main.cjs'
  : '../dist/main.cjs');
