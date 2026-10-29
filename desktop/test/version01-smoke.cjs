const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-01-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');
const source = id => ({
  id,
  name: id === 'loop' ? 'Loop Source' : 'Fixture Source',
  site: 'https://example.test',
  lang: 'pt',
  version: '1.0.0',
  url: `https://example.test/${id}.js`,
});
const chapter = number => ({
  id: number,
  novelId: 1,
  name: `Capítulo ${number}`,
  path: `/c${number}`,
  page: '1',
  position: number - 1,
  unread: true,
  progress: 0,
});
const state = {
  ...emptyState(),
  plugins: [source('fixture'), source('loop')],
  novels: [
    {
      id: 1,
      pluginId: 'fixture',
      name: 'História para testar o leitor',
      path: '/book',
      inLibrary: true,
      totalPages: 2,
      desktopLoadedPages: [1],
      chapters: Array.from({ length: 250 }, (_, index) => chapter(index + 1)),
    },
  ],
};
state.files['Plugins/fixture/index.js'] = Buffer.from(
  `const {storage}=require('@libs/storage');exports.default={...${JSON.stringify(
    source('fixture'),
  )},parsePage:async()=>{const n=(storage.get('attempts')||0)+1;storage.set('attempts',n);if(n===1)throw new Error('Falha simulada de página');return {chapters:Array.from({length:10},(_,i)=>({name:'Capítulo '+(251+i),path:'/c'+(251+i)}))};},parseChapter:async()=>'<p>Texto</p>',parseNovel:async()=>({chapters:[]})};`,
).toString('base64');
state.files['Plugins/loop/index.js'] = Buffer.from(
  "const {storage}=require('@libs/storage');storage.set('entered',true);while(true){}",
).toString('base64');
state.files['Novels/fixture/1/1/index.html'] = Buffer.from(
  '<h2>Uma história de teste</h2>' +
    Array.from(
      { length: 100 },
      (_, index) =>
        `<p>${
          index + 1
        }. O caminho seguia entre as árvores, dobrando a cada descoberta. Nada parecia urgente: havia tempo para observar os detalhes e escolher a próxima direção.</p>`,
    ).join(''),
).toString('base64');
fs.writeFileSync(path.join(profile, 'library.json'), JSON.stringify(state));
if (process.argv.includes('--video-settings')) {
  state.settings = {
    desktopFontSize: 27,
    desktopLineHeight: 1.85,
    desktopReaderWidth: 820,
    desktopPageStep: 85,
  };
  fs.writeFileSync(path.join(profile, 'library.json'), JSON.stringify(state));
}
const timeout = setTimeout(() => {
  console.error('Version 0.1 test timed out');
  app.exit(1);
}, 90000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    const execute = code => win.webContents.executeJavaScript(code, true);
    const pause = milliseconds =>
      new Promise(resolve => setTimeout(resolve, milliseconds));
    const wait = async code => {
      for (let index = 0; index < 260; index++) {
        if (await execute(code)) return;
        await pause(50);
      }
      throw new Error(
        `Timeout: ${code}; ${await execute(
          'document.body.innerText.slice(-1600)',
        )}`,
      );
    };
    const click = label =>
      execute(
        `Array.from(document.querySelectorAll('button')).find(button=>(button.getAttribute('aria-label')||button.textContent.trim())===${JSON.stringify(
          label,
        )}).click()`,
      );
    const key = async name => {
      if (process.argv.includes('--native-keys')) {
        win.webContents.focus();
        const keyCode =
          {
            ArrowDown: 'Down',
            ArrowUp: 'Up',
            ArrowLeft: 'Left',
            ArrowRight: 'Right',
          }[name] || name;
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode });
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode });
        return;
      }
      return execute(
        `window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(
          name,
        )},bubbles:true,cancelable:true}))`,
      );
    };
    const select = (label, value) =>
      execute(
        `(()=>{const input=document.querySelector('select[aria-label="'+${JSON.stringify(
          label,
        )}+'"]');input.value=${JSON.stringify(
          value,
        )};input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
      );
    const capture = async name => {
      const directory = path.join(__dirname, '../docs/previews');
      fs.mkdirSync(directory, { recursive: true });
      await execute('document.fonts.ready.then(()=>true)');
      await pause(100);
      fs.writeFileSync(
        path.join(directory, name + '.png'),
        (await win.webContents.capturePage()).toPNG(),
      );
    };
    try {
      if (process.argv.includes('--animated')) {
        win.webContents.debugger.attach('1.3');
        await win.webContents.debugger.sendCommand(
          'Emulation.setEmulatedMedia',
          {
            features: [
              { name: 'prefers-reduced-motion', value: 'no-preference' },
            ],
          },
        );
      }
      await wait(
        "document.querySelector('.book') && !document.querySelector('.busy')",
      );
      assert.equal(
        (await execute('window.desktop.info()')).version,
        require('../package.json').version,
      );
      await execute("document.querySelector('.book').click()");
      await wait("document.querySelectorAll('.chapter-row').length===100");
      assert.equal(
        await execute(
          "document.querySelector('.chapter-ordinal').textContent.trim()",
        ),
        '1 de 250',
      );
      assert.equal(
        await execute(
          "document.body.innerText.includes('Mostrar mais capítulos')",
        ),
        false,
      );
      for (const count of [200, 250]) {
        await execute(
          "(()=>{const column=document.querySelector('.novel-chapters-column');column.scrollTop=column.scrollHeight;document.querySelector('.chapters-sentinel').scrollIntoView({block:'end'});})()",
        );
        await wait(
          `document.querySelectorAll('.chapter-row').length>=${count}`,
        );
      }
      await execute(
        "document.querySelector('.chapters-sentinel').scrollIntoView({block:'end'})",
      );
      await wait(
        "document.querySelector('.chapter-page-error')?.textContent.includes('Falha simulada')",
      );
      await pause(400);
      assert.equal(
        await execute(
          "JSON.parse(localStorage.getItem('plugin_db:fixture_DB_attempts')).value",
        ),
        1,
      );
      await click('Tentar carregar capítulos novamente');
      await wait("document.querySelectorAll('.chapter-row').length===260");
      assert.equal(
        await execute(
          "JSON.parse(localStorage.getItem('plugin_db:fixture_DB_attempts')).value",
        ),
        2,
      );
      await execute("document.querySelector('.chapter-open').click()");
      await wait(
        "document.querySelector('article') && document.querySelector('.reader-scroll').scrollHeight > document.querySelector('.reader-scroll').clientHeight * 2",
      );
      const size = await execute(
        "document.querySelector('.reader-scroll').clientHeight",
      );
      assert.equal(
        await execute("!!document.querySelector('.reader-view.chrome-hidden')"),
        true,
        'Reader must open with hidden toolbars',
      );
      await wait("document.querySelector('.reader-view.chrome-hidden')");
      assert.equal(
        await execute("document.querySelector('.reader-scroll').clientHeight"),
        size,
      );
      assert.equal(
        await execute(
          "Math.round(document.querySelector('.reader-view').getBoundingClientRect().height)",
        ),
        size,
      );
      await capture('version01-reader-hidden');
      await execute(
        "window.readerOriginalParagraph=document.querySelector('.reader-scroll article p')",
      );
      await execute(
        "(()=>{const el=document.querySelector('.reader-view');const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));})()",
      );
      await key('Escape');
      await pause(50);
      assert.equal(
        await execute("!!document.querySelector('.reader-view.chrome-hidden')"),
        true,
      );
      await execute(
        "document.querySelector('.reader-scroll').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))",
      );
      await pause(50);
      assert.equal(
        await execute("!!document.querySelector('.reader-view.chrome-hidden')"),
        false,
      );
      await wait("!!document.querySelector('.reader-view.chrome-hidden')");
      await execute(
        "document.querySelector('.reader-scroll').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))",
      );
      await pause(50);
      assert.equal(
        await execute("!!document.querySelector('.reader-view.chrome-hidden')"),
        false,
        'Click must reveal toolbars after automatic hiding',
      );
      await key('Escape');
      await pause(60);
      assert.equal(
        await execute("!!document.querySelector('.reader-view.chrome-hidden')"),
        true,
      );
      await key('ArrowDown');
      await pause(500);
      assert.equal(
        await execute("!!document.querySelector('.reader-view.chrome-hidden')"),
        true,
      );
      assert.ok(
        Math.abs(
          (await execute(
            "document.querySelector('.reader-scroll').scrollTop",
          )) -
            size * 0.85,
        ) < 4,
      );
      await click('Ajustes de leitura');
      await execute(
        "(()=>{const input=document.querySelector('input[aria-label=\"Avanço por página\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'50');input.dispatchEvent(new Event('input',{bubbles:true}));})()",
      );
      await click('Ajustes de leitura');
      await execute("document.querySelector('.reader-scroll').scrollTop=0");
      await pause(60);
      await key('ArrowDown');
      await pause(500);
      assert.ok(
        Math.abs(
          (await execute(
            "document.querySelector('.reader-scroll').scrollTop",
          )) -
            size * 0.5,
        ) < 4,
      );
      await execute(
        "for(let i=0;i<3;i++)window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))",
      );
      await pause(800);
      assert.ok(
        Math.abs(
          (await execute(
            "document.querySelector('.reader-scroll').scrollTop",
          )) -
            size * 2,
        ) < 4,
        'Rapid arrow taps must accumulate without losing distance',
      );
      assert.equal(
        await execute(
          "window.readerOriginalParagraph===document.querySelector('.reader-scroll article p') && window.readerOriginalParagraph.isConnected",
        ),
        true,
        'Updating reader progress must preserve the original chapter DOM nodes',
      );
      await execute(
        "(()=>{const el=document.querySelector('.reader-view');const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.left+20,clientY:r.top+4}));})()",
      );
      await pause(60);
      assert.equal(
        await execute("!!document.querySelector('.reader-view.chrome-hidden')"),
        false,
      );
      await execute(
        "(()=>{const el=document.querySelector('.reader-view');const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));})()",
      );
      await execute(
        "(()=>{const el=document.querySelector('.reader-scroll');el.scrollTop=(el.scrollHeight-el.clientHeight)/2;el.dispatchEvent(new Event('scroll'));})()",
      );
      await pause(100);
      await click('Ajustes de leitura');
      await select('Modo de leitura', 'pages');
      await click('Ajustes de leitura');
      await wait(
        "(()=>{const el=document.querySelector('.reader-scroll.paged');return el && el.scrollWidth>el.clientWidth*2 && el.scrollLeft>0 && Math.abs(el.scrollLeft/el.clientWidth-Math.round(el.scrollLeft/el.clientWidth))<0.01;})()",
      );
      const before = await execute(
        "(()=>{const el=document.querySelector('.reader-scroll');return {left:el.scrollLeft,width:el.clientWidth,ratio:el.scrollLeft/(el.scrollWidth-el.clientWidth)};})()",
      );
      assert.ok(Math.abs(before.ratio - 0.5) < 0.1);
      await key('ArrowRight');
      await pause(100);
      assert.ok(
        Math.abs(
          (await execute(
            "document.querySelector('.reader-scroll').scrollLeft",
          )) -
            before.left -
            before.width,
        ) < 3,
      );
      assert.match(
        await execute(
          "document.querySelector('.reader-title small').textContent",
        ),
        /Capítulo 1$/,
      );
      await capture('version01-reader-pages');
      const ratio = await execute(
        "(()=>{const el=document.querySelector('.reader-scroll');return el.scrollLeft/(el.scrollWidth-el.clientWidth);})()",
      );
      win.setSize(900, 720);
      await pause(400);
      const resized = await execute(
        "(()=>{const el=document.querySelector('.reader-scroll');return {left:el.scrollLeft,width:el.clientWidth,ratio:el.scrollLeft/(el.scrollWidth-el.clientWidth)};})()",
      );
      assert.ok(
        Math.abs(
          resized.left / resized.width -
            Math.round(resized.left / resized.width),
        ) < 0.01,
      );
      assert.ok(Math.abs(resized.ratio - ratio) < 0.1);
      await key('End');
      await pause(700);
      await key('ArrowRight');
      await pause(100);
      assert.match(
        await execute(
          "document.querySelector('.reader-title small').textContent",
        ),
        /Capítulo 1$/,
      );
      await key('Home');
      await pause(700);
      await key('ArrowLeft');
      assert.match(
        await execute(
          "document.querySelector('.reader-title small').textContent",
        ),
        /Capítulo 1$/,
      );
      await click('Mais');
      await click('Configurações');
      await click('Aparência');
      assert.equal(
        await execute("document.querySelectorAll('.palette-swatch').length"),
        9,
      );
      await click('Paleta Turquesa');
      const green = await execute(
        "getComputedStyle(document.documentElement).getPropertyValue('--primary')",
      );
      await click('Paleta Lavanda');
      assert.notEqual(
        await execute(
          "getComputedStyle(document.documentElement).getPropertyValue('--primary')",
        ),
        green,
      );
      await capture('version01-palettes');
      await click('Fontes');
      await execute(
        "Array.from(document.querySelectorAll('.source')).find(row=>row.querySelector('strong').textContent==='Loop Source').querySelector('button').click()",
      );
      await wait("localStorage.getItem('plugin_db:loop_DB_entered')!==null");
      assert.equal(
        await execute(
          "document.body.dataset.alive='yes';document.body.dataset.alive",
        ),
        'yes',
      );
      const firstRotation = await execute(
        "getComputedStyle(document.querySelector('.busy .spinner')).transform",
      );
      await pause(120);
      assert.notEqual(
        await execute(
          "getComputedStyle(document.querySelector('.busy .spinner')).transform",
        ),
        firstRotation,
      );
      await click('Cancelar operação');
      await wait("!document.querySelector('.busy')");
      await click('Biblioteca');
      await execute("document.querySelector('.book').click()");
      await execute("document.querySelector('.chapter-open').click()");
      await wait(
        "document.querySelector('article')?.textContent.includes('Uma história de teste')",
      );
      console.log(
        'PASS: current package version, automatic chapter chunks and remote retry without loops, full-height hidden bars, configurable page keys, aligned horizontal pages and resize restoration, chapter boundaries, nine palettes, animated spinner and cancellation of a synchronous infinite-loop source without freezing the UI.',
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
require(process.argv.includes('--packaged')
  ? path.join(
      __dirname,
      '../release/win-unpacked/resources/app.asar/dist/main.cjs',
    )
  : '../dist/main.cjs');
