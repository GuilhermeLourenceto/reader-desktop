// End-to-end authentication smoke test using the actual LNReader main process.
// It exercises a source login window, a controlled OAuth-style popup, cookies
// and an authenticated source request. Local loopback is test-only.
const { app, BrowserWindow } = require('electron');
const { mkdtempSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { emptyState } = require('../dist/backup.cjs');

const profile = mkdtempSync(path.join(os.tmpdir(), 'lnreader-login-e2e-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');
const server = http.createServer((req, res) => {
  if (req.url === '/login') {
    res.setHeader('Set-Cookie', 'initial=ok; Path=/; HttpOnly; SameSite=Lax');
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><button id="login" onclick="window.open(\'/oauth\',\'auth\')">Entrar</button>');
  } else if (req.url === '/oauth') {
    res.setHeader('Set-Cookie', 'oauth=ok; Path=/; HttpOnly; SameSite=Lax');
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><p>Autenticado</p>');
  } else if (req.url === '/secure') {
    const cookie = req.headers.cookie || '';
    res.statusCode = /initial=ok/.test(cookie) && /oauth=ok/.test(cookie) ? 200 : 401;
    res.end(JSON.stringify({ cookie, userAgent: req.headers['user-agent'] }));
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});
const deadline = setTimeout(() => {
  console.error('Source login integration timed out');
  app.exit(1);
}, 30000);

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const state = emptyState();
  state.plugins = [{
    id: 'auth-fixture',
    name: 'Auth Fixture',
    site: base + '/login',
    url: 'https://example.org/fixture.js',
  }];
  writeFileSync(path.join(profile, 'library.json'), JSON.stringify(state));
  let mainWindow, loginWindow, popup;
  const popupReady = new Promise((resolve, reject) => {
    app.on('browser-window-created', (_event, window) => {
      if (!mainWindow) {
        mainWindow = window;
        window.webContents.once('did-finish-load', () => {
          void window.webContents.executeJavaScript("window.desktop.sourceLogin('auth-fixture')")
            .then(async () => {
              try {
                assert.ok(popup, 'login popup was opened');
                const result = await mainWindow.webContents.executeJavaScript(
                  "window.desktop.request(" + JSON.stringify(base + '/secure') + ",{sourceId:'auth-fixture',requestId:'auth-e2e'})",
                );
                assert.equal(result.status, 200, 'login cookies reach the source request');
                const body = JSON.parse(Buffer.from(result.body, 'base64').toString());
                assert.match(body.cookie, /oauth=ok/);
                console.log('SOURCE LOGIN E2E PASS: browser popup, persistent cookies and HTTP request');
                resolve();
              } catch (error) { reject(error); }
            }, reject);
        });
      } else if (!loginWindow) {
        loginWindow = window;
        window.webContents.once('did-finish-load', () => {
          void window.webContents.executeJavaScript("document.getElementById('login').click()", true)
            .catch(reject);
        });
      } else if (!popup) {
        popup = window;
        popup.webContents.once('did-finish-load', () => {
          // Cookie is set by the real popup response, then the user closes.
          popup.close();
          if (!loginWindow.isDestroyed()) loginWindow.close();
        });
      }
    });
  });
  require('../dist/main.cjs');
  try { await popupReady; } finally {
    for (const window of BrowserWindow.getAllWindows())
      if (!window.isDestroyed()) window.destroy();
    await new Promise(resolve => server.close(resolve));
  }
}
main().then(() => {
  clearTimeout(deadline);
  app.exit(0);
}).catch(error => {
  clearTimeout(deadline);
  console.error(error);
  server.close();
  app.exit(1);
});
