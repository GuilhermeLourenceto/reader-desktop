// Detect accidental imports of files outside the standalone Desktop tree.
// The optional maintainer sync-original-sdk.cjs is intentionally excluded.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sources = [path.join(root, 'src'), path.join(root, 'vendor/lnreader/src')];
const errors = [];
let inspected = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(filename); continue; }
    if (!/\.(?:js|jsx|ts|tsx|cjs|mjs)$/.test(filename)) continue;
    inspected++;
    const code = fs.readFileSync(filename, 'utf8');
    const expression = /(?:from\s*|require\(\s*|import\(\s*)['"]((?:\.\.?\/)[^'"]+)['"]/g;
    for (const found of code.matchAll(expression)) {
      const target = path.resolve(path.dirname(filename), found[1]);
      if (target !== root && !target.startsWith(root + path.sep))
        errors.push(path.relative(root, filename) + ' imports ' + found[1]);
    }
  }
}
for (const dir of sources) walk(dir);
for (const file of [
  'vendor/lnreader/origin.json',
  'vendor/lnreader/LICENSE',
  'vendor/lnreader/src/plugins/pluginManager.ts',
  'vendor/lnreader/src/theme/md3/index.ts',
  'vendor/lnreader/assets/reader/fonts/noto-sans.ttf',
  'vendor/lnreader/assets/native/ic_launcher.png',
]) if (!fs.existsSync(path.join(root, file))) errors.push('Missing standalone asset: ' + file);
const build = fs.readFileSync(path.join(root, 'build.mjs'), 'utf8');
if (/resolve\(['"]\.\.\//.test(build) || /copyFile\(\s*['"]\.\.\//.test(build))
  errors.push('Desktop build still resolves files outside desktop/');
if (errors.length) {
  console.error('Desktop isolation FAILED:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: Desktop source and pinned plugin SDK remain inside desktop/ (' + inspected + ' code files checked).');
}
