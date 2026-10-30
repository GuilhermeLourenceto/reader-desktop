// Lightweight dependency-free Node syntax checks for the standalone Desktop.
// JSX and TypeScript are checked by the esbuild production build in CI.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dirs = ['src', 'test', 'tools', 'scripts'];
const errors = [];
let inspected = 0;

function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      inspect(target);
      continue;
    }
    if (!/\.(?:js|cjs|mjs)$/.test(entry.name)) continue;
    inspected++;
    const check = spawnSync(process.execPath, ['--check', target], {
      encoding: 'utf8',
      cwd: root,
      timeout: 15000,
    });
    if (check.status !== 0) {
      errors.push(
        path.relative(root, target) +
          ': ' +
          (check.stderr || check.error?.message || 'Sintaxe inválida'),
      );
    }
  }
}

for (const directory of dirs) inspect(path.join(root, directory));
const isolation = spawnSync(
  process.execPath,
  [path.join(root, 'scripts/check-standalone.cjs')],
  { encoding: 'utf8', cwd: root, timeout: 30000 },
);
if (isolation.status !== 0) {
  errors.push(isolation.stderr || isolation.stdout || 'Falha no isolamento');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    'PASS: ' + inspected + ' arquivos JS/CJS/MJS verificados.',
  );
  process.stdout.write(isolation.stdout);
}
