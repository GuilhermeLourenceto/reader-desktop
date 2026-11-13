import { build } from 'esbuild';
import { localization } from './scripts/localize-build.mjs';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import generateIcon from './build/make-icon.cjs';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
generateIcon();
const adapter = resolve('src/adapters.js');
const { dependencies } = JSON.parse(await readFile('package.json', 'utf8'));
const sourceAliases = {
  ...Object.fromEntries(
    Object.keys(dependencies).map(name => [
      name,
      resolve('node_modules', name),
    ]),
  ),
  '@utils/compareVersion': resolve('vendor/lnreader/src/utils/compareVersion.ts'),
  '@plugins': resolve('vendor/lnreader/src/plugins'),
};
const workerAdapter = resolve('src/workerAdapters.js');
await build({
  entryPoints: ['src/plugin-worker.js'],
  bundle: true,
  outfile: 'dist/plugin-worker.js',
  platform: 'browser',
  target: 'chrome140',
  nodePaths: [resolve('node_modules')],
  alias: {
    ...sourceAliases,
    ...Object.fromEntries(
      [
        '@database/queries/RepositoryQueries',
        '@hooks/persisted/useUserAgent',
        '@modules/native-file',
        '@utils/showToast',
        '@utils/Storages',
        '@utils/mmkv/mmkv',
        '@i18n/translations',
        'react-native-mmkv',
      ].map(name => [name, workerAdapter]),
    ),
  },
  inject: ['src/polyfills.js'],
  define: { 'process.env.NODE_ENV': '"production"' },
});
await build({
  entryPoints: ['src/renderer.jsx'],
  plugins: [localization],
  bundle: true,
  outfile: 'dist/renderer.js',
  platform: 'browser',
  target: 'chrome140',
  jsx: 'automatic',
  nodePaths: [resolve('node_modules')],
  alias: {
    ...Object.fromEntries(
      Object.keys(dependencies).map(name => [
        name,
        resolve('node_modules', name),
      ]),
    ),
    '@database/queries/RepositoryQueries': adapter,
    '@hooks/persisted/useUserAgent': adapter,
    '@modules/native-file': adapter,
    '@utils/showToast': adapter,
    '@utils/Storages': adapter,
    '@utils/mmkv/mmkv': adapter,
    '@i18n/translations': adapter,
    'react-native-mmkv': adapter,
    '@utils/compareVersion': resolve('vendor/lnreader/src/utils/compareVersion.ts'),
    '@plugins': resolve('vendor/lnreader/src/plugins'),
  },
  inject: ['src/polyfills.js'],
  define: { 'process.env.NODE_ENV': '"production"' },
});
await build({
  entryPoints: ['src/main.cjs'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/main.cjs',
  external: ['electron', 'adm-zip', 'unzipper'],
  nodePaths: [resolve('node_modules')],
});
await build({
  entryPoints: ['src/backup.cjs'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/backup.cjs',
  external: ['adm-zip', 'unzipper'],
});
await build({
  entryPoints: ['src/backup-worker.cjs'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/backup-worker.cjs',
  external: ['adm-zip', 'unzipper'],
  nodePaths: [resolve('node_modules')],
});
await build({
  entryPoints: ['src/zipStreaming.cjs'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/zipStreaming.cjs',
  external: ['adm-zip', 'unzipper'],
  nodePaths: [resolve('node_modules')],
});
for (const file of ['index.html', 'preload.cjs']) {
  await copyFile(`src/${file}`, `dist/${file}`);
}
await copyFile('vendor/lnreader/LICENSE', 'dist/LICENSE');
await copyFile(
  'vendor/lnreader/assets/reader/fonts/pt-sans-bold.ttf',
  'dist/pt-sans-bold.ttf',
);
await copyFile('vendor/lnreader/assets/reader/fonts/noto-sans.ttf', 'dist/noto-sans.ttf');
await copyFile('vendor/lnreader/assets/reader/fonts/pt-serif.ttf', 'dist/pt-serif.ttf');
// The new book icon is generated locally; the original source assets remain intact.
await copyFile('build/icon-256.png', 'dist/logo.png');
// Preserve the exact original cascade order; the onboarding CSS still comes last.
const styleParts = ["00-foundation.css","10-navigation-and-library.css","20-reader-and-settings.css","30-novel-and-chapters.css","40-history-and-updates.css","50-filters-and-responsive.css"];
const css = (await Promise.all(styleParts.map(part => readFile('src/styles/' + part, 'utf8')))).join('');
await writeFile('dist/style.css', css + await readFile('src/onboarding.css', 'utf8'));
