// Requires node test/load-benchmark.cjs first. Never opens the real profile.
const { app, net } = require('electron');
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { RequestPool, requestHTTP } = require('../src/request.cjs');
const reportFile = path.join(__dirname, '../.tmp/load-benchmark-latest.json');
const report = JSON.parse(fs.readFileSync(reportFile));
const profile = fs.mkdtempSync(path.join(__dirname, '../.tmp/load-ui-'));
fs.copyFileSync(
  path.join(report.root, 'library.json'),
  path.join(profile, 'library.json'),
);
// This older stress journey verifies labels in Portuguese. Make that an
// explicit fixture preference instead of depending on the product default.
const metadataFile = path.join(profile, 'library.json');
const fixture = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
fixture.settings = { ...fixture.settings, desktopInterfaceLanguage: 'pt-BR' };
fs.writeFileSync(metadataFile, JSON.stringify(fixture));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');
let online = false;
const sockets = new Set();
const server = http.createServer((req, res) => {
  if (req.url === '/stall') return;
  if (!online) return req.socket.destroy();
  if (req.url === '/error') {
    res.writeHead(503);
    res.end('unavailable');
    return;
  }
  res.end('recovered');
});
server.on('connection', socket => {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
});
const finish = (code, win) => {
  for (const socket of sockets) socket.destroy();
  server.close();
  clearTimeout(deadline);
  win?.destroy();
  app.exit(code);
};
const deadline = setTimeout(() => {
  console.error('Stress UI timeout');
  finish(1);
}, 90000);
const started = performance.now();
server.listen(0, '127.0.0.1', () => {
  app.on('browser-window-created', (_event, win) => {
    win.webContents.setBackgroundThrottling(false);
    win.webContents.once('did-finish-load', async () => {
      const execute = code => win.webContents.executeJavaScript(code, true);
      const wait = async code => {
        for (let i = 0; i < 400; i++) {
          if (await execute(`Promise.resolve(${code}).then(Boolean)`)) return;
          await new Promise(r => setTimeout(r, 50));
        }
        throw new Error('Timeout ' + code);
      };
      const click = label =>
        execute(
          `Array.from(document.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')||b.textContent.trim())===${JSON.stringify(
            label,
          )}).click()`,
        );
      try {
        await wait(
          "document.querySelectorAll('.book').length===7000 && !document.querySelector('.busy')",
        );
        report.uiStartupSeconds = +(
          (performance.now() - started) /
          1000
        ).toFixed(3);
        let start = performance.now();
        await click('Atualizações');
        await wait("document.querySelector('.updates-page')");
        report.uiUpdatesSeconds = +((performance.now() - start) / 1000).toFixed(
          3,
        );
        start = performance.now();
        await click('Biblioteca');
        await wait("document.querySelectorAll('.book').length===7000");
        report.uiLibraryReturnSeconds = +(
          (performance.now() - start) /
          1000
        ).toFixed(3);
        const base = `http://127.0.0.1:${server.address().port}`;
        const pool = new RequestPool(net, 4, 128);
        for (let cycle = 0; cycle < 3; cycle++) {
          online = false;
          const failed = await Promise.allSettled(
            Array.from({ length: 20 }, (_, i) =>
              pool.run(base + '/offline/' + i),
            ),
          );
          assert.equal(failed.filter(v => v.status === 'rejected').length, 20);
          online = true;
          const success = await Promise.all(
            Array.from({ length: 20 }, (_, i) =>
              pool.run(base + '/online/' + i),
            ),
          );
          assert.ok(success.every(v => v.status === 200));
        }
        await assert.rejects(
          requestHTTP(net, base + '/stall', {}, { timeoutMs: 100 }),
          /demorou/,
        );
        const unavailable = await pool.run(base + '/error');
        assert.equal(unavailable.status, 503);
        const controller = new AbortController();
        const canceled = requestHTTP(
          net,
          base + '/stall',
          {},
          { signal: controller.signal },
        );
        controller.abort();
        await assert.rejects(canceled, /cancelada/);
        await new Promise(r => setTimeout(r, 50));
        assert.equal(pool.active, 0);
        assert.equal(pool.entries.size, 0);
        assert.equal((await pool.run(base + '/retry')).status, 200);
        const saved = await execute('window.desktop.load({metadataOnly:true})');
        assert.equal(saved.novels.length, 7000);
        assert.equal(saved.novels[0].chapters.length, 4000);
        report.network = {
          failedConnections: 60,
          recoveredConnections: 61,
          http503: true,
          timeout: true,
          cancel: true,
          queueReleased: true,
        };
        report.processMemory = app
          .getAppMetrics()
          .map(({ type, memory }) => ({ type, memory }));
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report));
        finish(0, win);
      } catch (error) {
        console.error(error);
        finish(1, win);
      }
    });
  });
  require('../dist/main.cjs');
});
