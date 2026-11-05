const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'lnreader-reader-rules-'),
);
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const longChapter =
  '<p>Um capítulo de demonstração para verificar o progresso e a posição de leitura.</p>'.repeat(
    70,
  );
let pageRequests = 0;
let chapterRequests = 0;
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/page') {
    if (++pageRequests === 1) {
      response.writeHead(503);
      response.end('{}');
      return;
    }
    response.end(
      JSON.stringify({
        chapters: [
          { name: 'Segundo', path: '/c2' },
          { name: 'Segundo', path: '/c2' },
        ],
      }),
    );
  } else
    response.end(
      JSON.stringify({
        html:
          ++chapterRequests === 1
            ? '<script>window.bad=true</script>'
            : longChapter,
      }),
    );
});
const timeout = setTimeout(() => {
  console.error('Reader rules timed out');
  app.exit(1);
}, 45000);
server.listen(0, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const plugin = {
    id: 'rules',
    name: 'Rules fixture',
    version: '1.0.0',
    site: base,
    url: `${base}/plugin.js`,
    lang: 'en',
  };
  const code = `const {fetchApi} = require('@libs/fetch'); exports.default={...${JSON.stringify(
    plugin,
  )},
    parseNovel: async()=>({name:'Obra revisada',path:'/book',totalPages:2,chapters:[{name:'Prefácio',path:'/c0'},{name:'Primeiro revisado',path:'/c1',scanlator:['A','B']}]}),
    parsePage: async()=>{const response=await fetchApi(${JSON.stringify(
      base + '/page',
    )}); if(!response.ok) throw new Error('Página temporariamente indisponível'); return response.json();},
    parseChapter: async()=> (await (await fetchApi(${JSON.stringify(
      base + '/chapter',
    )})).json()).html
  };`;
  const state = {
    ...emptyState(),
    // These older UI journeys intentionally assert Portuguese labels.
    settings: { desktopInterfaceLanguage: 'pt-BR' },
    plugins: [plugin],
    novels: [
      {
        id: 1,
        pluginId: 'rules',
        name: 'Obra de teste',
        path: '/book',
        inLibrary: true,
        totalPages: 2,
        chapters: [
          {
            id: 11,
            novelId: 1,
            name: 'Primeiro',
            path: '/c1',
            page: '1',
            position: 0,
            unread: true,
            bookmark: true,
            isDownloaded: true,
            progress: 50,
            readTime: '2026-10-28T01:00:00Z',
          },
        ],
      },
    ],
  };
  state.files['Plugins/rules/index.js'] = Buffer.from(code).toString('base64');
  state.files['Novels/rules/1/11/index.html'] =
    Buffer.from(longChapter).toString('base64');
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
          `Timeout: ${code}; ${await execute(
            'document.body.innerText.slice(-700)',
          )}`,
        );
      };
      const click = label =>
        execute(
          `Array.from(document.querySelectorAll('button')).find(button=>(button.getAttribute('aria-label')||button.textContent.trim())===${JSON.stringify(
            label,
          )}).click()`,
        );
      try {
        await wait(
          "document.querySelector('.book') && !document.body.innerText.includes('Processando…')",
        );
        await execute("document.querySelector('.book').click()");
        await click('Continuar leitura');
        await wait(
          "document.querySelector('article') && !document.body.innerText.includes('Processando…')",
        );
        // Reader content and scroll restoration commit on separate render
        // frames; wait for the actual 50% position before asserting it.
        // A broken restore still times out rather than being accepted.
        await wait(
          "(()=>{const e=document.querySelector('.reader-scroll');if(!e)return false;const h=e.scrollHeight-e.clientHeight;const p=h>0?e.scrollTop/h*100:0;return p>45&&p<55;})()",
        );
        // Offline-first regression: cached chapter content must not invoke the source.
        // A source can be removed, blocked or offline after a chapter was saved.
        assert.equal(
          chapterRequests,
          0,
          'Opening a downloaded chapter must not fetch chapter HTML from the source',
        );
        const percentage = await execute(
          "(()=>{const element=document.querySelector('.reader-scroll');return element.scrollTop/(element.scrollHeight-element.clientHeight)*100;})()",
        );
        assert.ok(
          percentage > 45 && percentage < 55,
          `Native percentage restore: ${percentage}`,
        );
        await wait(
          'window.desktop.load().then(state=>Boolean(state.novels[0].chapters[0].readTime))',
        );
        assert.equal(
          (await execute('window.desktop.load()')).novels[0].chapters[0].unread,
          true,
        );
        // Wait until the restore animation frame has cleared the guard so
        // the next scroll is treated as an actual reader interaction.
        await execute(
          'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
        );
        await execute(
          "void(document.querySelector('.reader-scroll').scrollTop=document.querySelector('.reader-scroll').scrollHeight)",
        );
        await wait(
          'window.desktop.load().then(state=>state.novels[0].chapters[0].unread===false)',
        );
        await click('Próximo capítulo');
        await wait(
          "document.body.innerText.includes('Página temporariamente indisponível') && !document.body.innerText.includes('Processando…')",
        );
        assert.equal(pageRequests, 1);
        await click('Próximo capítulo');
        await wait(
          "document.querySelector('.reader-error') !== null && !document.body.innerText.includes('Processando…')",
        );
        assert.equal(pageRequests, 2);
        assert.equal(
          await execute(
            "document.querySelector('.reader-title small').textContent",
          ),
          'Primeiro',
        );
        await click('Tentar capítulo novamente');
        await wait(
          "document.querySelector('.reader-title small')?.textContent==='Segundo' && !document.body.innerText.includes('Processando…')",
        );
        await click('Voltar aos capítulos');
        await click('Atualizar capítulos');
        await wait(
          "document.body.innerText.includes('Primeiro revisado') && !document.body.innerText.includes('Processando…')",
        );
        await wait(
          "window.desktop.load().then(state=>state.novels[0].name==='Obra revisada')",
        );
        const saved = (await execute('window.desktop.load()')).novels[0];
        const first = saved.chapters.find(chapter => chapter.path === '/c1');
        assert.equal(first.id, 11);
        assert.equal(first.bookmark, true);
        assert.equal(first.isDownloaded, true);
        assert.equal(first.unread, false);
        assert.ok(first.progress >= 97);
        assert.equal(first.scanlator, 'A, B');
        assert.equal(saved.inLibrary, true);
        assert.deepEqual(
          saved.chapters.map(chapter => chapter.path),
          ['/c0', '/c1', '/c2'],
        );
        assert.equal(
          saved.chapters.filter(chapter => chapter.path === '/c2').length,
          1,
        );
        console.log(
          'PASS: native progress restore, 97% read threshold, offline reading, page-boundary retry, empty-chapter retry and refresh preserving IDs/downloads/bookmarks.',
        );
        clearTimeout(timeout);
        server.close();
        win.destroy();
        app.exit(0);
      } catch (error) {
        console.error(error);console.error(await execute("document.body.innerText"));
        clearTimeout(timeout);
        server.close();
        win.destroy();
        app.exit(1);
      }
    });
  });
  require('../dist/main.cjs');
});
