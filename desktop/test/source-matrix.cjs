// Opt-in compatibility sample of real LNReader extensions. Uses isolated
// Electron profiles and only performs listing/reading of publicly accessible
// chapters. No login, CAPTCHA solving, or writes to real user data.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const electron = require('electron');

const cases = [
  { id: 'centralnovel', lang: 'pt', read: true },
  { id: 'kiniga', lang: 'pt', read: false },
  { id: 'betternovels', lang: 'pt', read: false },
  { id: 'novelmania.com.br', lang: 'pt', read: true },
  { id: 'royalroad', lang: 'en', read: true },
  { id: 'scribblehub', lang: 'en', read: false },
  { id: 'novelfull', lang: 'en', read: true },
  { id: 'HasuTL', lang: 'es', read: true },
  { id: 'noveldeglace', lang: 'fr', read: true },
  // Different language families and plugin engines, not only WordPress clones.
  { id: 'kakuyomu', lang: 'ja', read: false },
  { id: 'ln.hako', lang: 'vi', read: false },
  { id: 'bacalightnovel', lang: 'id', read: false },
  { id: 'arnovel', lang: 'ar', read: false },
  { id: 'AT', lang: 'ru', read: false },
  { id: 'noveltr', lang: 'tr', read: false },
  { id: 'wuxiaworld', lang: 'en', read: false },
];
const dir = path.join(__dirname, '../.tmp/source-matrix');
fs.mkdirSync(dir, { recursive: true });
const sourceTest = path.join(__dirname, 'repository-smoke.cjs');
function classification(log, ok) {
  if (ok) return 'PASS';
  if (/cloudflare|captcha|challenge|turnstile|cf-chl|just a moment|403 forbidden|\b403\b|try to open in webview|"challenge":true/i.test(log))
    return 'AUTH_OR_CHALLENGE';
  if (/Nenhuma novel encontrada|Nenhum resultado encontrado/i.test(log))
    return 'EMPTY_LIST_INCONCLUSIVE';
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|ERR_CONNECTION|ERR_SSL|ECONNREFUSED|TLS|certificat|network.*fail|HTTP 5\d\d/i.test(log))
    return 'SITE_OR_NETWORK_UNAVAILABLE';
  if (/BROWSE PASS:/i.test(log))
    return 'PARTIAL_READ_FAILED';
  if (/timed out|timeout|demorou|ERR_TIMED_OUT/i.test(log))
    return 'TIMEOUT_INCONCLUSIVE';
  if (/HTTP 40[145]|not found|404/i.test(log))
    return 'SITE_OR_EXTENSION_UNAVAILABLE';
  return 'REPRODUCIBLE_FAILURE_CANDIDATE';
}
function runOne(item) {
  return new Promise(resolve => {
    const args = [sourceTest, '--source=' + item.id, '--browse'];
    if (item.read) args.push('--read');
    const start = Date.now();
    const child = spawn(electron, args, {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, LNREADER_SOURCE_DIAGNOSTICS: '1' },
      windowsHide: true,
    });
    let output = '';
    let timedOut = false;
    const limit = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 75000);
    child.stdout.on('data', bytes => output += bytes.toString('utf8'));
    child.stderr.on('data', bytes => output += bytes.toString('utf8'));
    child.on('error', error => output += '\n' + error.stack);
    child.on('close', code => {
      clearTimeout(limit);
      const ok = code === 0 && /"result": "PASS"/.test(output);
      const result = {
        source: item.id,
        language: item.lang,
        tested: item.read ? 'install, list, details, read' : 'install, list',
        status: timedOut ? 'TIMEOUT_INCONCLUSIVE' : classification(output, ok),
        passed: ok,
        exitCode: code,
        seconds: +((Date.now() - start) / 1000).toFixed(1),
        note: ok
          ? 'Real site operations succeeded'
          : (output.match(/(?:Error:|AssertionError|ERR_[A-Z_]+|HTTP \d{3})[^\r\n]{0,220}/g) || []).slice(-3).join(' | ') || 'See source log',
      };
      fs.writeFileSync(path.join(dir, item.id.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.log'), output);
      console.log(JSON.stringify(result));
      resolve(result);
    });
  });
}
(async () => {
  const results = new Array(cases.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (cursor < cases.length) {
      const index = cursor++;
      results[index] = await runOne(cases[index]);
    }
  }));
  const report = {
    when: new Date().toISOString(),
    catalog: 'https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json',
    branch: process.env.GITHUB_REF_NAME || 'local',
    note: 'Source-site availability changes over time; challenge and network failures are not automatically app bugs. Interactive Cloudflare authentication is not tested.',
    results,
  };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    '## LNReader real-source compatibility sample',
    '',
    '| Source | Tested | Result | Duration |',
    '|---|---|---|---:|',
    ...results.map(r => '| ' + r.source + ' | ' + r.tested + ' | ' + r.status + ' | ' + r.seconds + 's |'),
    '',
    'A failing source is not necessarily an application failure: inspect logs, site availability, Cloudflare and regional restrictions.',
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'summary.md'), md);
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log('\n' + md);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
