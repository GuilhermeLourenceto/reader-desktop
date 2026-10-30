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
    timeout: 120000,
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
  console.log(meaningful.slice(-18).join('\n') || output.slice(-1500));
  console.log('USER JOURNEY RESULT ' + JSON.stringify(info));
}
const summary = {
  source: 'Windows Electron, local synthetic fixtures, no third-party authentication',
  total: scenarios.length,
  pass: results.filter(r => r.status === 'PASS').length,
  fail: results.filter(r => r.status === 'FAIL').length,
  results,
};
fs.writeFileSync(path.join(directory, 'user-journeys-results.json'), JSON.stringify(summary, null, 2));
console.log('\nUSER JOURNEYS SUMMARY ' + JSON.stringify({
  total: summary.total, pass: summary.pass, fail: summary.fail,
}));
if (summary.fail) process.exitCode = 1;
