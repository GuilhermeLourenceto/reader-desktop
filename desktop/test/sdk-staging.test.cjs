const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const original = path.resolve(__dirname, '../scripts/sync-original-sdk.cjs');
const fileInputs = [
  'src/services/backup/types.ts',
  'src/services/backup/options.ts',
  'src/utils/compareVersion.ts',
  'src/utils/error.ts',
  'src/utils/constants/readerConstants.ts',
  'assets/reader/fonts/pt-sans-bold.ttf',
  'assets/reader/fonts/noto-sans.ttf',
  'assets/reader/fonts/pt-serif.ttf',
  'assets/native/ic_launcher.png',
  'LICENSE',
];
function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lnreader-sdk-test-'));
  const desktop = path.join(root, 'desktop');
  const scripts = path.join(desktop, 'scripts');
  const vendor = path.join(desktop, 'vendor/lnreader');
  const staging = path.join(desktop, '.tmp/lnreader-original');
  try {
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(vendor, { recursive: true });
    fs.copyFileSync(original, path.join(scripts, 'sync-original-sdk.cjs'));
    return fn({ root, desktop, staging, vendor, script: path.join(scripts, 'sync-original-sdk.cjs') });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function run(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
  });
}
function writeFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

test('SDK importer rejects an external --from path without reading or changing vendor', () => {
  fixture(({ vendor, script }) => {
    writeFile(path.join(vendor, 'existing.txt'), 'KEEP ORIGINAL');
    const result = run(script, ['--from=/tmp/android-repository']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Uso:/);
    assert.equal(fs.readFileSync(path.join(vendor, 'existing.txt'), 'utf8'), 'KEEP ORIGINAL');
  });
});

test('SDK importer refuses incomplete internal staging before touching vendor', () => {
  fixture(({ staging, vendor, script }) => {
    writeFile(path.join(staging, 'LICENSE'), 'ONLY LICENSE');
    writeFile(path.join(vendor, 'existing.txt'), 'KEEP ORIGINAL');
    const result = run(script);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Arquivo original ausente/);
    assert.equal(fs.readFileSync(path.join(vendor, 'existing.txt'), 'utf8'), 'KEEP ORIGINAL');
  });
});

test('complete in-desktop original SDK staging updates snapshot without deleting existing original modules', () => {
  fixture(({ staging, vendor, script }) => {
    for (const file of fileInputs)
      writeFile(path.join(staging, file), 'STAGED ' + file);
    writeFile(path.join(staging, 'src/plugins/pluginManager.ts'), 'new plugin');
    writeFile(path.join(staging, 'src/theme/md3/defaultTheme.ts'), 'new palette');
    writeFile(path.join(vendor, 'src/plugins/older-original.ts'), 'KEEP ORIGINAL');
    const result = run(script);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(vendor, 'src/plugins/older-original.ts'), 'utf8'), 'KEEP ORIGINAL');
    assert.equal(fs.readFileSync(path.join(vendor, 'src/plugins/pluginManager.ts'), 'utf8'), 'new plugin');
    assert.equal(fs.readFileSync(path.join(vendor, 'assets/native/ic_launcher.png'), 'utf8'), 'STAGED assets/native/ic_launcher.png');
    const provenance = JSON.parse(fs.readFileSync(path.join(vendor, 'origin.json'), 'utf8'));
    assert.match(provenance.source, /desktop\/\.tmp\/lnreader-original/);
  });
});

test('symlinked in-desktop snapshot cannot read outside desktop', {
  skip: process.platform === 'win32' ? 'Windows does not guarantee symlink creation permissions' : false,
}, () => {
  fixture(({ root, staging, vendor, script }) => {
    const external = path.join(root, 'external-android');
    writeFile(path.join(external, 'LICENSE'), 'NEVER READ');
    fs.mkdirSync(path.dirname(staging), { recursive: true });
    fs.symlinkSync(external, staging, 'dir');
    writeFile(path.join(vendor, 'existing.txt'), 'KEEP ORIGINAL');
    const result = run(script);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Link simbólico proibido/);
    assert.equal(fs.readFileSync(path.join(vendor, 'existing.txt'), 'utf8'), 'KEEP ORIGINAL');
  });
});
