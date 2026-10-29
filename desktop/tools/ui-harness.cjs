// Gera páginas estáticas que carregam o bundle real da interface com uma ponte
// `window.desktop` falsa. Serve para renderizar as telas no Chrome headless e
// conferir layout/comportamento sem abrir o Electron.
const fs = require('node:fs');
const path = require('node:path');

const chapterText = Array.from(
  { length: 18 },
  () =>
    '<p>O vento atravessava as árvores enquanto o viajante abria seu livro. ' +
    'A cada página, uma nova história o esperava, tão próxima quanto o ' +
    'horizonte parecia distante. Ele lia devagar, como quem não quer chegar ' +
    'ao fim.</p>',
).join('');

const novel = {
  id: 1,
  name: 'O Jardim das Estrelas',
  author: 'Autora de Teste',
  status: 'Em andamento',
  summary: 'Uma história de teste usada apenas para validar a interface.',
  genres: ['Fantasia', 'Aventura'],
  cover: '',
  path: '/novel/1',
  pluginId: 'fonte-teste',
  inLibrary: true,
  totalPages: 1,
  chapters: [
    {
      id: 1,
      name: 'Capítulo 1 — O começo',
      path: '/novel/1/1',
      page: '1',
      position: 0,
      chapterNumber: 1,
      unread: true,
      bookmark: false,
      isDownloaded: false,
      progress: 0,
      releaseTime: '2026-10-01',
      readTime: '',
    },
  ],
};

const bigNovel = {
  ...novel,
  name: 'Obra com muitos capítulos',
  totalPages: 3,
  chapters: Array.from({ length: 250 }, (_, index) => ({
    id: index + 1,
    name: `Capítulo ${index + 1}`,
    path: `/novel/1/${index + 1}`,
    page: '1',
    position: index,
    chapterNumber: index + 1,
    unread: true,
    bookmark: false,
    isDownloaded: false,
    progress: 0,
    releaseTime: '',
    readTime: '',
  })),
};

function page(settings, script, novels = [novel]) {
  const state = {
    novels,
    categories: [],
    settings,
    plugins: [],
    repositories: [],
    pluginStorage: {},
    files: {},
  };
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><title>harness</title>
<link rel="stylesheet" href="../dist/style.css" />
</head>
<body>
<div id="root"></div>
<script>
  window.__state = ${JSON.stringify(state)};
  const chapterHtml = ${JSON.stringify(chapterText)};
  window.desktop = {
    load: async () => window.__state,
    info: async () => ({ version: '0.1.0', platform: 'win32' }),
    save: async () => true,
    file: async (action, name) => {
      if (action === 'tryRead') return name.endsWith('index.html') ? chapterHtml : null;
      if (action === 'readBase64') return null;
      if (action === 'exists') return false;
      return null;
    },
    request: async () => { throw new Error('sem rede no harness'); },
    cancelRequest: async () => true,
    cancelRequests: async () => true,
    backup: async () => false,
    restore: async () => null,
    onBeforeClose: () => () => {},
    finishClose: () => {},
  };
  window.__click = (selector, text) => {
    const nodes = [...document.querySelectorAll(selector)];
    const node = text
      ? nodes.find(item => (item.textContent || '').trim().includes(text))
      : nodes[0];
    if (node) node.click();
    return Boolean(node);
  };
  window.__report = [];
</script>
<script src="../dist/renderer.js"></script>
<script>
  window.addEventListener('error', event => window.__report.push(String(event.message)));
  const steps = ${JSON.stringify(script)};
  let delay = 350;
  for (const step of steps) {
    setTimeout(() => {
      const [kind, arg, arg2] = step;
      if (kind === 'click') window.__click(arg, arg2);
      if (kind === 'eval') window.eval(arg);
      if (kind === 'mousemove') {
        const target = document.querySelector('.reader-view');
        target?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      }
    }, (delay += 350));
  }
</script>
</body></html>`;
}

const target = path.join(__dirname, '..', '.tmp');
fs.mkdirSync(target, { recursive: true });
const files = {
  'app-library.html': page({}, []),
  'app-appearance.html': page({}, [
    ['click', 'nav button', 'Mais'],
    ['click', '.setting-link', 'Configurações'],
    ['click', '.setting-link', 'Aparência'],
  ]),
  'app-palette.html': page({}, [
    ['click', 'nav button', 'Mais'],
    ['click', '.setting-link', 'Configurações'],
    ['click', '.setting-link', 'Aparência'],
    ['click', '.palette-swatch', 'Tako'],
    [
      'eval',
      "document.body.dataset.probe = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() + ' | ' + getComputedStyle(document.documentElement).getPropertyValue('--background').trim()",
    ],
  ]),
  'app-reader.html': page(
    { desktopPagination: 'scroll', desktopPageStep: 85 },
    [
      ['click', '.book'],
      ['click', '.chapter-open'],
    ],
  ),
  'app-reader-paged.html': page({ desktopPagination: 'pages' }, [
    ['click', '.book'],
    ['click', '.chapter-open'],
  ]),
  'app-reader-paged-chrome.html': page({ desktopPagination: 'pages' }, [
    ['click', '.book'],
    ['click', '.chapter-open'],
    ['mousemove'],
  ]),
  'app-settings-reader.html': page({}, [
    ['click', 'nav button', 'Mais'],
    ['click', '.setting-link', 'Configurações'],
    ['click', '.setting-link', 'Leitor'],
  ]),
  'app-settings-reader-bottom.html': page({}, [
    ['click', 'nav button', 'Mais'],
    ['click', '.setting-link', 'Configurações'],
    ['click', '.setting-link', 'Leitor'],
    ['eval', "document.querySelector('main').scrollTop = 1200"],
  ]),
  'app-reader-keys.html': page({ desktopPagination: 'pages' }, [
    ['click', '.book'],
    ['click', '.chapter-open'],
    [
      'eval',
      "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))",
    ],
    [
      'eval',
      "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))",
    ],
  ]),
  'app-novel.html': page({}, [['click', '.book']]),
  'app-reader-probe.html': page({ desktopPagination: 'pages' }, [
    ['click', '.book'],
    ['click', '.chapter-open'],
    [
      'eval',
      "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); setTimeout(() => { const el = document.querySelector('.reader-scroll'); el.dispatchEvent(new Event('scroll')); setTimeout(() => { document.body.dataset.probe = el.scrollLeft + ' | ' + document.querySelector('.reader-page-indicator').textContent; }, 200); }, 900)",
    ],
  ]),
  'app-chapters.html': page(
    {},
    [
      ['click', '.book'],
      [
        'eval',
        "const column = document.querySelector('.novel-chapters-column'); const tick = (n) => { column.scrollTop = column.scrollHeight; setTimeout(() => { document.body.dataset.probe = n + ':' + document.querySelectorAll('.chapter-row').length; if (n < 4) tick(n + 1); }, 400); }; setTimeout(() => tick(0), 300)",
      ],
    ],
    [bigNovel],
  ),
};

for (const [name, html] of Object.entries(files))
  fs.writeFileSync(path.join(target, name), html);
console.log('wrote', Object.keys(files).length, 'harness pages');
