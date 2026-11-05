// Realistic offline user journeys based on reported LNReader and other
// reading-app issues. Every Electron fixture creates its own temporary
// profile; no actual user library or external novel site is modified.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const electron = require('electron');

const scenarios = [
  { name: 'Biblioteca, busca, categorias e busca global', file: 'library-search-smoke.cjs', issues: ['LNReader#1963', 'TachiyomiJ2K#1912'] },
  { name: 'Acoes de obras, download, marcadores e leitura', file: 'book-actions-smoke.cjs', issues: ['LNReader#2105', 'Mihon#4101'] },
  { name: 'Atualizar biblioteca, evitar duplicatas e preservar progresso', file: 'updates-smoke.cjs', issues: ['LNReader#2074', 'Mihon#3370'] },
  { name: 'Configuracoes, preferencias e modo anonimo', file: 'settings-smoke.cjs', issues: ['Kavita#5017'] },
  { name: 'Ordem real dos capitulos e navegacao', file: 'chapter-order-smoke.cjs', issues: ['LNReader#1431'] },
  { name: 'Conexoes ruins, backup durante download e fechamento', file: 'stability-smoke.cjs', issues: ['LNReader#2082', 'Mihon#4137'] },
  { name: 'Recuperacao apos travamento de interface', file: 'recovery-smoke.cjs', issues: ['LNReader#2091'] },
  { name: 'Fechamento enquanto o programa ainda salva', file: 'close-smoke.cjs', issues: ['LNReader#2091'] },
  { name: 'Fonte defeituosa sem travar a leitura', file: 'isolation-smoke.cjs', issues: ['LNReader#2106'] },
  { name: 'Leitura paginada, alteracao de tema e cancelar fonte presa', file: 'version01-smoke.cjs', issues: ['Mihon#4202', 'TachiyomiJ2K#1920'] },
  { name: 'Retomar leitura no ponto salvo, testar tentativas e preservar downloads após atualização', file: 'reader-rules-smoke.cjs', issues: ['Readest#4838', 'Kavita#4400', 'LNReader#2074'] },
  { name: 'Biblioteca com 10 mil obras e 200 mil capítulos sem renderizar tudo', file: 'huge-library-ui-smoke.cjs', issues: ['Suwayomi#2236', 'Mihon#705'], timeoutMs: 240000 },
];
const results = [];
const directory = path.join(__dirname, '../.tmp');
fs.mkdirSync(directory, { recursive: true });
for (const test of scenarios) {
  const start = Date.now();
  console.log('\n=== USER JOURNEY: ' + test.name + ' (' + test.file + ') ===');
  const result = spawnSync(electron, [path.join(__dirname, test.file), '--visual-preview'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
    encoding: 'utf8',
    maxBuffer: 6 * 1024 * 1024,
    timeout: test.timeoutMs || 120000,
    windowsHide: true,
  });
  const info = {
    scenario: test.name,
    file: test.file,
    relatedIssues: test.issues,
    status: result.status === 0 && !result.error ? 'PASS' : 'FAIL',
    exitCode: result.status,
    durationSeconds: Math.round((Date.now() - start) / 100) / 10,
    reason: result.error?.message || null,
  };
  results.push(info);
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const meaningful = output.split(/\r?\n/).filter(line =>
    /PASS:|AssertionError|Error:|timed out|Timeout|FAILED|TypeError|ReferenceError|SyntaxError/.test(line),
  );
  console.log(
    info.status === 'FAIL'
      ? output.slice(-5000)
      : meaningful.slice(-18).join('\n') || output.slice(-1500),
  );
  console.log('USER JOURNEY RESULT ' + JSON.stringify(info));
}

/**
 * Additional 18 journeys run in one Electron process for faster stress tests.
 * The child emits one JSON result per real assertion sequence, never a
 * fabricated PASS; a missing/aborted result is a suite failure.
 */
const extraStart = Date.now();
const extra = spawnSync(electron, [path.join(__dirname, 'extreme-journeys-smoke.cjs'), '--visual-preview'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  encoding: 'utf8',
  maxBuffer: 6 * 1024 * 1024,
  timeout: 210000,
  windowsHide: true,
});
const extraOutput = [extra.stdout, extra.stderr].filter(Boolean).join('\n');
const extraResults = extraOutput.split(/\r?\n/).flatMap(line => {
  const prefix = 'EXTREME JOURNEY RESULT ';
  const at = line.indexOf(prefix);
  if (at < 0) return [];
  try {
    const report = JSON.parse(line.slice(at + prefix.length));
    return [{ scenario: report.scenario, file: 'extreme-journeys-smoke.cjs',
      status: report.status, durationSeconds: report.seconds,
      reason: report.error || null, category: 'adversarial-electron-or-backup' }];
  } catch { return []; }
});
results.push(...extraResults);
console.log('\n=== EXTREME USER JOURNEYS: 13–30 ===');
console.log(extraOutput.slice(-12000));
console.log('EXTREME USER JOURNEY GROUP '+JSON.stringify({
  expected: 18, recorded: extraResults.length,
  passed: extraResults.filter(x => x.status === 'PASS').length,
  exitCode: extra.status, durationSeconds: (Date.now() - extraStart) / 1000,
}));
if (extraResults.length !== 18 || extra.error || (extra.status !== 0 && extraResults.every(x => x.status === 'PASS'))) {
  results.push({ scenario: 'Verificação de integridade das 18 jornadas adicionais',
    file: 'extreme-journeys-smoke.cjs', status: 'FAIL',
    reason: extra.error?.message || 'A suíte não concluiu todas as 18 verificações com sucesso' });
}

const summary = {
  source: 'Windows Electron, 30 independent journeys: UI, offline reading, backup/storage, local synthetic fixtures',
  total: results.length,
  pass: results.filter(r => r.status === 'PASS').length,
  fail: results.filter(r => r.status === 'FAIL').length,
  results,
};
fs.writeFileSync(path.join(directory, 'user-journeys-results.json'), JSON.stringify(summary, null, 2));
console.log('\nUSER JOURNEYS SUMMARY ' + JSON.stringify({
  total: summary.total, pass: summary.pass, fail: summary.fail,
}));
if (summary.fail) process.exitCode = 1;
