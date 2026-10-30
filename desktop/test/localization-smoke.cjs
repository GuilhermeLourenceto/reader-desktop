const { app } = require('electron');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const { languages, t } = require('../src/i18n.cjs');
const directory = fs.mkdtempSync(path.join(__dirname, '../.tmp/localization-'));
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const state = {
  ...emptyState(),
  novels: [
    {
      id: 1,
      pluginId: 'local',
      name: 'Biblioteca',
      path: '/novel',
      inLibrary: true,
      chapters: [],
    },
  ],
  plugins: [
    {
      id: 'pt',
      name: 'Fonte PT',
      lang: 'pt',
      url: 'https://example.test/pt.js',
    },
    {
      id: 'en',
      name: 'Source EN',
      lang: 'en',
      url: 'https://example.test/en.js',
    },
  ],
};
fs.writeFileSync(path.join(directory, 'library.json'), JSON.stringify(state));
const timer = setTimeout(() => app.exit(1), 90000);
let once = false;
app.on('browser-window-created', (_, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.on('did-finish-load', async () => {
    if (once) return;
    once = true;
    const js = (s) => win.webContents.executeJavaScript(s, true);
    const wait = async (s) => {
      for (let i = 0; i < 300; i++) {
        if (await js(`Promise.resolve(${s}).then(Boolean)`)) return;
        await new Promise((r) => setTimeout(r, 40));
      }
      throw Error('Timeout ' + s);
    };
    const click = (text) =>
      js(
        `Array.from(document.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')||b.textContent.trim())===${JSON.stringify(text)}).click()`,
      );
    try {
      await wait(
        "document.querySelector('.book') && !document.querySelector('.busy')",
      );
      await click('Mais');
      await click('Configurações');
      await click('Geral');
      for (let i = 0; i < languages.length; i++) {
        const [code] = languages[i];

        await js(
          `(()=>{const s=Array.from(document.querySelectorAll('select')).find(s=>s.options.length===10);s.value=${JSON.stringify(code)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`,
        );
        await wait(`document.documentElement.lang===${JSON.stringify(code)}`);
        assert.equal(
          await js('document.documentElement.scrollWidth<=innerWidth'),
          true,
        );
        assert.ok(
          await js(
            `document.body.innerText.includes(${JSON.stringify(t('Privacidade e navegação', code))})`,
          ),
        );
      }
      await click(t('Biblioteca', 'zh-CN'));
      await wait("document.querySelector('.book')");
      assert.equal(
        await js("document.querySelector('.book strong').textContent"),
        'Biblioteca',
      );
      await click(t('Fontes', 'zh-CN'));
      await wait("document.querySelector('#global-source-language')");
      await js(
        "(()=>{const s=document.querySelector('#global-source-language');s.value='en';s.dispatchEvent(new Event('change',{bubbles:true}));})()",
      );
      await wait(
        "document.querySelector('.global-search') || document.querySelector('form')",
      );
      await wait(
        'document.body.innerText.includes(' +
          JSON.stringify(t('Buscar em {count} fontes', { count: 1 }, 'zh-CN')) +
          ')',
      );
      await js(
        "(()=>{const s=document.querySelector('#global-source-language');s.value='all';s.dispatchEvent(new Event('change',{bubbles:true}));})()",
      );
      await wait(
        'document.body.innerText.includes(' +
          JSON.stringify(t('Buscar em {count} fontes', { count: 2 }, 'zh-CN')) +
          ')',
      );
      await click(t('Gerenciar fontes', 'zh-CN'));
      await wait("document.querySelector('#source-language')");
      await js(
        "(()=>{const s=document.querySelector('#source-language');s.value='en';s.dispatchEvent(new Event('change',{bubbles:true}));})()",
      );
      await wait(
        "Array.from(document.querySelectorAll('.source strong')).some(e=>e.textContent==='Source EN') && !Array.from(document.querySelectorAll('.source strong')).some(e=>e.textContent==='Fonte PT')",
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
      fs.writeFileSync(
        path.join(directory, 'sources-zh.png'),
        (await win.webContents.capturePage()).toPNG(),
      );
      console.log('Screenshot: ' + path.join(directory, 'sources-zh.png'));
      await wait(
        "window.desktop.load({metadataOnly:true}).then(s=>s.settings.desktopInterfaceLanguage==='zh-CN')",
      );
      win.webContents.reload();
      await wait(
        "document.documentElement.lang==='zh-CN' && document.querySelector('.book') && !document.querySelector('.busy')",
      );
      assert.equal(
        await js("document.querySelector('.book strong').textContent"),
        'Biblioteca',
      );
      console.log(
        'PASS: ten interface languages, live switching, saved preference, source language filter, no horizontal overflow, novel title unchanged.',
      );
      clearTimeout(timer);
      win.destroy();
      app.exit(0);
    } catch (e) {
      console.error(e);
      console.error(await js('document.body.innerText'));
      clearTimeout(timer);
      win.destroy();
      app.exit(1);
    }
  });
});
require(
  process.argv.includes('--packaged')
    ? '../release/win-unpacked/resources/app.asar/dist/main.cjs'
    : '../dist/main.cjs',
);
