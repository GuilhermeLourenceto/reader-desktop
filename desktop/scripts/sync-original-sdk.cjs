// Optional maintainer-only synchronization from the original Android tree.
// A normal Desktop build must NEVER execute this script or use parent files.
// Run from this repository when deliberately updating the pinned LNReader SDK.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const android = path.resolve(__dirname, '../..');
const dest = path.resolve(__dirname, '../vendor/lnreader');
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
for (const [source, target] of sources) {
  const from = path.join(android, source);
  const to = path.join(dest, target);
  if (!fs.existsSync(from)) throw new Error('Original source missing: ' + source);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: true });
  if (fs.statSync(from).isFile()) {
    hashes[target] = crypto.createHash('sha256').update(fs.readFileSync(from)).digest('hex');
  }
}
// Tests for the Android application aren't part of the Desktop plugin runtime.
fs.rmSync(path.join(dest, 'src/plugins/__tests__'), { recursive: true, force: true });
const manifest = {
  origin: 'LNReader Android files, copied without behavior changes',
  source: 'repository-root (not a build dependency)',
  revision: process.env.GITHUB_SHA || 'manual-sync',
  paths: sources.map(([_, target]) => target),
  fileSHA256: hashes,
};
fs.writeFileSync(path.join(dest, 'origin.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Desktop vendor SDK synchronized. Build uses desktop/vendor only.');
