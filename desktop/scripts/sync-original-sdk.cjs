// Explicit maintainer-only import of an original LNReader SDK snapshot.
// All input and output are inside desktop/. No external Android tree is read.
// The staged input is untracked, and the existing vendor snapshot is kept
// until an explicit, complete import is requested.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const staging = path.join(root, '.tmp', 'lnreader-original');
const dest = path.join(root, 'vendor', 'lnreader');
if (process.argv.length > 2) {
  console.error(
    'Uso: node scripts/sync-original-sdk.cjs (coloque os arquivos de origem em desktop/.tmp/lnreader-original/)',
  );
  process.exit(2);
}
function contained(base, destination) {
  return destination === base || destination.startsWith(base + path.sep);
}
function assertLocalTree(location) {
  const info = fs.lstatSync(location);
  if (info.isSymbolicLink()) throw new Error('Link simbólico proibido no snapshot local: ' + location);
  const real = fs.realpathSync(location);
  if (!contained(fs.realpathSync(root), real))
    throw new Error('Snapshot aponta para fora de desktop/: ' + location);
  if (info.isDirectory())
    for (const entry of fs.readdirSync(location))
      assertLocalTree(path.join(location, entry));
}
if (!fs.existsSync(staging))
  throw new Error('Snapshot local ausente: desktop/.tmp/lnreader-original. Nada foi alterado.');
assertLocalTree(staging);
assertLocalTree(dest);
const sources = [
  ['src/plugins', 'src/plugins'],
  ['src/services/backup/types.ts', 'src/services/backup/types.ts'],
  ['src/services/backup/options.ts', 'src/services/backup/options.ts'],
  ['src/utils/compareVersion.ts', 'src/utils/compareVersion.ts'],
  ['src/utils/error.ts', 'src/utils/error.ts'],
  ['src/utils/constants/readerConstants.ts', 'src/utils/constants/readerConstants.ts'],
  ['src/theme/md3', 'src/theme/md3'],
  ['assets/reader/fonts/pt-sans-bold.ttf', 'assets/reader/fonts/pt-sans-bold.ttf'],
  ['assets/reader/fonts/noto-sans.ttf', 'assets/reader/fonts/noto-sans.ttf'],
  ['assets/reader/fonts/pt-serif.ttf', 'assets/reader/fonts/pt-serif.ttf'],
  ['assets/native/ic_launcher.png', 'assets/native/ic_launcher.png'],
  ['LICENSE', 'LICENSE'],
];
const hashes = {};
// Validate EVERY source first, so missing inputs cannot produce a partial
// vendor update. No originals are deleted during this import.
for (const [source] of sources) {
  const from = path.join(staging, source);
  if (!fs.existsSync(from))
    throw new Error('Arquivo original ausente em desktop/.tmp/lnreader-original: ' + source);
  assertLocalTree(from);
}
for (const [source, target] of sources) {
  const from = path.join(staging, source);
  const to = path.join(dest, target);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
  if (fs.statSync(from).isFile()) {
    hashes[target] = crypto.createHash('sha256').update(fs.readFileSync(from)).digest('hex');
  }
}
const manifest = {
  origin: 'LNReader Android files, copied without behavior changes',
  source: 'desktop/.tmp/lnreader-original (local staging, not an external checkout)',
  revision: process.env.GITHUB_SHA || 'manual-sync',
  paths: sources.map(([_, target]) => target),
  fileSHA256: hashes,
};
fs.writeFileSync(path.join(dest, 'origin.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Desktop vendor SDK synchronized. Build uses desktop/vendor only.');
