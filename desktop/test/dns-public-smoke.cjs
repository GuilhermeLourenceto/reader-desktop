// Real Windows/Electron network check: use the same isolated session for
// DNS preflight and the actual HTTP request, without any unsafe bypass.
const { app, net, session } = require('electron');
const assert = require('node:assert/strict');
const { RequestPool } = require('../src/request.cjs');
const { validateResolvedAddresses } = require('../src/networkPolicy.cjs');

app.commandLine.appendSwitch('disable-gpu');
const watchdog = setTimeout(() => {
  console.error('DNS public source check timed out');
  app.exit(1);
}, 45000);

app.whenReady().then(async () => {
  try {
    const sourceSession = session.fromPartition(
      'persist:lnreader-dns-public-smoke',
    );
    assert.equal(typeof sourceSession.resolveHost, 'function');

    const hostname = 'raw.githubusercontent.com';
    const answer = await sourceSession.resolveHost(hostname, {
      cacheUsage: 'disallowed',
    });
    const addresses = validateResolvedAddresses(answer);
    assert.ok(addresses.length > 0);

    let usedSourceSession = false;
    const pool = new RequestPool(net, 1, 4, {
      requireDnsValidation: true,
      allowPrivate: false,
      sessionForSource: id => {
        assert.equal(id, 'public-dns-smoke');
        usedSourceSession = true;
        return sourceSession;
      },
      // Deliberately different (unsafe) default resolution: do not use it.
      dnsResolver: async () => ({
        resolvedAddresses: [{ address: '127.0.0.1' }],
      }),
    });

    const response = await pool.run(
      'https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json',
      { sourceId: 'public-dns-smoke' },
    );
    assert.equal(usedSourceSession, true);
    assert.equal(response.status, 200);
    assert.ok(response.body.length > 100);
    console.log(
      'PUBLIC DNS SMOKE PASS: public source works in its own Chromium session and private default-session DNS is ignored.',
    );
    clearTimeout(watchdog);
    app.exit(0);
  } catch (error) {
    console.error('PUBLIC DNS SMOKE FAIL:', error.stack || error);
    clearTimeout(watchdog);
    app.exit(1);
  }
}).catch(error => {
  console.error(error);
  app.exit(1);
});
