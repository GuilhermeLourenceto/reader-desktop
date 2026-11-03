const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-order-'));
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const plugin = {
  id: 'order',
  name: 'Source order',
  lang: 'en',
  version: '1',
  site: 'https://example.test',
  url: 'https://example.test/plugin.js',
};
const state = {
  ...emptyState(),
    // These older UI journeys intentionally assert Portuguese labels.
    settings: { desktopInterfaceLanguage: 'pt-BR' },
  plugins: [plugin],
  novels: [
    {
      id: 1,
      name: 'Reverse source',
      path: '/book',
      pluginId: 'order',
      inLibrary: true,
      totalPages: 2,
      desktopLoadedPages: [1],
      chapters: [5, 4].map((number, index) => ({
        id: number,
        novelId: 1,
        name: `Chapter ${number}`,
        path: `/c${number}`,
        unread: true,
        page: '1',
        position: index,
      })),
    },
  ],
};
state.files['Plugins/order/index.js'] = Buffer.from(
  `exports.default={...${JSON.stringify(
    plugin,
  )},parsePage:async()=>({chapters:[3,2,1].map(n=>({name:'Chapter '+n,path:'/c'+n}))})};`,
).toString('base64');
for (const id of [4, 5, 6, 7, 8])
  state.files[`Novels/order/1/${id}/index.html`] = Buffer.from(
    '<p>Chapter reading order fixture.</p>'.repeat(90),
  ).toString('base64');
fs.writeFileSync(path.join(directory, 'library.json'), JSON.stringify(state));
const timeout = setTimeout(() => app.exit(1), 45000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const execute = code => win.webContents.executeJavaScript(code, true);
    const wait = async code => {
      for (let index = 0; index < 200; index++) {
        if (await execute(code)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
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
        `Array.from(document.querySelectorAll('button')).find(item=>(item.getAttribute('aria-label')||item.textContent.trim())===${JSON.stringify(
          label,
        )}).click()`,
      );
    try {
      await wait(
        "document.querySelector('.book') && !document.querySelector('.busy')",
      );
      await execute("document.querySelector('.book').click()");
      await click('Filtrar e ordenar capítulos');
      await wait("document.querySelector('.chapter-direction-setting')");
      assert.match(
        await execute(
          "document.querySelector('.chapter-direction-setting').textContent",
        ),
        /decrescente/,
      );
      await click('Continuar leitura');
      await wait(
        "document.querySelector('.reader-title')?.textContent.includes('Chapter 1') && !document.querySelector('.busy')",
      );
      assert.match(
        await execute(
          "document.querySelector('.reader-chapter-position').textContent",
        ),
        /Capítulo 1 de 5/,
      );
      await click('Próximo capítulo');
      await wait(
        "document.querySelector('.reader-title')?.textContent.includes('Chapter 2') && !document.querySelector('.busy')",
      );
      assert.match(
        await execute(
          "document.querySelector('.reader-chapter-position').textContent",
        ),
        /Capítulo 2 de 5/,
      );
      await click('Capítulo anterior');
      await wait(
        "document.querySelector('.reader-title')?.textContent.includes('Chapter 1') && !document.querySelector('.busy')",
      );
      await click('Voltar aos capítulos');
      assert.deepEqual(
        await execute(
          "Array.from(document.querySelectorAll('.chapter-ordinal'), node=>node.textContent.trim())",
        ),
        ['5 de 5', '4 de 5', '3 de 5', '2 de 5', '1 de 5'],
      );
      await execute(
        "Array.from(document.querySelectorAll('button')).find(button=>button.getAttribute('aria-label')==='Filtrar e ordenar capítulos').click()",
      );
      await execute(
        "(()=>{const select=document.querySelector('select[aria-label=\"Início da história na fonte\"]');select.value='ascending';select.dispatchEvent(new Event('change',{bubbles:true}));})()",
      );
      await wait(
        "document.querySelector('.chapter-ordinal').textContent.trim()==='1 de 5'",
      );
      await wait(
        "window.desktop.load().then(state=>state.novels[0].desktopChapterOrder==='ascending')",
      );
      const saved = await execute('window.desktop.load()');
      assert.deepEqual(
        saved.novels[0].chapters.map(ch => ch.name),
        ['Chapter 5', 'Chapter 4', 'Chapter 3', 'Chapter 2', 'Chapter 1'],
      );
      console.log(
        'PASS: descending source preserved, start loads missing pages and opens chapter 1, chronological next/previous, independent numbering and persisted manual direction.',
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
require('../dist/main.cjs');
