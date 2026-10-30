const { app } = require('electron');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'lnreader-library-search-'),
);
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const calls = new Map();
let active = 0,
  maxActive = 0;
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhS8AAAAASUVORK5CYII=';
const text =
  '<p>Um texto de demonstração para comparar a prévia com a leitura e verificar as ações da biblioteca.</p>'.repeat(
    70,
  );
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/chapter') {
    response.end(text);
    return;
  }
  const id = url.searchParams.get('id'),
    term = url.searchParams.get('term'),
    page = Number(url.searchParams.get('page'));
  const key = `${id}:${term}:${page}`;
  calls.set(key, (calls.get(key) || 0) + 1);
  active++;
  maxActive = Math.max(maxActive, active);
  setTimeout(() => {
    active--;
    response.setHeader('Content-Type', 'application/json');
    if (id === 'broken' && calls.get(key) === 1) {
      response.writeHead(503);
      response.end('{}');
      return;
    }
    response.end(
      JSON.stringify(
        page > 2
          ? []
          : [{ name: `${id} ${term} ${page}`, path: `/${term}/${page}` }],
      ),
    );
  }, 150);
});
const timeout = setTimeout(() => {
  console.error('Library/search test timed out');
  app.exit(1);
}, 60000);
server.listen(0, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const plugins = ['alpha', 'beta', 'gamma', 'broken'].map(id => ({
    id,
    name: id === 'alpha' ? 'Alpha Source' : id + ' source',
    lang: 'en',
    site: base,
    url: base + '/plugin.js',
    version: '1.0.0',
  }));
  const state = {
    ...emptyState(),
    plugins,
    categories: [
      { id: 1, name: 'Lendo', novelIds: [1] },
      { id: 2, name: 'Depois', novelIds: [2] },
    ],
    novels: [
      {
        id: 1,
        pluginId: 'alpha',
        name: 'Obra A',
        path: '/saved-a',
        inLibrary: true,
        chapters: [
          {
            id: 11,
            novelId: 1,
            path: '/c1',
            name: 'Capítulo A',
            unread: false,
            progress: 75,
            readTime: '2026-10-28T01:00:00Z',
            bookmark: true,
            isDownloaded: true,
          },
        ],
      },
      {
        id: 2,
        pluginId: 'beta',
        name: 'Obra B',
        path: '/saved-b',
        inLibrary: true,
        chapters: [
          {
            id: 22,
            novelId: 2,
            path: '/c2',
            name: 'Capítulo B',
            unread: false,
            progress: 100,
            readTime: '2026-10-28T02:00:00Z',
            isDownloaded: false,
          },
        ],
      },
    ],
  };
  for (const plugin of plugins) {
    const code = `const {fetchApi}=require('@libs/fetch');exports.default={...${JSON.stringify(
      plugin,
    )},searchNovels:async(term,page)=>{const response=await fetchApi(${JSON.stringify(
      base,
    )}+'/search?id='+${JSON.stringify(
      plugin.id,
    )}+'&term='+encodeURIComponent(term)+'&page='+page);if(!response.ok)throw new Error('Fonte temporariamente indisponível');return response.json();},parseNovel:async(path)=>({name:'Resultado da fonte',path,chapters:[]}),parseChapter:async()=> (await fetchApi(${JSON.stringify(
      base + '/chapter',
    )})).text()};`;
    state.files['Plugins/' + plugin.id + '/index.js'] =
      Buffer.from(code).toString('base64');
  }
  state.files['Covers/1'] = png;
  state.files['Covers/2'] = png;
  state.files['Novels/alpha/1/11/index.html'] =
    Buffer.from(text).toString('base64');
  fs.writeFileSync(path.join(directory, 'library.json'), JSON.stringify(state));
  app.on('browser-window-created', (_event, win) => {
    win.webContents.setBackgroundThrottling(false);
    win.webContents.once('did-finish-load', async () => {
      const execute = code => win.webContents.executeJavaScript(code, true);
      const wait = async code => {
        for (let i = 0; i < 300; i++) {
          if (await execute(code)) return;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(
          `Timeout: ${code}; ${await execute(
            'document.body.innerText.slice(-800)',
          )}`,
        );
      };
      const click = label =>
        execute(
          `Array.from(document.querySelectorAll('button')).find(button=>(button.getAttribute('aria-label')||button.textContent)===${JSON.stringify(
            label,
          )}).click()`,
        );
      const select = (label, value) =>
        execute(
          `(()=>{const input=document.querySelector('select[aria-label='+${JSON.stringify(
            JSON.stringify(label),
          )}+']');input.value=${JSON.stringify(
            value,
          )};input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
        );
      const input = (selector, value) =>
        execute(
          `(()=>{const input=document.querySelector(${JSON.stringify(
            selector,
          )});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(
            value,
          )});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
        );
      const context = () =>
        execute(
          "document.querySelector('.book').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:innerWidth-3,clientY:innerHeight-3}))",
        );
      const capture = async name => {
        await execute('document.fonts.ready.then(()=>true)');
        await new Promise(resolve => setTimeout(resolve, 150));
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
          "document.querySelectorAll('.book').length===2&&!document.querySelector('.busy')",
        );
        // Category visibility must not require an app restart, as reported
        // for category-based library additions in LNReader #1963.
        await execute(
          "Array.from(document.querySelectorAll('[role=tab]')).find(button=>button.textContent.includes('Lendo')).click()",
        );
        await wait("document.querySelectorAll('.book').length===1");
        assert.equal(
          await execute("document.querySelector('.book').textContent.includes('Obra A')"),
          true,
        );
        await execute(
          "Array.from(document.querySelectorAll('[role=tab]')).find(button=>button.textContent.includes('Depois')).click()",
        );
        await wait("document.querySelectorAll('.book').length===1");
        assert.equal(
          await execute("document.querySelector('.book').textContent.includes('Obra B')"),
          true,
        );
        await execute(
          "Array.from(document.querySelectorAll('[role=tab]')).find(button=>button.textContent.includes('Todas')).click()",
        );
        await wait("document.querySelectorAll('.book').length===2");
        await click('Histórico');
        assert.equal(
          await execute(
            "document.querySelectorAll('.history-cover img').length",
          ),
          2,
        );
        await wait(
          "Array.from(document.querySelectorAll('.history-cover img')).every(image=>image.complete && image.naturalWidth>0)",
        );
        await capture('preview-history-covers');
        await click('Mais');
        await click('Configurações');
        await click('Aparência');
        await select('Tema do aplicativo', 'light');
        await click('Biblioteca');
        await context();
        assert.equal(
          await execute(
            "getComputedStyle(document.querySelector('[role=menu]')).backgroundColor",
          ),
          'rgb(231, 232, 241)',
        );
        assert.equal(
          await execute(
            "getComputedStyle(document.querySelector('[role=menu] button')).color",
          ),
          'rgb(27, 27, 31)',
        );
        assert.equal(
          await execute(
            "(()=>{const rect=document.querySelector('[role=menu]').getBoundingClientRect();return rect.right<=innerWidth&&rect.bottom<=innerHeight;})()",
          ),
          true,
        );
        await capture('preview-library-context-light');
        await execute(
          "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))",
        );
        await click('Mais');
        await click('Configurações');
        await click('Leitor');
        await select('Fonte de leitura', 'sans');
        await execute(
          "(()=>{const input=document.querySelector('input[aria-label=\"Tamanho da fonte\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'28');input.dispatchEvent(new Event('input',{bubbles:true}));})()",
        );
        await select('Fundo da leitura', 'sepia');
        await click('Ver em tamanho real');
        assert.equal(
          await execute("document.querySelector('dialog').open"),
          true,
        );
        const preview = await execute(
          "(()=>{const style=getComputedStyle(document.querySelector('dialog article'));return [style.fontFamily,style.fontSize,style.lineHeight,style.maxWidth,style.textAlign,style.color];})()",
        );
        await capture('preview-reader-real-size');
        await click('Fechar prévia');
        await click('Biblioteca');
        await execute("document.querySelector('.book').click()");
        await click('Continuar leitura');
        await wait(
          "document.querySelector('.reader-scroll article')&&!document.querySelector('.busy')",
        );
        assert.deepEqual(
          await execute(
            "(()=>{const style=getComputedStyle(document.querySelector('.reader-scroll article'));return [style.fontFamily,style.fontSize,style.lineHeight,style.maxWidth,style.textAlign,style.color];})()",
          ),
          preview,
        );
        await click('Voltar aos capítulos');
        await click('Voltar à biblioteca');
        await execute('void(window.confirm=()=>false)');
        await context();
        await click('Resetar leitura da obra');
        assert.equal(
          (await execute('window.desktop.load()')).novels[0].chapters[0]
            .bookmark,
          true,
        );
        await execute('void(window.confirm=()=>true)');
        await context();
        await click('Resetar leitura da obra');
        await wait(
          'window.desktop.load().then(state=>state.novels[0].chapters[0].progress===0&&state.novels[0].chapters[0].readTime===null)',
        );
        let saved = await execute('window.desktop.load()');
        assert.equal(saved.novels[0].chapters[0].isDownloaded, true);
        assert.equal(saved.novels[0].chapters[0].bookmark, true);
        await execute(
          "document.querySelectorAll('.book-select').forEach(input=>input.click())",
        );
        await click('Baixar selecionadas');
        await wait(
          "window.desktop.load().then(state=>state.novels[1].chapters[0].isDownloaded===true&&!document.querySelector('.busy'))",
        );
        assert.equal(
          await execute(
            "window.desktop.file('exists','Novels/beta/2/22/index.html')",
          ),
          true,
        );
        await execute(
          "document.querySelectorAll('.book-select').forEach(input=>input.click())",
        );
        await click('Remover selecionadas');
        await wait("document.querySelectorAll('.book').length===0");
        assert.equal(
          await execute(
            "window.desktop.file('exists','Novels/alpha/1/11/index.html')",
          ),
          true,
        );
        await click('Fontes');
        await input(
          'input[placeholder="Filtrar fontes por nome ou idioma"]',
          'Alpha',
        );
        assert.equal(
          await execute("document.querySelectorAll('.source').length"),
          1,
        );
        await click('Buscar obras em todas as fontes');
        await input('#global-novel-query', 'hero');
        await execute(
          "document.querySelector('.global-search-form').requestSubmit()",
        );
        await wait(
          "document.querySelectorAll('.global-source-results').length===4&&!document.querySelector('.global-search-progress')",
        );
        for (const plugin of plugins)
          assert.equal(calls.get(plugin.id + ':hero:1'), 1);
        assert.ok(maxActive <= 3);
        await click('Tentar esta fonte novamente');
        await wait(
          "document.querySelectorAll('[data-source-id=broken] .book').length===1 && !document.querySelector('[data-source-id=broken] [role=alert]')",
        );
        assert.equal(calls.get('broken:hero:1'), 2);
        await execute(
          "document.querySelector('[data-source-id=alpha] > button').click()",
        );
        await wait(
          "document.querySelectorAll('[data-source-id=alpha] .book').length===2",
        );
        await capture('preview-global-search');
        await execute(
          "document.querySelector('[data-source-id=beta] .book').click()",
        );
        await wait(
          "document.querySelector('.novel-hero')&&!document.querySelector('.busy')",
        );
        await wait(
          "window.desktop.load().then(state=>state.novels.some(book=>book.path==='/hero/1'&&book.pluginId==='beta'))",
        );
        console.log(
          'PASS: themed context menus, history covers, identical real-size reader preview, reset with preserved downloads/bookmarks, multi-book downloads/removal, independent source filtering and global search with bounded concurrency and isolated retry.',
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
  require('../dist/main.cjs');
});
