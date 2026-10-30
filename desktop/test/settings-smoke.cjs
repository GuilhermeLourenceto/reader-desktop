const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-settings-'));
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const originalTime = '2026-10-28T01:00:00Z';
const state = {
  ...emptyState(),
  novels: [
    {
      id: 1,
      pluginId: 'local',
      name: 'Livro de demonstração',
      path: '/book',
      inLibrary: true,
      chapters: [
        {
          id: 11,
          novelId: 1,
          path: '/chapter',
          name: 'Capítulo de demonstração',
          releaseTime: '2026-10-01',
          unread: true,
          progress: 40,
          readTime: originalTime,
          isDownloaded: true,
        },
      ],
    },
    {
      id: 2,
      pluginId: 'local',
      name: 'Livro sem download',
      path: '/remote',
      inLibrary: true,
      chapters: [],
    },
  ],
};
state.files['Novels/local/1/11/index.html'] = Buffer.from(
  '<p>Uma nova história começa a cada página. Texto para conferir o conforto da leitura e as preferências do aplicativo.</p>'.repeat(
    70,
  ),
).toString('base64');
fs.writeFileSync(path.join(directory, 'library.json'), JSON.stringify(state));
const timeout = setTimeout(() => {
  console.error('Settings test timed out');
  app.exit(1);
}, 45000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const execute = code => win.webContents.executeJavaScript(code, true);
    const wait = async code => {
      for (let i = 0; i < 200; i++) {
        if (await execute(code)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error(
        `Timeout: ${code}; ${await execute(
          'document.body.innerText.slice(-800)',
        )}`,
      );
    };
    const click = title =>
      execute(
        `Array.from(document.querySelectorAll('button')).find(button=>(button.getAttribute('aria-label')||button.textContent)===${JSON.stringify(
          title,
        )}).click()`,
      );
    const select = async (title, value) => {
      await execute(
        `(()=>{const input=document.querySelector('select[aria-label='+${JSON.stringify(
          JSON.stringify(title),
        )}+']');input.value=${JSON.stringify(
          value,
        )};input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
      );
    };
    const range = async (title, value) => {
      await execute(
        `(()=>{const input=document.querySelector('input[aria-label='+${JSON.stringify(
          JSON.stringify(title),
        )}+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(
          String(value),
        )});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
    };
    const capture = async name => {
      await execute('document.fonts.ready.then(()=>true)');
      await new Promise(resolve => setTimeout(resolve, 150));
      const bitmap = await win.webContents.capturePage();
      fs.mkdirSync(path.join(__dirname, '../docs/previews'), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(__dirname, '../docs/previews', name + '.png'),
        bitmap.toPNG(),
      );
      assert.equal(
        await execute('document.documentElement.scrollWidth<=innerWidth'),
        true,
      );
    };
    try {
      await wait(
        "document.querySelectorAll('.book').length===2 && !document.body.innerText.includes('Processando…')",
      );
      await click('Mais');
      await wait("document.querySelector('[data-settings-page=more]')!==null");
      await capture('preview-more');
      await click('Configurações');
      await capture('preview-settings');
      await click('Aparência');
      await select('Tema do aplicativo', 'light');
      assert.equal(
        await execute('document.documentElement.style.colorScheme'),
        'light',
      );
      await select('Tema do aplicativo', 'dark');
      await click('Voltar nas configurações');
      await execute(
        "document.querySelector('.setting-link[aria-label=Biblioteca]').click()",
      );
      await select('Tamanho das capas', 'large');
      await click('Mostrar contadores nas capas');
      await click('Mostrar quantidade de capítulos');
      await click('Voltar nas configurações');
      await click('Leitor');
      assert.deepEqual(
        await execute(`(()=>{const el=document.querySelector('input[aria-label="Avanço por página (rolagem)"]');return [el.value,el.min,el.max]})()`),
        ['50', '0', '100'],
      );
      await range('Avanço por página (rolagem)', 50);
      await select('Fonte de leitura', 'sans');
      await range('Tamanho da fonte', 28);
      await range('Espaçamento entre linhas', 2.1);
      await range('Largura do texto', 920);
      await select('Alinhamento do texto', 'justify');
      assert.equal(
        await execute(
          "document.querySelectorAll('.reader-theme-swatches button').length",
        ),
        9,
      );
      for (const [id, color] of [
        ['original-light', 'rgb(245, 245, 250)'],
        ['original-sepia', 'rgb(247, 223, 198)'],
        ['original-green', 'rgb(220, 229, 226)'],
        ['original-dark', 'rgb(41, 40, 50)'],
        ['amoled', 'rgb(0, 0, 0)'],
      ]) {
        await select('Fundo da leitura', id);
        assert.equal(
          await execute(
            "getComputedStyle(document.querySelector('.reader-preview-frame')).backgroundColor",
          ),
          color,
        );
      }
      await select('Fundo da leitura', 'sepia');
      win.setSize(800, 700);
      await capture('preview-reader-settings');
      win.setSize(1280, 850);
      await click('Voltar nas configurações');
      await click('Geral');
      await click('Modo anônimo');
      await click('Somente baixados');
      await wait(
        'window.desktop.load().then(state=>state.settings.desktopIncognito===true && state.settings.desktopFontSize===28)',
      );
      await new Promise(resolve => {
        win.webContents.once('did-finish-load', resolve);
        win.webContents.reload();
      });
      await wait(
        "document.querySelectorAll('.book').length===1 && !document.body.innerText.includes('Processando…')",
      );
      assert.equal(
        await execute("document.querySelectorAll('.badges').length"),
        0,
      );
      assert.equal(
        await execute(
          "document.querySelector('.grid').style.gridTemplateColumns.includes('185px')",
        ),
        true,
      );
      await execute("document.querySelector('.book').click()");
      await click('Continuar leitura');
      await wait(
        "document.querySelector('article')!==null && !document.body.innerText.includes('Processando…')",
      );
      const style = await execute(
        "(()=>{const element=document.querySelector('article'),style=getComputedStyle(element);return {size:style.fontSize,font:style.fontFamily,align:style.textAlign,width:style.maxWidth,line:style.lineHeight,color:style.color};})()",
      );
      assert.equal(style.size, '28px');
      assert.ok(style.font.includes('Noto Sans'));
      assert.equal(style.align, 'justify');
      assert.equal(style.width, '920px');
      assert.ok(Math.abs(parseFloat(style.line) - 58.8) < 0.1);
      assert.equal(style.color, 'rgb(75, 62, 45)');
      assert.match(
        await execute(
          "document.querySelector('.reader-chapter-position').textContent",
        ),
        /Capítulo 1 de 1.*01\/10\/2026/,
      );
      await click('Ajustes de leitura');
      await select('Fundo da leitura', 'amoled');
      assert.equal(
        await execute(
          "getComputedStyle(document.querySelector('.reader-view')).backgroundColor",
        ),
        'rgb(0, 0, 0)',
      );
      await execute(
        "void(document.querySelector('.reader-scroll').scrollTop=document.querySelector('.reader-scroll').scrollHeight)",
      );
      await new Promise(resolve => setTimeout(resolve, 500));
      const chapter = (await execute('window.desktop.load()')).novels[0]
        .chapters[0];
      assert.equal(chapter.progress, 40);
      assert.equal(chapter.readTime, originalTime);
      assert.equal(chapter.unread, true);
      // Restoring preferences must not erase the library or reading history.
      await execute(
        "Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.trim() === 'Mais').click()",
      );
      await wait("document.querySelector('[data-settings-page=more]')!==null");
      await click('Configurações');
      await execute('void(window.confirm = () => false)');
      await click('Restaurar configurações padrão');
      assert.equal(
        await execute('window.desktop.load().then(s=>s.settings.desktopFontSize)'),
        28,
      );
      await execute('void(window.confirm = () => true)');
      await click('Restaurar configurações padrão');
      await wait(
        "window.desktop.load().then(s=>s.settings.desktopFontSize===21 && s.settings.desktopPageStep===50 && s.settings.desktopIncognito===false && s.settings.desktopTheme==='dark')",
      );
      const afterReset = await execute("window.desktop.load().then(s=>({novelCount:s.novels.length,progress:s.novels[0].chapters[0].progress,settings:s.settings}))");
      assert.equal(afterReset.novelCount, 2);
      assert.equal(afterReset.progress, 40);
      assert.equal(afterReset.settings.desktopReaderWidth, 820);
      assert.equal(afterReset.settings.desktopShowBadges, true);
      await new Promise(resolve => {
        win.webContents.once('did-finish-load', resolve);
        win.webContents.reload();
      });
      await wait(
        "window.desktop.load().then(s=>s.settings.desktopFontSize===21 && s.settings.desktopPageStep===50 && s.novels.length===2)",
      );
      console.log(
        'PASS: original-style settings navigation, light/dark themes, saved preferences after reload, library controls, reader typography/colors and incognito history/progress protection.',
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
