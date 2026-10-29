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
  )},parseNovel:async(path)=>{if(path==='/fail')throw new Error('falha simulada');return {name:'Obra de exemplo',totalPages:3,chapters:[1,2,3].map(n=>({name:'Capítulo '+n,path:'/'+n,chapterNumber:n}))};},parsePage:async(path,page)=>({chapters:(page==='2'?[4,5]:[6,7]).map(n=>({name:'Capítulo '+n,path:'/'+n,chapterNumber:n}))}),parseChapter:async()=>'<p>Leitura de uma atualização.</p>'.repeat(30)};`,
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
    try {
      await wait(
        "document.querySelector('.book') && !document.querySelector('.busy')",
      );
      await click('Atualizações');
      await wait("document.querySelector('.updates-page')");
      assert.equal(
        await execute("document.querySelectorAll('.update-group').length"),
        0,
      );
      await click('Atualizar biblioteca');
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
      const shots = path.join(__dirname, '../docs/previews');
      await execute('void (window.confirm=()=>true)');
      await click('Apagar download da atualização: Capítulo 3');
      await wait(
        "!document.querySelector('.busy') && document.querySelector('[aria-label=\"Baixar atualização: Capítulo 3\"]')",
      );
      await click('Baixar atualização: Capítulo 3');
      await wait(
        "!document.querySelector('.busy') && document.querySelector('[aria-label=\"Apagar download da atualização: Capítulo 3\"]')",
      );
      fs.mkdirSync(shots, { recursive: true });
      fs.writeFileSync(
        path.join(shots, 'updates.png'),
        (await win.webContents.capturePage()).toPNG(),
      );
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
        'PASS: updates tab, full library refresh, unknown historical pages excluded, new pages detected, partial failure isolation, preserved IDs/progress/bookmarks, repeat refresh without duplicates, read/unread, group downloads and offline reading.',
      );
      clearTimeout(timeout);
      win.destroy();
      app.exit(0);
    } catch (error) {
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
