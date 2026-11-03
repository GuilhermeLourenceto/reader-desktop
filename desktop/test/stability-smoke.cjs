const { app, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-stability-'));
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
let missingRequests = 0,
  restoreDialogs = 0;
dialog.showOpenDialog = async () => {
  restoreDialogs++;
  return { canceled: true };
};
const server = http.createServer((req, res) => {
  if (req.url === '/missing.js') {
    missingRequests++;
    res.writeHead(404);
    res.end();
    return;
  }
  if (req.url === '/slow') {
    const timer = setTimeout(
      () => res.end('<p>Downloaded text.</p>'.repeat(100)),
      2500,
    );
    res.on('close', () => clearTimeout(timer));
    return;
  }
  if (req.url === '/bad.json') {
    res.end('{"not":"an array"}');
    return;
  }
  if (req.url === '/failure.json') {
    res.writeHead(500);
    res.end('failed');
    return;
  }
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify([
      {
        id: 'new',
        name: 'New source',
        url: `http://127.0.0.1:${server.address().port}/new.js`,
        lang: 'en',
        version: '1',
      },
    ]),
  );
});
const timeout = setTimeout(() => {
  console.error('Stability smoke timed out');
  app.exit(1);
}, 45000);
server.listen(0, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const plugin = id => ({
    id,
    name: id.toUpperCase(),
    site: base,
    url: base + `/${id}.js`,
    lang: 'en',
    version: '1',
  });
  const state = {
    ...emptyState(),
  settings: { desktopInterfaceLanguage: 'pt-BR' },
    plugins: [
      plugin('a'),
      plugin('ab'),
      { ...plugin('missing'), url: base + '/missing.js' },
    ],
    repositories: [
      base + '/bad.json',
      base + '/good.json',
      base + '/failure.json',
    ],
    novels: [
      {
        id: 1,
        pluginId: 'a',
        path: '/book',
        name: 'Stability book',
        inLibrary: true,
        chapters: [
          { id: 1, novelId: 1, name: 'Chapter 1', path: '/slow', unread: true },
        ],
      },
    ],
    pluginStorage: {
      'plugin_db:a_DB_token': '{"value":"a"}',
      'plugin_db:ab_DB_token': '{"value":"keep"}',
    },
  };
  for (const id of ['a', 'ab'])
    state.files[`Plugins/${id}/index.js`] = Buffer.from(
      `const {fetchApi}=require('@libs/fetch');exports.default={...${JSON.stringify(
        plugin(id),
      )},parseChapter:async(path)=>(await fetchApi(${JSON.stringify(
        base,
      )}+path)).text(),parseNovel:async()=>({name:'Invalid',chapters:[]}),popularNovels:async()=>[{path:'/broken',name:{invalid:true}}]};`,
    ).toString('base64');
  fs.writeFileSync(path.join(directory, 'library.json'), JSON.stringify(state));
  app.on('browser-window-created', (_event, win) => {
    win.webContents.setBackgroundThrottling(false);
    win.webContents.once('did-finish-load', async () => {
      const execute = code => win.webContents.executeJavaScript(code, true);
      const wait = async code => {
        for (let index = 0; index < 220; index++) {
          if (await execute(code)) return;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(
          'Timeout: ' +
            code +
            '; ' +
            (await execute('document.body.innerText.slice(-1600)')),
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
        assert.equal(
          missingRequests,
          0,
          'startup must not wait on missing plugins or the network',
        );
        const disk = JSON.parse(
          fs.readFileSync(path.join(directory, 'library.json'), 'utf8'),
        );
        assert.ok(disk.files['Plugins/a/index.js'].startsWith('@file:'));
        assert.equal(
          await execute(
            `fetch(${JSON.stringify(
              base + '/head',
            )},{method:'HEAD'}).then(async response=>response.ok && (await response.text())==='')`,
          ),
          true,
        );
        assert.equal(
          await execute(
            `(async()=>{const controller=new AbortController();const result=fetch(${JSON.stringify(
              base + '/slow',
            )},{signal:controller.signal});setTimeout(()=>controller.abort(),30);try {await result;return false;}catch(error){return error.name==='AbortError';}})()`,
          ),
          true,
        );
        await execute("document.querySelector('.book').click()");
        await click('Baixar próximos 10');
        await wait(
          "document.querySelector('.download-progress') || document.body.innerText.includes('Baixando 1')",
        );
        await click('Mais');
        await click('Backups');
        await click('Restaurar backup');
        await wait(
          "document.querySelector('.notice')?.textContent.includes('fila de downloads')",
        );
        assert.equal(restoreDialogs, 0);
        await wait(
          'window.desktop.load().then(state=>state.novels[0].chapters[0].isDownloaded===true)',
        );
        await click('Fontes');
        await click('Gerenciar fontes');
        await click('Carregar repositórios');
        await wait(
          "document.body.innerText.includes('New source') && !document.querySelector('.busy')",
        );
        assert.equal(
          await execute("document.querySelectorAll('.source').length"),
          4,
        );
        await execute(
          "Array.from(document.querySelectorAll('.source')).find(row=>row.querySelector('strong').textContent==='A').querySelector('button').click()",
        );
        await wait(
          "document.querySelector('.pagination-status')?.textContent.includes('inválida') || document.body.innerText.includes('lista inválida')",
        );
        assert.equal(
          await execute("document.querySelectorAll('.book').length"),
          0,
        );
        await click('Fontes');
        // The login feature added an "Entrar" button between "Abrir" and
        // "Desinstalar". Select by the visible action, never by index.
        await execute(
          "(()=>{const row=Array.from(document.querySelectorAll('.source')).find(row=>row.querySelector('strong')?.textContent==='A');const button=Array.from(row?.querySelectorAll('button')||[]).find(item=>item.textContent.trim()==='Desinstalar');if(!button)throw new Error('Botão Desinstalar ausente');button.click();})()",
        );
        await wait(
          "window.desktop.load().then(state=>!state.plugins.some(plugin=>plugin.id==='a'))",
        );
        assert.equal(
          await execute("localStorage.getItem('plugin_db:ab_DB_token')"),
          '{"value":"keep"}',
        );
        assert.equal(
          await execute("localStorage.getItem('plugin_db:a_DB_token')"),
          null,
        );
        await wait(
          "window.desktop.load().then(state=>state.pluginStorage['plugin_db:ab_DB_token']!=null)",
        );
        win.once('closed', () => {
          const final = JSON.parse(
            fs.readFileSync(path.join(directory, 'library.json'), 'utf8'),
          );
          assert.equal(final.novels[0].chapters[0].isDownloaded, true);
          assert.ok(fs.existsSync(path.join(directory, 'library.json.bak')));
          console.log(
            'PASS: metadata-only migration, offline startup with missing source, real HTTP HEAD/cancellation, restore/download race blocked, malformed repositories isolated, malformed source rows contained, scoped uninstall storage and normal close handshake.',
          );
          clearTimeout(timeout);
          server.close();
          app.exit(0);
        });
        win.close();
      } catch (error) {
        console.error(error);
        clearTimeout(timeout);
        win.destroy();
        server.close();
        app.exit(1);
      }
    });
  });
  require('../dist/main.cjs');
});
