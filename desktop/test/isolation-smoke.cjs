const { app } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-isolation-'));
app.setPath('userData', root);
app.commandLine.appendSwitch('disable-gpu');
const plugin = {
  id: 'retry',
  name: 'Retry',
  url: 'https://example.test/source.js',
  site: 'https://example.test',
  version: '1',
  lang: 'pt',
};
const state = {
  ...emptyState(),
    // These older UI journeys intentionally assert Portuguese labels.
    settings: { desktopInterfaceLanguage: 'pt-BR' },
  plugins: [plugin],
  novels: [
    {
      id: 1,
      pluginId: 'retry',
      name: 'Isolated source',
      path: '/book',
      inLibrary: true,
      chapters: [
        { id: 1, novelId: 1, name: 'Chapter', path: '/chapter', unread: true },
      ],
    },
  ],
};
state.files['Plugins/retry/index.js'] = Buffer.from(
  `const {storage}=require('@libs/storage'); const attempt=(storage.get('attempt')||0)+1; storage.set('attempt',attempt); if(attempt===1)throw new Error('source-first-failure');exports.default={...${JSON.stringify(
    plugin,
  )},parseChapter:async()=>'<p>'+new Function('return "isolated-retry-success"')()+'</p>'};`,
).toString('base64');
fs.writeFileSync(path.join(root, 'library.json'), JSON.stringify(state));
const timeout = setTimeout(() => app.exit(1), 30000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    const execute = code => win.webContents.executeJavaScript(code, true);
    const wait = async code => {
      for (let i = 0; i < 300; i++) {
        if (await execute(code)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error('Timeout: ' + code);
    };
    try {
      await wait(
        "document.querySelector('.book') && !document.querySelector('.busy')",
      );
      assert.equal(
        await execute(
          '(()=>{try{new Function("return 1")();return false;}catch(error){return error.name==="EvalError";}})()',
        ),
        true,
      );
      await execute("document.querySelector('.book').click()");
      await wait(
        "document.querySelector('.chapter-open') && !document.querySelector('.busy')",
      );
      await execute("document.querySelector('.chapter-open').click()");
      await wait(
        "document.querySelector('.reader-error') && !document.querySelector('.busy')",
      );
      await execute(
        "Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Tentar capítulo novamente').click()",
      );
      await wait(
        "document.querySelector('article')?.textContent.includes('isolated-retry-success') && !document.querySelector('.busy')",
      );
      assert.equal(
        await execute(
          "JSON.parse(localStorage.getItem('plugin_db:retry_DB_attempt')).value",
        ),
        2,
      );
      const policy = (
        await require('electron').net.fetch('lnreader://app/plugin-worker.js')
      ).headers.get('Content-Security-Policy');
      assert.ok(policy.includes("connect-src 'none'"));
      assert.ok(policy.includes("worker-src 'none'"));
      console.log(
        'PASS: renderer forbids dynamic evaluation; source worker still runs original plugin SDK; first source load failure can be retried; worker policy blocks direct network and nested workers.',
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
