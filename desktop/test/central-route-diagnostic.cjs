// Compare Central Novel routes without relying on a specific book or chapter.
// Runs in an isolated Electron profile. Never logs cookies or response bodies.
const { app, net, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { requestHTTP } = require('../src/request.cjs');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-central-routes-')));
app.commandLine.appendSwitch('disable-gpu');
const isolated = process.argv.includes('--source-session');
const pages = [
  ['home', 'https://centralnovel.com/'],
  ['catalog', 'https://centralnovel.com/series/?page=1'],
  ['search', 'https://centralnovel.com/page/1/?s=teste'],
];
const timeout = setTimeout(() => {
  console.error('CENTRAL_ROUTE_DIAGNOSTIC_TIMEOUT');
  app.exit(1);
}, 110000);

app.whenReady().then(async () => {
  const sourceSession = isolated
    ? session.fromPartition('persist:lnreader-source-centralnovel')
    : undefined;
  const userAgent = (sourceSession || session.defaultSession).getUserAgent();
  for (const [route, url] of pages) {
    try {
      const response = await requestHTTP(
        net, url,
        {
          method: 'GET',
          headers: {
            'User-Agent': userAgent,
            'Accept': '*/*',
            'Accept-Language': '*',
            'Cache-Control': 'max-age=0',
          },
        },
        { requestSession: sourceSession, timeoutMs: 20000 },
      );
      const body = Buffer.from(response.body, 'base64').toString('utf8');
      const title = (body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '')
        .replace(/\s+/g, ' ').trim().slice(0, 100);
      const result = {
        route,
        cookiePolicy: isolated ? 'per-source' : 'default',
        status: response.status,
        host: new URL(response.url).hostname,
        bytes: Buffer.byteLength(body),
        title,
        challenge: /just a moment|bot verification|checking your browser|cf-chl|challenge-platform/i.test(body.slice(0, 25000)),
        articles: (body.match(/<article\b/gi) || []).length,
      };
      console.log('CENTRAL_ROUTE ' + JSON.stringify(result));
    } catch (error) {
      console.log('CENTRAL_ROUTE ' + JSON.stringify({
        route,
        cookiePolicy: isolated ? 'per-source' : 'default',
        error: error.code || error.message,
      }));
    }
  }
  clearTimeout(timeout);
  app.quit();
}).catch(error => {
  console.error(error);
  clearTimeout(timeout);
  app.exit(1);
});
