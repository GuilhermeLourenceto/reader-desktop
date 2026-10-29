// Real Electron integration: an interactive login session and source requests
// must share cookies, while a different source must not see those cookies.
const { app, BrowserWindow, net, session } = require('electron');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { requestHTTP } = require('../src/request.cjs');

const profile = mkdtempSync(path.join(os.tmpdir(), 'lnreader-auth-test-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('disable-gpu');
const timer = setTimeout(() => {
  console.error('Login cookie smoke test timed out');
  app.exit(1);
}, 30000);

async function test() {
  const server = http.createServer((req, res) => {
    if (req.url === '/login') {
      res.setHeader('Set-Cookie', 'lnreader_auth_fixture=valid; Path=/; HttpOnly; SameSite=Lax');
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><title>Login</title><p>Autenticado</p>');
      return;
    }
    if (req.url === '/chapter') {
      res.statusCode = /lnreader_auth_fixture=valid/.test(req.headers.cookie || '') ? 200 : 401;
      res.end(res.statusCode === 200 ? 'capitulo protegido' : 'autenticacao necessaria');
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  let window;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const host = 'http://127.0.0.1:' + server.address().port;
    const sourceSession = session.fromPartition('persist:lnreader-source-centralnovel');
    const unrelatedSession = session.fromPartition('persist:lnreader-source-other-fixture');
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        session: sourceSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    await window.loadURL(host + '/login');
    const shared = await requestHTTP(net, host + '/chapter', {}, {
      requestSession: sourceSession,
      allowPrivate: true,
    });
    assert.equal(shared.status, 200, 'same source reuses login cookie');
    const isolated = await requestHTTP(net, host + '/chapter', {}, {
      requestSession: unrelatedSession,
      allowPrivate: true,
    });
    assert.equal(isolated.status, 401, 'another source cannot use that cookie');
    console.log('AUTH COOKIE SMOKE PASS: source cookie reused and separated by partition');
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    await new Promise(resolve => server.close(resolve));
  }
}

app.whenReady().then(test).then(() => {
  clearTimeout(timer);
  app.exit(0);
}).catch(error => {
  clearTimeout(timer);
  console.error(error);
  app.exit(1);
}).finally(() => {
  // The temporary app profile may be released after Electron exits.
  app.once('quit', () => { try { rmSync(profile, { recursive: true, force: true }); } catch {} });
});
