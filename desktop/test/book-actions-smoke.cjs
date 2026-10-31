const { app } = require('electron');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'lnreader-book-actions-'),
);
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhS8AAAAASUVORK5CYII=',
  'base64',
);
const html =
  '<p>Texto de demonstração para testar ações e ajustes durante a leitura.</p>'.repeat(
    70,
  ) + '<img src="/image.png" alt="Ilustração"/>';
const server = http.createServer((req, res) => {
  if (req.url === '/image.png') {
    res.setHeader('Content-Type', 'image/png');
    res.end(image);
  } else
    setTimeout(() => {
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    }, 350);
});
const timeout = setTimeout(() => {
  console.error('Book actions test timed out');
  app.exit(1);
}, 45000);
server.listen(0, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const plugin = {
    id: 'actions',
    name: 'Fonte de demonstração',
    site: base,
    lang: 'pt',
    version: '1.0.0',
    url: base + '/plugin.js',
  };
  const code = `const {fetchApi}=require('@libs/fetch');exports.default={...${JSON.stringify(
    plugin,
  )},parseChapter:async(path)=>(await fetchApi(${JSON.stringify(
    base,
  )}+path)).text()};`;
  const state = {
    ...emptyState(),
    plugins: [plugin],
    novels: [
      {
        id: 1,
        pluginId: 'actions',
        name: 'Biblioteca de histórias',
        path: '/novel',
        inLibrary: true,
        author: 'Autor de exemplo',
        status: 'Ongoing',
        genres: 'Fantasia, Aventura',
        summary: 'Uma história de demonstração. '.repeat(30),
        chapters: [
          {
            id: 1,
            novelId: 1,
            name: 'Capítulo 1',
            releaseTime: '2026-10-01',
            path: '/c1',
            unread: false,
            progress: 100,
            readTime: '2026-10-28T02:00:00Z',
            isDownloaded: false,
          },
          {
            id: 2,
            novelId: 1,
            name: 'Capítulo 2',
            path: '/c2',
            unread: true,
            progress: 0,
            isDownloaded: false,
          },
          {
            id: 3,
            novelId: 1,
            name: 'Capítulo 3',
            path: '/c3',
            unread: false,
            progress: 100,
            readTime: '2026-10-28T01:00:00Z',
            isDownloaded: true,
          },
        ],
      },
    ],
  };
  state.files['Plugins/actions/index.js'] =
    Buffer.from(code).toString('base64');
  state.files['Novels/actions/1/3/index.html'] =
    Buffer.from(html).toString('base64');
  fs.writeFileSync(path.join(directory, 'library.json'), JSON.stringify(state));
  app.on('browser-window-created', (_event, win) => {
    win.webContents.setBackgroundThrottling(false);
    win.webContents.once('did-finish-load', async () => {
      const execute = code => win.webContents.executeJavaScript(code, true);
      const wait = async code => {
        for (let i = 0; i < 220; i++) {
          if (await execute(code)) return;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(
          `Timeout: ${code}; ${await execute(
            'document.body.innerText.slice(-900)',
          )}`,
        );
      };
      const click = label =>
        execute(
          `Array.from(document.querySelectorAll('button')).find(button=>(button.getAttribute('aria-label')||button.textContent)===${JSON.stringify(
            label,
          )}).click()`,
        );
      const select = async (label, value) =>
        execute(
          `(()=>{const input=document.querySelector('select[aria-label='+${JSON.stringify(
            JSON.stringify(label),
          )}+']');input.value=${JSON.stringify(
            value,
          )};input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
        );
      const capture = async name => {
        await execute('document.fonts.ready.then(()=>true)');
        await new Promise(resolve => setTimeout(resolve, 120));
        fs.mkdirSync(path.join(__dirname, '../docs/previews'), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(__dirname, '../docs/previews', name + '.png'),
          (await win.webContents.capturePage()).toPNG(),
        );
        assert.equal(
          await execute('document.documentElement.scrollWidth<=innerWidth'),
          true,
        );
      };
      try {
        await wait(
          "document.querySelector('.book') && !document.body.innerText.includes('Processando…')",
        );
        await execute("document.querySelector('.book').click()");
        await wait("document.querySelectorAll('.chapter-open').length===3");
        assert.equal(
          await execute("document.querySelector('.chapter-filters')===null"),
          true,
        );
        for (const width of [1280, 1120, 800]) {
          win.setSize(width, 720);
          await new Promise(resolve => setTimeout(resolve, 100));
          assert.equal(
            await execute(`(()=>{
              const info=document.querySelector('.novel-info-column').getBoundingClientRect();
              const chapters=document.querySelector('.novel-chapters-column').getBoundingClientRect();
              return innerWidth>=1100 ? info.right<=chapters.left : info.bottom<=chapters.top;
            })()`),
            true,
          );
          await execute(`(()=>{
            const title=document.querySelector('.chapter-title');
            const original=title.textContent;
            title.textContent='UmTituloMuitoLongoSemEspacos'.repeat(12);
            window.removeLongTitle=()=>{title.textContent=original;};
          })()`);
          assert.equal(
            await execute(`(()=>{
              const row=document.querySelector('.chapter-row');
              return row.scrollWidth<=row.clientWidth+1 && document.documentElement.scrollWidth<=innerWidth;
            })()`),
            true,
            `Chapter text and controls must fit at ${width}px`,
          );
          await capture(`preview-novel-layout-${width}`);
          await execute('window.removeLongTitle()');
        }
        win.setSize(1280, 850);
        assert.deepEqual(
          await execute(
            "Array.from(document.querySelectorAll('.chapter-ordinal'), item => item.textContent.trim())",
          ),
          ['1 de 3', '2 de 3', '3 de 3'],
        );
        assert.equal(
          await execute(
            "document.querySelector('.chapter-release').textContent",
          ),
          'Lançamento: 01/10/2026',
        );
        assert.equal(
          await execute(
            "document.querySelectorAll('.genre-chips span').length",
          ),
          2,
        );
        await click('Marcar como não lido: Capítulo 1');
        await wait(
          'window.desktop.load().then(state=>state.novels[0].chapters[0].unread===true && state.novels[0].chapters[0].progress===0)',
        );
        await click('Filtrar e ordenar capítulos');
        await select('Filtrar capítulos', 'read');
        assert.equal(
          await execute("document.querySelectorAll('.chapter-open').length"),
          1,
        );
        await select('Filtrar capítulos', 'unread');
        await select('Ordenar capítulos', 'reverse');
        assert.equal(
          await execute(
            "document.querySelector('.chapter-ordinal').textContent.trim()",
          ),
          '2 de 3',
        );
        assert.ok(
          (
            await execute("document.querySelector('.chapter-open').textContent")
          ).includes('Capítulo 2'),
        );
        await execute(
          'document.querySelector(\'input[aria-label="Selecionar Capítulo 2"]\').click()',
        );
        await click('Marcar lidos');
        await select('Filtrar capítulos', 'all');
        await click('Adicionar marcador a Capítulo 2');
        await select('Filtrar capítulos', 'bookmarked');
        assert.equal(
          await execute("document.querySelectorAll('.chapter-open').length"),
          1,
        );
        await select('Filtrar capítulos', 'all');
        await click('Baixar capítulo: Capítulo 2');
        await wait("document.querySelector('.busy')!==null");
        await wait(
          "document.querySelector('.chapter-row.is-downloading [role=progressbar]')!==null",
        );
        await capture('preview-novel-downloading');
        assert.equal(
          await execute(
            "getComputedStyle(document.querySelector('.busy')).position",
          ),
          'static',
        );
        assert.equal(
          await execute(
            "document.querySelector('.busy').getBoundingClientRect().bottom<=document.querySelector('.novel-topbar').getBoundingClientRect().top",
          ),
          true,
        );
        await wait(
          "window.desktop.load().then(state=>state.novels[0].chapters[1].isDownloaded===true && !document.querySelector('.busy'))",
        );
        let saved = await execute('window.desktop.load()');
        assert.equal(saved.novels[0].chapters[1].readTime, undefined);
        assert.equal(saved.novels[0].chapters[1].unread, false);
        assert.equal(
          await execute(
            "document.querySelectorAll('.chapter-status-icon.is-downloaded').length",
          ),
          2,
        );
        assert.ok(saved.files['Novels/actions/1/2/0.b64.png']);
        assert.ok(
          Buffer.from(saved.files['Novels/actions/1/2/index.html'], 'base64')
            .toString()
            .includes('file:///Novels/'),
        );
        await capture('preview-novel-actions');
        await execute(
          "Array.from(document.querySelectorAll('.chapter-open')).find(button=>button.textContent.includes('Capítulo 2')).click()",
        );
        await wait(
          "document.querySelector('article img')!==null && !document.querySelector('.busy')",
        );
        assert.ok(
          (
            await execute("document.querySelector('article img').src")
          ).startsWith('data:image/png;base64,'),
        );
        await click('Ajustes de leitura');
        assert.equal(
          await execute(
            "(()=>{const panel=document.querySelector('.reader-controls').getBoundingClientRect();return panel.top>=document.querySelector('.reader-view header').getBoundingClientRect().bottom-1 && panel.bottom<=document.querySelector('.reader-view').getBoundingClientRect().bottom;})()",
          ),
          true,
        );
        await click('Alternar lido no leitor');
        await wait(
          'window.desktop.load().then(state=>state.novels[0].chapters[1].unread===true && state.novels[0].chapters[1].progress===0)',
        );
        await select('Fonte de leitura', 'sans');
        assert.ok(
          (
            await execute(
              "getComputedStyle(document.querySelector('article')).fontFamily",
            )
          ).includes('Noto Sans'),
        );
        await capture('preview-reader-controls');
        await click('Voltar aos capítulos');
        await wait(
          "document.querySelector('.chapter-row.is-current .current-chapter-badge')!==null",
        );
        assert.equal(
          await execute(
            "document.querySelector('.chapter-row.is-current .unread-dot')!==null",
          ),
          true,
        );
        await execute('void(window.confirm=()=>false)');
        await click('Apagar download: Capítulo 2');
        await wait("!document.querySelector('.busy')");
        assert.equal(
          await execute(
            "window.desktop.file('exists','Novels/actions/1/2/index.html')",
          ),
          true,
        );
        await execute('void(window.confirm=()=>true)');
        await click('Apagar download: Capítulo 2');
        await wait(
          'window.desktop.load().then(state=>state.novels[0].chapters[1].isDownloaded===false)',
        );
        assert.equal(
          await execute(
            "window.desktop.file('exists','Novels/actions/1/2/index.html')",
          ),
          false,
        );
        assert.equal(
          await execute(
            "window.desktop.file('exists','Novels/actions/1/2/0.b64.png')",
          ),
          false,
        );
        await click('Histórico');
        await wait("document.querySelectorAll('.history-row').length===3");
        await click('Remover do histórico: Capítulo 2');
        await wait("document.querySelectorAll('.history-row').length===2");
        await capture('preview-history');
        saved = await execute('window.desktop.load()');
        assert.equal(saved.novels[0].chapters[1].unread, true);
        console.log(
          'PASS: history, read/unread from novel and reader, filters/sorting, selection, bookmarks, offline download with images, confirmed deletion, reader controls and non-overlapping loading state.',
        );
        clearTimeout(timeout);
        server.close();
        win.destroy();
        app.exit(0);
      } catch (error) {
        console.error(error);
        clearTimeout(timeout);
        server.close();
        win.destroy();
        app.exit(1);
      }
    });
  });
  require(process.argv.includes('--packaged')
    ? '../release/win-unpacked/resources/app.asar/dist/main.cjs'
    : '../dist/main.cjs');
});
