const { app } = require('electron');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const { languages, t } = require('../src/i18n.cjs');
const tmpDir = path.join(__dirname, '../.tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const directory = fs.mkdtempSync(path.join(tmpDir, 'localization-'));
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
  categories: [
    { id: 1, name: 'Padrão', novelIds: [1] },
    { id: 2, name: 'Localização', novelIds: [] },
    { id: 3, name: 'Minha categoria', novelIds: [] },
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
const timer = setTimeout(() => {
  console.error('LOCALIZATION HARD TIMEOUT: no completion in 180s');
  process.exit(1);
}, 180000);
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
        console.log('LOCALE SWITCH:', code);

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
        // Theme names are read from JS metadata; verify they translate live
        // rather than keeping the original Portuguese labels.
        console.log('LOCALE APPEARANCE:', code);
        await click(t('Voltar nas configurações', code));
        await click(t('Aparência', code));
        await wait("document.querySelectorAll('.palette-swatch').length===9");
        assert.equal(
          await js("Array.from(document.querySelectorAll('select option[value=system]'))[0]?.textContent.trim()"),
          t('Seguir tema do sistema', code),
        );
        assert.equal(
          await js("document.querySelector('.palette-swatch:nth-child(2)').getAttribute('title')"),
          t('Crepúsculo', code),
        );
        assert.ok(
          await js(`Array.from(document.querySelectorAll('.palette-swatch')).some(b=>b.textContent.trim()===${JSON.stringify(t('Morango', code))})`),
          'Palette names must be translated in ' + code,
        );
        console.log('LOCALE READER:', code);
        await click(t('Voltar nas configurações', code));
        await click(t('Leitor', code));
        await wait("document.querySelector('.reader-theme-picker select')");
        assert.equal(
          await js("document.querySelector('.reader-theme-picker option[value=app]').textContent.trim()"),
          t('Seguir aplicativo', code),
        );
        assert.equal(
          await js("document.querySelector('.reader-theme-picker option[value=original-sepia]').textContent.trim()"),
          t('Sépia original', code),
        );
        assert.equal(
          await js("document.querySelector('.reader-theme-swatches button[title]').getAttribute('title')"),
          t('Seguir aplicativo', code),
        );
        await click(t('Voltar nas configurações', code));
        await click(t('Geral', code));
        // Exercise the REAL library controls in EACH of the 10 languages,
        // not only static dictionary entries or the final Chinese locale.
        await click(t('Biblioteca', code));
        await wait("document.querySelector('.book')");
        await click(t('Filtrar biblioteca', code));
        await wait("document.querySelector('#library-category') && document.querySelector('#library-sort')");
        assert.equal(
          await js("document.querySelector('label[for=library-category]').textContent.trim()"),
          t('Categoria', code),
        );
        assert.equal(
          await js("document.querySelector('#library-category').getAttribute('aria-label')"),
          t('Categoria da biblioteca', code),
        );
        assert.equal(
          await js("document.querySelector('#library-sort').getAttribute('aria-label')"),
          t('Ordenar biblioteca', code),
        );
        assert.deepEqual(
          await js("Array.from(document.querySelectorAll('.library-status-options button')).map(e=>e.textContent.trim())"),
          ['Todas', 'Não lidas', 'Baixadas'].map(key => t(key, code)),
        );
        assert.deepEqual(
          await js("Array.from(document.querySelector('#library-sort').options).map(e=>e.textContent.trim())"),
          ['Ordem original', 'Nome (A–Z)', 'Nome (Z–A)', 'Mais capítulos'].map(key => t(key, code)),
        );
        const stockNames = await js("Array.from(document.querySelector('#library-category').options).map(e=>e.textContent.trim())");
        assert.ok(stockNames.some(v => v.includes(t('Padrão', code))));
        assert.ok(stockNames.some(v => v.includes(t('Localização', code))));
        assert.ok(stockNames.some(v => v.includes('Minha categoria')));
        await js("(()=>{const s=document.querySelector('#library-category');s.value='3';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
        await wait("document.querySelectorAll('.book').length===0");
        await js("(()=>{const s=document.querySelector('#library-category');s.value='';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
        await wait("document.querySelectorAll('.book').length===1");
        await click(t('Filtrar biblioteca', code));
        await js("document.querySelector('.book-card').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:200,clientY:180}))");
        await wait("document.querySelector('[role=menu]')");
        const menuLabels = await js("Array.from(document.querySelector('[role=menu]').querySelectorAll('button')).map(e=>e.textContent.trim())");
        for (const key of ['Abrir obra', 'Selecionar obra', 'Baixar capítulos pendentes', 'Resetar leitura da obra', 'Remover da biblioteca'])
          assert.ok(menuLabels.includes(t(key, code)), 'Missing menu translation: ' + key + ' @ ' + code);
        await click(t('Selecionar obra', code));
        await wait("document.querySelector('.library-selection').dataset.selectedCount==='1'");
        await js("document.querySelector('.book-card').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:200,clientY:180}))");
        await wait("document.querySelector('[role=menu]')");
        assert.ok((await js("document.querySelector('[role=menu]').textContent")).includes(t('Desmarcar obra', code)));
        await click(t('Desmarcar obra', code));
        await wait("document.querySelector('.library-selection').dataset.selectedCount==='0'");
        await click(t('Mais', code));
        await click(t('Configurações', code));
        await click(t('Geral', code));
        console.log('LOCALE LIBRARY/MENU OK:', code);
      }
      await click(t('Biblioteca', 'zh-CN'));
      await wait("document.querySelector('.book')");
      assert.equal(
        await js("document.querySelector('.book strong').textContent"),
        'Biblioteca',
      );
      // Category names are stored in the original backup language. The
      // unified desktop filter translates only stock categories and labels.
      assert.equal(await js("document.querySelector('.category-tabs')===null"), true);
      await click(t('Filtrar biblioteca', 'zh-CN'));
      await wait("document.querySelector('#library-category')");
      const categoryOptions = await js(
        "Array.from(document.querySelector('#library-category').options).map(e=>e.textContent.trim())",
      );
      assert.ok(categoryOptions.some(x => x.includes(t('Padrão', 'zh-CN'))));
      assert.ok(categoryOptions.some(x => x.includes(t('Localização', 'zh-CN'))));
      assert.ok(categoryOptions.some(x => x.includes('Minha categoria')));
      assert.ok(!categoryOptions.some(x => x.includes('Localização')));
      assert.equal(
        await js("document.querySelector('.library-filter-label').textContent.trim()"),
        t('Estado', 'zh-CN'),
      );
      assert.deepEqual(
        await js("Array.from(document.querySelectorAll('.library-status-options button')).map(e=>e.textContent.trim())"),
        ['Todas', 'Não lidas', 'Baixadas'].map(key => t(key, 'zh-CN')),
      );
      assert.equal(
        await js("document.querySelector('label[for=library-sort]').textContent.trim()"),
        t('Ordenar por', 'zh-CN'),
      );
      const sortOptions = await js(
        "Array.from(document.querySelector('#library-sort').options).map(e=>e.textContent.trim())",
      );
      assert.deepEqual(
        sortOptions,
        ['Ordem original', 'Nome (A–Z)', 'Nome (Z–A)', 'Mais capítulos']
          .map(key => t(key, 'zh-CN')),
      );
      await click(t('Filtrar biblioteca', 'zh-CN'));
      await js("document.querySelector('.book-card').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:300,clientY:300}))");
      await wait("document.querySelector('[role=menu]')");
      const contextLabels = await js(
        "Array.from(document.querySelector('[role=menu]').querySelectorAll('button')).map(e=>e.textContent.trim())",
      );
      for (const key of ['Abrir obra', 'Selecionar obra', 'Baixar capítulos pendentes', 'Resetar leitura da obra', 'Remover da biblioteca'])
        assert.ok(contextLabels.includes(t(key, 'zh-CN')), 'Missing translated context option: ' + key);
      await click(t('Selecionar obra', 'zh-CN'));
      assert.equal(
        await js("document.querySelector('.library-selection').dataset.selectedCount"),
        '1',
      );
      await js("document.querySelector('.book-card').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:300,clientY:300}))");
      await wait("document.querySelector('[role=menu]')");
      assert.ok(
        (await js("document.querySelector('[role=menu]').textContent"))
          .includes(t('Desmarcar obra', 'zh-CN')),
      );
      await click(t('Desmarcar obra', 'zh-CN'));

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
