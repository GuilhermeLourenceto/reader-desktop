const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'lnreader-pagination-'),
);
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const requests = new Map();
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const term = url.searchParams.get('term');
  const page = Number(url.searchParams.get('page'));
  const key = `${term}:${page}`;
  requests.set(key, (requests.get(key) || 0) + 1);
  const send = () => {
    response.setHeader('Content-Type', 'application/json');
    if (
      ((page === 3 && term === 'alpha') ||
        (page === 1 && term === 'first-error')) &&
      requests.get(key) === 1
    ) {
      response.writeHead(503);
      response.end('{}');
      return;
    }
    const items =
      page >= 3
        ? []
        : Array.from({ length: 30 }, (_, index) => ({
            name: `${term} novel ${(page - 1) * 30 + index + 1}`,
            path: `/${term}/${(page - 1) * 30 + index + 1}`,
          }));
    if (page === 2)
      items.unshift({ name: `${term} novel 1`, path: `/${term}/1` });
    response.end(JSON.stringify(items));
  };
  setTimeout(send, term === 'slow' && page === 2 ? 800 : page > 1 ? 250 : 0);
});
const timeout = setTimeout(() => {
  console.error('Pagination test timed out');
  app.exit(1);
}, 45000);
server.listen(0, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const plugin = {
    id: 'pagination',
    name: 'Pagination fixture',
    site: base,
    version: '1.0.0',
    lang: 'en',
    url: `${base}/plugin.js`,
    iconUrl: '',
  };
  const code = `const {fetchApi} = require('@libs/fetch'); exports.default = {
    ...${JSON.stringify(plugin)},
    filters: {order:{type:'Picker',label:'Ordenação',value:'popular',options:[{value:'popular',label:'Padrão'},{value:'filtered',label:'Filtrada'}]}},
    popularNovels: async function(page, options) { return this.searchNovels(options.showLatestNovels ? 'latest' : options.filters.order.value, page); },
    searchNovels: async (term, page) => { const response = await fetchApi(${JSON.stringify(
      base,
    )} + '/search?term=' + encodeURIComponent(term) + '&page=' + page); if (!response.ok) throw new Error('Falha temporária de teste'); return response.json(); }
  };`;
  const state = { ...emptyState(), plugins: [plugin] };
  state.files['Plugins/pagination/index.js'] =
    Buffer.from(code).toString('base64');
  fs.writeFileSync(path.join(directory, 'library.json'), JSON.stringify(state));
  app.on('browser-window-created', (_event, win) => {
    win.webContents.setBackgroundThrottling(false);
    win.webContents.on('did-finish-load', async () => {
      const execute = code => win.webContents.executeJavaScript(code, true);
      const wait = async code => {
        for (let i = 0; i < 200; i++) {
          if (await execute(code)) return;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(
          `Timeout: ${code}; UI: ${await execute(
            'document.body.innerText.slice(-700)',
          )}`,
        );
      };
      const search = async (term, expectError = false) => {
        await execute(
          `(() => { const input = document.querySelector('input[placeholder="Buscar obras"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, ${JSON.stringify(
            term,
          )}); input.dispatchEvent(new Event('input', {bubbles:true})); })()`,
        );
        await execute("document.querySelector('form').requestSubmit()");
        if (expectError) {
          await wait("document.body.innerText.includes('Tentar novamente')");
          return;
        }
        await wait(
          `document.querySelector('.book strong')?.textContent === ${JSON.stringify(
            term + ' novel 1',
          )} && !document.body.innerText.includes('Processando…')`,
        );
      };
      const scroll = () =>
        execute(
          "void (document.querySelector('main').scrollTop = document.querySelector('main').scrollHeight)",
        );
      try {
        await wait(
          "document.querySelector('nav') !== null && !document.body.innerText.includes('Processando…')",
        );
        await execute(
          "Array.from(document.querySelectorAll('nav button')).find(button => button.textContent === 'Fontes').click()",
        );
        await execute(
          "Array.from(document.querySelectorAll('.source-mode-tabs button')).find(button => button.textContent.trim() === 'Gerenciar fontes').click()",
        );
        await execute(
          "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Abrir').click()",
        );
        await wait("document.querySelectorAll('.book').length === 30");
        const edgeWheel = await execute(
          "(()=>{const main=document.querySelector('main');main.scrollTop=0;const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:240});document.querySelector('aside').dispatchEvent(e);return {top:main.scrollTop,prevented:e.defaultPrevented}})()",
        );
        assert.ok(edgeWheel.top > 0, 'wheel over the side must scroll source novels');
        assert.equal(edgeWheel.prevented, true);
        const innerWheel = await execute(
          "(()=>{const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120});document.querySelector('main').dispatchEvent(e);return e.defaultPrevented})()",
        );
        assert.equal(innerWheel, false, 'wheel inside the list preserves native scrolling');
        await search('alpha');
        await execute('document.fonts.ready.then(() => true)');
        await scroll();
        await wait("document.querySelector('.spinner') !== null");
        const position = await execute(
          "document.querySelector('main').scrollTop",
        );
        await wait(
          "document.querySelectorAll('.book').length === 60 && !document.querySelector('.spinner')",
        );
        assert.equal(
          requests.get('alpha:2'),
          1,
          'Must request each page only once',
        );
        assert.equal(
          await execute("document.querySelector('main').scrollTop"),
          position,
          'Appending must preserve scroll position',
        );
        assert.equal(
          await execute(
            "new Set(Array.from(document.querySelectorAll('.book strong')).map(element => element.textContent)).size",
          ),
          60,
          'Duplicate paths must be removed',
        );
        await scroll();
        await wait("document.body.innerText.includes('Tentar novamente')");
        assert.equal(
          await execute("document.querySelectorAll('.book').length"),
          60,
        );
        await new Promise(resolve => setTimeout(resolve, 400));
        assert.equal(
          requests.get('alpha:3'),
          1,
          'Must not automatically loop on failed pages',
        );
        await execute(
          "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Tentar novamente').click()",
        );
        await wait(
          "document.body.innerText.includes('Você chegou ao fim dos resultados.')",
        );
        assert.equal(
          requests.get('alpha:3'),
          2,
          'Retry must request the failed page again',
        );
        assert.equal(
          requests.has('alpha:4'),
          false,
          'Must stop at an empty page',
        );
        await search('slow');
        await scroll();
        await wait("document.querySelector('.spinner') !== null");
        await search('beta');
        await new Promise(resolve => setTimeout(resolve, 1000));
        assert.equal(
          await execute("document.querySelectorAll('.book').length"),
          30,
          'Old search pages must not leak into a new search',
        );
        assert.equal(
          await execute(
            "Array.from(document.querySelectorAll('.book strong')).every(element => element.textContent.startsWith('beta novel'))",
          ),
          true,
        );
        assert.equal(
          await execute("document.querySelector('main').scrollTop"),
          0,
          'New searches start at the top',
        );
        await search('first-error', true);
        assert.equal(
          await execute("document.querySelectorAll('.book').length"),
          0,
          'A failed first page must clear previous results',
        );
        await execute(
          "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Tentar novamente').click()",
        );
        await wait(
          "document.querySelector('.book strong')?.textContent === 'first-error novel 1'",
        );
        assert.equal(requests.get('first-error:1'), 2);
        await execute(
          "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Recentes').click()",
        );
        await wait(
          "document.querySelector('.book strong')?.textContent === 'latest novel 1'",
        );
        await execute(
          "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Populares').click()",
        );
        await wait(
          "document.querySelector('.book strong')?.textContent === 'popular novel 1'",
        );
        await execute(
          "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Filtros da fonte').click()",
        );
        await execute(
          "(() => {const select=document.querySelector('.source-filters select'); select.value='filtered'; select.dispatchEvent(new Event('change',{bubbles:true}));})()",
        );
        await execute(
          "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Aplicar filtros').click()",
        );
        await wait(
          "document.querySelector('.book strong')?.textContent === 'filtered novel 1'",
        );
        console.log(
          'PASS: infinite search scrolling, spinner, append without jumping, duplicate removal, retry, end of results and stale-search isolation.',
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
