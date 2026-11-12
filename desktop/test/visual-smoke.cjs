// Synthetic library for layout inspection; never touches the user's data.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-visual-'));
app.setPath('userData', directory);
app.commandLine.appendSwitch('disable-gpu');
const names = [
  'Além do horizonte',
  'O jardim das estrelas',
  'Crônicas do viajante',
  'A última biblioteca',
  'Entre dois mundos',
  'O caminho de volta',
  'Contos ao anoitecer',
  'Memórias do vento',
];
const colors = [
  '#385067',
  '#495f4c',
  '#67504d',
  '#49465d',
  '#3f5c64',
  '#64523f',
  '#4d4561',
  '#4e5c66',
];
const server = http.createServer((request, response) => {
  const index = Number(request.url.slice(1)) || 0;
  response.setHeader('Content-Type', 'image/svg+xml');
  response.end(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480"><rect width="320" height="480" fill="${
      colors[index % colors.length]
    }"/><circle cx="230" cy="160" r="95" fill="#ffffff15"/><path d="M-20 400 180 100 340 440Z" fill="#ffffff10"/><path d="M20 460 100 280 220 460Z" fill="#00000025"/><text x="24" y="50" fill="#ffffffaa" font-size="12" font-family="sans-serif" letter-spacing="3">DEMONSTRAÇÃO</text><text x="24" y="430" fill="white" font-size="22" font-family="serif">Volume ${
      index + 1
    }</text></svg>`,
  );
});
const timeout = setTimeout(() => {
  console.error('Visual preview timed out');
  app.exit(1);
}, 30000);
server.listen(0, '127.0.0.1', () => {
  const state = emptyState();
  state.settings.desktopInterfaceLanguage = 'pt-BR';
  state.novels = names.map((name, index) => ({
    id: index + 1,
    name,
    pluginId: 'local',
    path: `/novel/${index}`,
    inLibrary: true,
    cover: `http://127.0.0.1:${server.address().port}/${index}`,
    author: 'Autor de exemplo',
    status: 'Ongoing',
    summary:
      'Uma biblioteca de demonstração para conferir o visual da versão desktop.',
    chapters: [
      {
        id: index * 2 + 1,
        novelId: index + 1,
        name: 'Capítulo 1 — O começo',
        path: '/chapter/1',
        unread: false,
        isDownloaded: true,
      },
      {
        id: index * 2 + 2,
        novelId: index + 1,
        name: 'Capítulo 2 — Um novo caminho',
        path: '/chapter/2',
        unread: true,
        isDownloaded: false,
      },
    ],
  }));
  state.categories = [
    { id: 1, name: 'Lendo', novelIds: [1, 2, 3, 4] },
    { id: 2, name: 'Favoritos', novelIds: [2, 5, 8] },
  ];
  for (const novel of state.novels) {
    for (const chapter of novel.chapters)
      state.files[`Novels/local/${novel.id}/${chapter.id}/index.html`] =
        Buffer.from(
          '<h2>Um novo caminho</h2>' +
            '<p>O vento atravessava as árvores enquanto o viajante abria seu livro. A cada página, uma nova história o esperava, tão próxima quanto o horizonte parecia distante.</p>'.repeat(
              8,
            ),
        ).toString('base64');
  }
  fs.writeFileSync(path.join(directory, 'library.json'), JSON.stringify(state));
  app.on('browser-window-created', (_event, win) => {
    win.webContents.on('did-finish-load', async () => {
      const execute = (code) => win.webContents.executeJavaScript(code, true);
      const wait = async (code) => {
        for (let i = 0; i < 100; i++) {
          if (await execute(code)) return;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error(`Layout did not settle: ${code}`);
      };
      const capture = async (name) => {
        await execute('document.fonts.ready.then(() => true)');
        await new Promise((resolve) => setTimeout(resolve, 200));
        const bitmap = await win.webContents.capturePage();
        fs.writeFileSync(
          path.join(__dirname, '../docs/previews', `${name}.png`),
          bitmap.toPNG(),
        );
        assert.equal(
          await execute('document.documentElement.scrollWidth <= innerWidth'),
          true,
          `${name}: horizontal overflow`,
        );
      };
      try {
        fs.mkdirSync(path.join(__dirname, '../docs/previews'), {
          recursive: true,
        });
        await wait(
          "document.querySelectorAll('.book').length === 8 && Array.from(document.images).every(image => image.complete)",
        );
        await capture('preview-library');
        await execute(
          'document.querySelector(\'[aria-label="Filtrar biblioteca"]\').click()',
        );
        await wait("document.querySelector('#library-category') !== null");
        await capture('preview-filters');
        await execute("(()=>{const el=document.querySelector('#library-category');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'2');el.dispatchEvent(new Event('change',{bubbles:true}))})()");
        await wait("document.querySelectorAll('.book').length === 3");
        win.setSize(800, 640);
        await capture('preview-library-small');
        win.setSize(1280, 850);
        await execute("document.querySelector('.book').click()");
        await wait("document.querySelector('.novel-hero') !== null");
        await capture('preview-novel');
        win.webContents.debugger.attach('1.3');
        const { root } = await win.webContents.debugger.sendCommand(
          'DOM.getDocument',
        );
        const { nodeId } = await win.webContents.debugger.sendCommand(
          'DOM.querySelector',
          { nodeId: root.nodeId, selector: '.chapter-row' },
        );
        await win.webContents.debugger.sendCommand('CSS.enable');
        await win.webContents.debugger.sendCommand('CSS.forcePseudoState', {
          nodeId,
          forcedPseudoClasses: ['hover'],
        });
        assert.notEqual(
          await execute(
            "getComputedStyle(document.querySelector('.chapter-row')).backgroundImage",
          ),
          'none',
        );
        assert.equal(
          await execute(
            "getComputedStyle(document.querySelector('.chapter-open')).backgroundColor",
          ),
          'rgba(0, 0, 0, 0)',
        );
        await capture('preview-chapter-hover');
        await win.webContents.debugger.sendCommand('CSS.forcePseudoState', {
          nodeId,
          forcedPseudoClasses: [],
        });
        win.webContents.debugger.detach();
        await execute(
          "Array.from(document.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === 'Continuar leitura').click()",
        );
        await wait("document.querySelector('article') !== null");
        assert.equal(
          await execute(
            "getComputedStyle(document.querySelector('aside')).display",
          ),
          'none',
        );
        await capture('preview-reader');
        // Verify Sources, Settings and compact layout using real screen elements.
        await execute("document.querySelector('[aria-label=\"Voltar aos capítulos\"]').click()");
        await wait("document.querySelector('.novel-page') !== null");
        await execute("document.querySelector('[aria-label=\"Voltar à biblioteca\"]').click()");
        await wait("document.querySelector('.library-toolbar') !== null");
        await execute("Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.trim()==='Fontes').click()");
        await wait("document.querySelector('.source-mode-tabs') !== null");
        await capture('preview-sources-search');
        await execute("Array.from(document.querySelectorAll('.source-mode-tabs button')).find(b => b.textContent.trim()==='Gerenciar fontes').click()");
        await wait("document.querySelector('[aria-label=\"Pesquisar fontes\"]') !== null");
        await capture('preview-sources-manage');
        await execute("Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.trim()==='Mais').click()");
        await wait("document.querySelector('[data-settings-page=more]') !== null");
        await execute("Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label')==='Configurações').click()");
        await wait("document.querySelector('[data-settings-page=settings]') !== null");
        await execute("Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label')==='Leitor').click()");
        await wait("document.querySelector('[aria-label=\"Tempo para ocultar as barras\"]') !== null");
        assert.deepEqual(
          await execute("(()=>{const el=document.querySelector('[aria-label=\"Tempo para ocultar as barras\"]');return [el.value,el.min,el.max]})()"),
          ['2.6', '1', '10'],
        );
        win.setSize(800, 640);
        await capture('preview-settings-reader-small');
        console.log(
          'PASS: library filters, novel, reader, sources and settings at wide/compact sizes. Preview PNGs saved under desktop/docs/previews.',
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
