// Prevent source code and maintenance tools from reading Android files
// outside desktop/. The vendored original SDK remains part of the Desktop.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sources = [
  'src',
  'vendor/lnreader/src',
  'build',
  'scripts',
  'tools',
].map(directory => path.join(root, directory));
const errors = [];
let inspected = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(filename); continue; }
    if (!/\.(?:js|jsx|ts|tsx|cjs|mjs)$/.test(filename)) continue;
    inspected++;
    const code = fs.readFileSync(filename, 'utf8');
    // Do not scan this checker's own regex definitions for prohibited paths.
    if (filename !== __filename) {
      const externalTree = new RegExp(
        String.raw`\.\.\/\.\.\/(?:assets|android|src|packages)\/` +
          String.raw`|android-icons\/|ANDROID_HOME|--from=\/`,
        'i',
      );
      if (externalTree.test(code))
        errors.push(path.relative(root, filename) + ' references an external Android tree.');
    }
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
  'vendor/lnreader/src/services/backup/types.ts',
  'vendor/lnreader/src/services/backup/options.ts',
  'vendor/lnreader/src/theme/md3/index.ts',
  'vendor/lnreader/assets/reader/fonts/noto-sans.ttf',
  'vendor/lnreader/assets/native/ic_launcher.png',
]) if (!fs.existsSync(path.join(root, file))) errors.push('Missing standalone asset: ' + file);
const build = fs.readFileSync(path.join(root, 'build.mjs'), 'utf8');
if (/resolve\(['"]\.\.\//.test(build) || /copyFile\(\s*['"]\.\.\//.test(build))
  errors.push('Desktop build still resolves files outside desktop/');
// The standalone icon generator is not called by normal builds, but it must
// also work from desktop/ alone when maintainers need to refresh icons.
const iconMaker = fs.readFileSync(path.join(root, 'build/make-icon.cjs'), 'utf8');
if (!iconMaker.includes('../vendor/lnreader/assets/native/ic_launcher.png'))
  errors.push('Icon generator must use desktop/vendor/lnreader, not the external Android tree.');
if (/\.\.\/\.\.\/assets\/|android-icons\/|ANDROID_HOME|react-native(?:\/|$)/.test(iconMaker))
  errors.push('Icon generator contains an Android-only or out-of-tree resource path.');
const sdkSync = fs.readFileSync(path.join(root, 'scripts/sync-original-sdk.cjs'), 'utf8');
if (!sdkSync.includes("'.tmp', 'lnreader-original'") ||
    !sdkSync.includes('assertLocalTree(staging)') ||
    /--from=|path\.resolve\(upstream|fs\.rmSync\(/.test(sdkSync))
  errors.push('SDK updater must use safe, in-desktop staging and keep original vendor files.');
if (errors.length) {
  console.error('Desktop isolation FAILED:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: Desktop source and pinned plugin SDK remain inside desktop/ (' + inspected + ' code files checked).');
}
