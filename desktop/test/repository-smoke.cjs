// Opt-in network check against the repository supplied by the user.
const { app, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const repository =
  'https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json';
app.setPath(
  'userData',
  fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-repository-')),
);
app.commandLine.appendSwitch('disable-gpu');
const timeout = setTimeout(() => {
  console.error('Repository check timed out');
  app.exit(1);
}, 60000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('did-finish-load', async () => {
    const execute = code => win.webContents.executeJavaScript(code, true);
    const wait = async code => {
      for (let i = 0; i < 300; i++) {
        if (await execute(code)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Timeout: ${await execute('document.body.innerText')}`);
    };
    try {
      const response = await net.fetch(repository);
      assert.ok(response.ok, `HTTP ${response.status}`);
      const plugins = await response.json();
      assert.ok(Array.isArray(plugins));
      const portuguese = plugins.filter(plugin =>
        /portug|brazil|pt-br/i.test(plugin.lang),
      );
      const requestedId = process.argv
        .find(value => value.startsWith('--source='))
        ?.slice('--source='.length);
      const selected = requestedId
        ? plugins.find(plugin => plugin.id === requestedId)
        : portuguese[0] || plugins[0];
      assert.ok(selected, `Fonte não encontrada: ${requestedId}`);
      await wait(
        "document.body.innerText.includes('Biblioteca') && !document.body.innerText.includes('Processando…')",
      );
      await execute(
        "Array.from(document.querySelectorAll('nav button')).find(b => b.textContent === 'Fontes').click()",
      );
      await execute(
        `(() => { const input = document.querySelector('input[type=url]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(
          repository,
        )}); input.dispatchEvent(new Event('input', {bubbles:true})); })()`,
      );
      await execute("document.querySelector('form').requestSubmit()");
      await wait(
        `document.querySelectorAll('.source').length === ${plugins.length} && !document.body.innerText.includes('Processando…')`,
      );
      await execute(
        `Array.from(document.querySelectorAll('.source')).find(row => row.querySelector('strong').textContent === ${JSON.stringify(
          selected.name,
        )}).querySelector('button').click()`,
      );
      await wait(
        `JSON.parse(localStorage.getItem('INSTALL_PLUGINS') || '[]').some(plugin => plugin.id === ${JSON.stringify(
          selected.id,
        )}) && !document.body.innerText.includes('Processando…')`,
      );
      await wait(
        `window.desktop.load().then(state => state.plugins.some(plugin => plugin.id === ${JSON.stringify(
          selected.id,
        )}))`,
      );
      const saved = await execute('window.desktop.load()');
      const code = Buffer.from(
        saved.files[`Plugins/${selected.id}/index.js`],
        'base64',
      ).toString('utf8');
      const dependencies = [
        ...new Set(
          [...code.matchAll(/require\(["']([^"']+)/g)].map(match => match[1]),
        ),
      ];
      if (process.argv.includes('--browse')) {
        fs.mkdirSync(path.join(__dirname, '../.tmp/qa'), { recursive: true });
        fs.writeFileSync(
          path.join(__dirname, '../.tmp/qa/source-diagnostic.js'),
          code,
        );
        await execute(
          `Array.from(document.querySelectorAll('.source')).find(row => row.querySelector('strong').textContent === ${JSON.stringify(
            selected.name,
          )} && Array.from(row.querySelectorAll('button')).some(button => button.textContent === 'Abrir')).querySelector('button').click()`,
        );
        await wait("!document.body.innerText.includes('Processando…')");
        const count = await execute(
          "document.querySelectorAll('.book').length",
        );
        const message = await execute(
          "document.querySelector('.notice')?.innerText || document.body.innerText.slice(-1000)",
        );
        assert.ok(count > 0, `${selected.name}: ${message}`);
        console.log(
          `BROWSE PASS: ${selected.name}, ${count} obras carregadas.`,
        );
        if (process.argv.includes('--read')) {
          await execute("document.querySelector('.book').click()");
          await wait("!document.body.innerText.includes('Processando…')");
          const chapters = await execute(
            "document.querySelectorAll('.chapters .chapter-open').length",
          );
          assert.ok(
            chapters > 0,
            await execute(
              "document.querySelector('.notice')?.innerText || 'Obra sem capítulos'",
            ),
          );
          await execute(
            "Array.from(document.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === 'Continuar leitura').click()",
          );
          await wait("!document.body.innerText.includes('Processando…')");
          const length = await execute(
            "document.querySelector('article')?.innerText.length || 0",
          );
          assert.ok(
            length > 0,
            await execute(
              "document.querySelector('.notice')?.innerText || 'Capítulo vazio'",
            ),
          );
          console.log(
            `READ PASS: ${chapters} capítulos na obra; ${length} caracteres no capítulo aberto.`,
          );
        }
      }
      console.log(
        JSON.stringify(
          {
            result: 'PASS',
            repository,
            listed: plugins.length,
            portugueseSources: portuguese.map(({ id, name, lang }) => ({
              id,
              name,
              lang,
            })),
            installed: selected.name,
            dependencies,
            bundleBytes: Buffer.byteLength(code),
            scope: process.argv.includes('--read')
              ? 'Real index, installation, listing, novel details and chapter reading.'
              : process.argv.includes('--browse')
              ? 'Real index, installation and website novel listing.'
              : 'Real index, bundle download, original plugin initialization and persistence. Website scraping not tested.',
          },
          null,
          2,
        ),
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
