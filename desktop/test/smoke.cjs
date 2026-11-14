// Run with Electron. A local fixture exercises the real source loader and UI.
const { app, BrowserWindow, dialog } = require('electron');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const dataPath = fs.mkdtempSync(
  path.join(require('node:os').tmpdir(), 'lnreader-smoke-'),
);
const backupPath = path.join(dataPath, 'round-trip.zip');
dialog.showSaveDialog = async () => ({ canceled: false, filePath: backupPath });
dialog.showOpenDialog = async () => ({
  canceled: false,
  filePaths: [backupPath],
});
dialog.showMessageBox = async () => ({ response: 1 });
app.setPath('userData', dataPath);
// The legacy Portuguese UI journey uses an explicit locale fixture. A
// separate fresh-profile smoke verifies the product's English default.
const { emptyState } = require('../dist/backup.cjs');
fs.writeFileSync(path.join(dataPath, 'library.json'), JSON.stringify({
  ...emptyState(), settings: { desktopInterfaceLanguage: 'pt-BR' },
}));
app.commandLine.appendSwitch('disable-gpu');
const server = http.createServer((req, res) => {
  if (req.url === '/redirect') {
    res.writeHead(302, { Location: '/endpoint' });
    res.end();
    return;
  }
  if (req.url === '/endpoint') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          method: req.method,
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      );
    });
    return;
  }
  res.setHeader(
    'Content-Type',
    req.url === '/index.json' ? 'application/json' : 'text/javascript',
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  const plugin = {
    id: 'desktop-test',
    name: 'Desktop fixture',
    site: base,
    lang: 'en',
    version: '1.0.0',
    url: `${base}/plugin.js`,
    iconUrl: '',
  };
  if (req.url === '/index.json') res.end(JSON.stringify([plugin]));
  else
    res.end(`const { load } = require('cheerio'); const { storage } = require('@libs/storage'); const { fetchApi } = require('@libs/fetch'); exports.default = {
    ...${JSON.stringify(plugin)},
    filters: {order: {type:'Picker', label:'Order', value:'popular', options:[]}},
    popularNovels: async (page, {filters, showLatestNovels}) => {
      if (page !== 1 || filters.order.value !== 'popular' || showLatestNovels !== false) throw new Error('Desktop must pass the original popularNovels options contract');
      const redirected = await fetchApi(${JSON.stringify(base + '/redirect')});
      if (redirected.url !== ${JSON.stringify(
        base + '/endpoint',
      )} || !redirected.redirected || !redirected.ok) throw new Error('Final response URL must survive HTTP redirects');
      const posted = await fetchApi(${JSON.stringify(
        base + '/endpoint',
      )}, {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({message:'olá'})});
      const echo = await posted.json();
      if (echo.method !== 'POST' || JSON.parse(echo.body).message !== 'olá') throw new Error('HTTP method and UTF-8 request body must survive the desktop bridge');
      return [{name:'Smoke novel',path:'/novel'}];
    },
    searchNovels: async () => [{name:'Smoke novel',path:'/novel'}],
    parseNovel: async () => ({name: 'Smoke novel', path:'/novel', chapters:[{name:'Smoke chapter',path:'/chapter'}]}),
    parseChapter: async () => {storage.set('visited', true); return '<p>' + load('<b>Offline works</b>')('b').text() + '</p><script>window.bad=true</script>';}
  };`);
});
let failed = false;
const timeout = setTimeout(() => {
  console.error('Smoke timed out');
  app.exit(1);
}, 45000);
server.listen(0, '127.0.0.1', () => {
  app.on('browser-window-created', (_event, win) => {
    win.webContents.setBackgroundThrottling(false);
    win.hide();
    win.webContents.on('preload-error', (_event, _file, error) => {
      console.error(error);
      failed = true;
    });
    win.webContents.on('did-finish-load', async () => {
      const execute = code => win.webContents.executeJavaScript(code, true);
      const wait = async code => {
        for (let i = 0; i < 150; i++) {
          if (await execute(code)) return;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(
          `Timed out: ${code}; UI: ${await execute('document.body.innerText')}`,
        );
      };
      const click = text =>
        execute(
          `Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('aria-label') || b.textContent) === ${JSON.stringify(
            text,
          )}).click()`,
        );
      try {
        await wait(
          "document.body.innerText.includes('Biblioteca') && !document.body.innerText.includes('Processando…')",
        );
        await click('Fontes');
        await click('Gerenciar fontes');
        const url = `http://127.0.0.1:${server.address().port}/index.json`;
        await execute(
          `(() => { const input=document.querySelector('input[type=url]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input, ${JSON.stringify(
            url,
          )}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
        );
        await execute("document.querySelector('form').requestSubmit()");
        await wait(
          "document.body.innerText.includes('Desktop fixture') && !document.body.innerText.includes('Processando…')",
        );
        await click('Instalar');
        await wait(
          "Array.from(document.querySelectorAll('button')).some(b => b.textContent === 'Abrir' && !b.disabled)",
        );
        await click('Abrir');
        await wait(
          "document.body.innerText.includes('Smoke novel') && !document.body.innerText.includes('Processando…')",
        );
        await execute("document.querySelector('.book').click()");
        await wait(
          "document.body.innerText.includes('Smoke chapter') && !document.body.innerText.includes('Processando…')",
        );
        await click('Adicionar à biblioteca');
        await click('Continuar leitura');
        await wait(
          "document.querySelector('article')?.innerText.includes('Offline works')",
        );
        assert.equal(await execute('window.bad'), undefined);
        assert.equal(
          await execute("document.querySelector('article script') !== null"),
          false,
        );
        await wait(
          'window.desktop.load().then(state => state.novels[0]?.chapters[0]?.unread === false)',
        );
        let saved = JSON.parse(
          fs.readFileSync(path.join(dataPath, 'library.json')),
        );
        assert.equal(saved.novels[0].chapters[0].unread, false);
        assert.equal(saved.plugins[0].id, 'desktop-test');
        assert.ok(saved.files['Plugins/desktop-test/index.js']);
        assert.ok(
          Object.keys(saved.files).some(name => name.endsWith('/index.html')),
        );
        await click('Voltar aos capítulos');
        await execute(
          "void (window.fetch = async () => { throw new Error('Offline'); })",
        );
        await click('Continuar leitura');
        await wait(
          "document.querySelector('article')?.innerText.includes('Offline works')",
        );
        await click('Mais');
        await click('Backups');
        await click('Exportar backup');
        await wait("document.body.innerText.includes('Backup exportado.')");
        const { parseBackup } = require('../dist/backup.cjs');
        assert.equal(
          parseBackup(fs.readFileSync(backupPath)).state.novels[0].chapters[0]
            .unread,
          false,
        );
        await click('Restaurar backup');
        await wait(
          "document.body.innerText.includes('Backup restaurado.') && !document.body.innerText.includes('Processando…')",
        );
        // Importing an identical archive must not replace a useful recovery
        // snapshot or create a redundant before-restore.json.
        assert.equal(
          fs.existsSync(path.join(dataPath, 'before-restore.json')),
          false,
        );
        // A no-op restore intentionally keeps the current Settings page.
        await click('Biblioteca');
        await wait("document.querySelector('.book') !== null");
        await execute("document.querySelector('.book').click()");
        await click('Continuar leitura');
        await wait(
          "document.querySelector('article')?.innerText.includes('Offline works')",
        );
        console.log(
          'PASS: source installation, original plugin runtime, library, reader, sanitization, persistence, offline reading, backup export and restore.',
        );
      } catch (error) {
        failed = true;
        console.error(error);
      } finally {
        clearTimeout(timeout);
        server.close();
        for (const window of BrowserWindow.getAllWindows()) window.destroy();
        app.exit(failed ? 1 : 0);
      }
    });
  });
  require('../dist/main.cjs');
});
