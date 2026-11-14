const { test } = require('node:test');
const assert = require('node:assert/strict');
const AdmZip = require('adm-zip');
const {
  createBackup,
  parseBackup,
  emptyState,
  safePath,
} = require('../dist/backup.cjs');

function fixture() {
  return {
    ...emptyState(),
    novels: [
      {
        id: 7,
        pluginId: 'test',
        name: 'Original novel',
        path: '/novel/1',
        inLibrary: true,
        cover: '/Novels/test/7/cover.png',
        totalPages: 0,
        chapters: [
          {
            id: 9,
            novelId: 7,
            name: 'Chapter 1',
            path: '/chapter/1',
            unread: false,
            progress: 0.4,
            isDownloaded: true,
          },
        ],
      },
    ],
    categories: [{ id: 2, name: 'Favorites', novelIds: [7] }],
    settings: { theme: 'dark', falseValue: false },
    plugins: [{ id: 'test', name: 'Test', url: 'https://example.org/test.js' }],
    files: {
      'Plugins/test/index.js': Buffer.from('exports.default = {}').toString(
        'base64',
      ),
      'Novels/test/7/9/index.html': Buffer.from(
        '<p>Offline chapter</p>',
      ).toString('base64'),
      'Covers/7': Buffer.from([0, 1, 2, 255]).toString('base64'),
    },
  };
}
test('Android v2 ZIP layout and all data survive a desktop round trip', () => {
  const state = fixture();
  const buffer = createBackup(state);
  const zip = new AdmZip(buffer);
  const manifest = JSON.parse(zip.readAsText('Version.json'));
  assert.equal(manifest.formatVersion, 2);
  assert.equal(manifest.sections.downloadedFiles, true);
  assert.ok(zip.getEntry('plugins.zip'));
  assert.ok(zip.getEntry('novel-files.zip'));
  assert.equal(
    JSON.parse(zip.readAsText('NovelAndChapters/7.json')).chapters[0].id,
    9,
  );
  assert.deepEqual(parseBackup(buffer).state, state);
});

test('binary export and direct file storage retain the Android ZIP layout and every file byte', () => {
  const state = fixture();
  const binary = {
    ...state,
    files: Object.fromEntries(
      Object.entries(state.files).map(([name, value]) => [
        name,
        Buffer.from(value, 'base64'),
      ]),
    ),
  };
  const buffer = createBackup(binary);
  const zip = new AdmZip(buffer);
  assert.equal(zip.getEntry('plugins.zip').header.method, 0);
  assert.equal(zip.getEntry('novel-files.zip').header.method, 0);
  assert.deepEqual(parseBackup(buffer).state, state);
  const stored = new Map();
  const restored = parseBackup(buffer, {
    storeFile: (name, data) => {
      stored.set(name, data);
      return (
        '@file:' +
        require('node:crypto').createHash('sha256').update(data).digest('hex')
      );
    },
  });
  assert.equal(stored.size, Object.keys(state.files).length);
  for (const [name, value] of Object.entries(state.files)) {
    assert.deepEqual(stored.get(name), Buffer.from(value, 'base64'));
    assert.match(restored.state.files[name], /^@file:[a-f0-9]{64}$/);
  }
  assert.deepEqual(restored.state.novels, state.novels);
});
test('reads legacy Android download.zip and the plugin registry in Setting.json', () => {
  const zip = new AdmZip();
  const state = fixture();
  const files = new AdmZip();
  for (const [name, value] of Object.entries(state.files))
    if (!name.startsWith('Covers/'))
      files.addFile(name, Buffer.from(value, 'base64'));
  zip.addFile(
    'Version.json',
    Buffer.from(JSON.stringify({ version: '2.0.0' })),
  );
  zip.addFile('Category.json', Buffer.from(JSON.stringify(state.categories)));
  zip.addFile(
    'Setting.json',
    Buffer.from(
      JSON.stringify({ INSTALL_PLUGINS: JSON.stringify(state.plugins) }),
    ),
  );
  zip.addFile(
    'NovelAndChapters/7.json',
    Buffer.from(JSON.stringify(state.novels[0])),
  );
  zip.addFile('download.zip', files.toBuffer());
  const restored = parseBackup(zip.toBuffer());
  assert.deepEqual(restored.state.plugins, state.plugins);
  assert.equal(
    restored.state.files['Novels/test/7/9/index.html'],
    state.files['Novels/test/7/9/index.html'],
  );
});
test('reads wrapped Android backup with data, plugins and novel-files archives', () => {
  const state = fixture();
  const data = new AdmZip();
  data.addFile(
    'Version.json',
    Buffer.from(
      JSON.stringify({
        formatVersion: 2,
        sections: {
          library: true,
          settings: true,
          plugins: true,
          downloadedFiles: true,
        },
      }),
    ),
  );
  data.addFile(
    'NovelAndChapters/7.json',
    Buffer.from(JSON.stringify(state.novels[0])),
  );
  data.addFile('Category.json', Buffer.from(JSON.stringify(state.categories)));
  data.addFile('Setting.json', Buffer.from(JSON.stringify(state.settings)));
  data.addFile('Plugins.json', Buffer.from(JSON.stringify(state.plugins)));
  data.addFile('Covers/7', Buffer.from(state.files['Covers/7'], 'base64'));
  const plugins = new AdmZip();
  plugins.addFile(
    'test/index.js',
    Buffer.from(state.files['Plugins/test/index.js'], 'base64'),
  );
  const novelFiles = new AdmZip();
  novelFiles.addFile(
    'test/7/9/index.html',
    Buffer.from(state.files['Novels/test/7/9/index.html'], 'base64'),
  );
  const wrapped = new AdmZip();
  wrapped.addFile('example.backup/data.zip', data.toBuffer());
  wrapped.addFile('example.backup/plugins.zip', plugins.toBuffer());
  wrapped.addFile('example.backup/novel-files.zip', novelFiles.toBuffer());

  assert.deepEqual(parseBackup(wrapped.toBuffer()).state, state);
});
test('partial v2 settings backup does not require library or plugin archives', () => {
  const zip = new AdmZip();
  zip.addFile(
    'Version.json',
    Buffer.from(
      JSON.stringify({
        formatVersion: 2,
        sections: {
          library: false,
          settings: true,
          plugins: false,
          downloadedFiles: false,
        },
      }),
    ),
  );
  zip.addFile('Setting.json', Buffer.from('{"fontSize":24}'));
  const restored = parseBackup(zip.toBuffer());
  assert.deepEqual(restored.state.settings, { fontSize: 24 });
  assert.equal(restored.sections.library, false);
});
test('rejects corrupted ZIP, unknown formats and missing file sections', () => {
  assert.throws(() => parseBackup(Buffer.from('not a zip')));
  const zip = new AdmZip(createBackup(fixture()));
  zip.deleteFile('plugins.zip');
  assert.throws(() => parseBackup(zip.toBuffer()), /plugins.zip/);
  zip.addFile('Version.json', Buffer.from('{"formatVersion":99}'));
  assert.throws(() => parseBackup(zip.toBuffer()), /não suportada/);
});
test('rejects traversal paths on Windows and Linux', () => {
  for (const name of [
    '../evil',
    '/evil',
    'C:/evil',
    'Plugins/../../evil',
    'Plugins\\evil',
    'Plugins/./evil',
    'evil\0.js',
  ])
    assert.throws(() => safePath(name));
  assert.equal(safePath('Plugins/source/index.js'), 'Plugins/source/index.js');
});
test('exports legacy desktop fractional progress in the native percent scale', () => {
  const state = fixture();
  state.novels[0].chapters[0].desktopProgressUnit = 'fraction';
  const restored = parseBackup(createBackup(state)).state;
  assert.equal(restored.novels[0].chapters[0].progress, 40);
  assert.equal(restored.novels[0].chapters[0].desktopProgressUnit, 'percent');
});
test('rejects invalid novels before applying any data', () => {
  const zip = new AdmZip(createBackup(fixture()));
  zip.addFile(
    'NovelAndChapters/7.json',
    Buffer.from('{"id":7,"chapters":"broken"}'),
  );
  assert.throws(() => parseBackup(zip.toBuffer()), /inválida/);
});

test('v2 backup preserves nonnumeric library ordering without changing original novel records', () => {
  const base = fixture();
  const books = [34, 5, 100, 8].map(id => ({
    ...base.novels[0],
    id,
    name: 'Book ' + id,
    path: '/novel/' + id,
    chapters: [{ id: id + 500, novelId: id, name: 'Chapter', path: '/c/' + id }],
  }));
  const state = { ...base, novels: books, categories: [], files: {} };
  const archive = createBackup(state);
  const zip = new AdmZip(archive);
  const manifest = JSON.parse(zip.readAsText('Version.json'));
  assert.deepEqual(manifest.desktopNovelOrder, [34, 5, 100, 8]);
  assert.deepEqual(parseBackup(archive).state.novels, books);
  // Older LNReader v2 files do not have desktopNovelOrder and must still work.
  const legacy = new AdmZip(archive);
  delete manifest.desktopNovelOrder;
  legacy.updateFile('Version.json', Buffer.from(JSON.stringify(manifest)));
  assert.equal(parseBackup(legacy.toBuffer()).state.novels.length, books.length);
});

test('v2 backup rejects tampered novel order without silently replacing the library', () => {
  const state = fixture();
  const zip = new AdmZip(createBackup(state));
  const version = JSON.parse(zip.readAsText('Version.json'));
  version.desktopNovelOrder = [7, 7];
  zip.updateFile('Version.json', Buffer.from(JSON.stringify(version)));
  assert.throws(() => parseBackup(zip.toBuffer()), /Ordem de obras inválida/);
});

test('Android v2 ZIP keeps its manifest and uses standard STORED for compressed chapter assets', () => {
  const state = fixture();
  const original = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array.from({ length: 1024 }, (_, i) => i % 256)]);
  state.files['Novels/test/7/9/photo.png'] = original.toString('base64');
  const archive = createBackup(state);
  const outer = new AdmZip(archive);
  assert.deepEqual(
    new Set(outer.getEntries().filter(e => !e.isDirectory).map(e => e.entryName)),
    new Set(['Version.json', 'NovelAndChapters/7.json', 'Category.json',
      'Setting.json', 'Plugins.json', 'plugins.zip', 'novel-files.zip', 'Covers/7']),
  );
  assert.equal(JSON.parse(outer.readAsText('Version.json')).formatVersion, 2);
  const downloaded = new AdmZip(outer.readFile('novel-files.zip'));
  assert.equal(downloaded.getEntry('test/7/9/photo.png').header.method, 0);
  assert.equal(downloaded.getEntry('test/7/9/index.html').header.method, 8);
  assert.deepEqual(downloaded.readFile('test/7/9/photo.png'), original);
  assert.deepEqual(parseBackup(archive).state, state);
});

test('legacy download zip skips non-LNReader payloads while maintaining the file budget', () => {
  const input = fixture();
  const zip = new AdmZip();
  zip.addFile('Version.json', Buffer.from(JSON.stringify({ version: '1.x' })));
  zip.addFile('Category.json', Buffer.from(JSON.stringify(input.categories)));
  zip.addFile('Setting.json', Buffer.from(JSON.stringify(input.settings)));
  zip.addFile('NovelAndChapters/7.json', Buffer.from(JSON.stringify(input.novels[0])));
  const inner = new AdmZip();
  inner.addFile('Novels/test/7/9/index.html', Buffer.from(input.files['Novels/test/7/9/index.html'], 'base64'));
  inner.addFile('Unused/large-cache.bin', Buffer.alloc(512 * 1024, 83));
  zip.addFile('download.zip', inner.toBuffer());
  const restored = parseBackup(zip.toBuffer());
  assert.equal(restored.state.files['Novels/test/7/9/index.html'], input.files['Novels/test/7/9/index.html']);
  assert.equal(Object.hasOwn(restored.state.files, 'Unused/large-cache.bin'), false);
});

test('wrapped Android settings-only backup works without plugin and download archives', () => {
  const data = new AdmZip();
  data.addFile('Version.json', Buffer.from(JSON.stringify({
    formatVersion: 2,
    sections: { library: false, settings: true, plugins: false, downloadedFiles: false },
  })));
  data.addFile('Setting.json', Buffer.from('{"readerTheme":"dark"}'));
  const wrapped = new AdmZip();
  wrapped.addFile('mobile-backup/data.zip', data.toBuffer());
  const restored = parseBackup(wrapped.toBuffer());
  assert.deepEqual(restored.state.settings, { readerTheme: 'dark' });
  assert.deepEqual(restored.missingSections, []);
});

test('wrapped Android plugin-only backup accepts its selected archives', () => {
  const state = fixture();
  const data = new AdmZip();
  data.addFile('Version.json', Buffer.from(JSON.stringify({
    formatVersion: 2,
    sections: { library: false, settings: false, plugins: true, downloadedFiles: false },
  })));
  data.addFile('Plugins.json', Buffer.from(JSON.stringify(state.plugins)));
  const plugins = new AdmZip();
  plugins.addFile('test/index.js', Buffer.from(state.files['Plugins/test/index.js'], 'base64'));
  const wrapped = new AdmZip();
  wrapped.addFile('data.zip', data.toBuffer());
  wrapped.addFile('plugins.zip', plugins.toBuffer());
  const restored = parseBackup(wrapped.toBuffer());
  assert.deepEqual(restored.state.plugins, state.plugins);
  assert.equal(restored.state.files['Plugins/test/index.js'], state.files['Plugins/test/index.js']);
  assert.deepEqual(restored.missingSections, []);
});

test('Android backup with missing metadata preserves the other selected sections', () => {
  const zip = new AdmZip(createBackup(fixture()));
  zip.deleteFile('Category.json');
  zip.deleteFile('Setting.json');
  zip.deleteFile('Plugins.json');
  const restored = parseBackup(zip.toBuffer());
  assert.equal(restored.state.novels.length, 1);
  assert.deepEqual(restored.missingSections, ['categories', 'settings', 'plugins']);
});

test('a wrapped Android backup still rejects archives required by selected sections', () => {
  const data = new AdmZip();
  data.addFile('Version.json', Buffer.from(JSON.stringify({
    formatVersion: 2,
    sections: { library: false, settings: false, plugins: true, downloadedFiles: false },
  })));
  data.addFile('Plugins.json', Buffer.from('[]'));
  const wrapped = new AdmZip();
  wrapped.addFile('data.zip', data.toBuffer());
  assert.throws(() => parseBackup(wrapped.toBuffer()), /plugins.zip/);
});

test('desktop repositories and plugin storage round-trip in Android-compatible v2', () => {
  const state = fixture();
  state.repositories = ['https://example.org/repo.json'];
  state.pluginStorage = { 'plugin_db:test_DB_saved': '{"value":"saved"}' };
  const zip = new AdmZip(createBackup(state));
  const manifest = JSON.parse(zip.readAsText('Version.json'));
  assert.deepEqual(manifest.desktopState.repositories, state.repositories);
  assert.deepEqual(manifest.desktopState.pluginStorage, state.pluginStorage);
  assert.deepEqual(parseBackup(zip.toBuffer()).state, state);
});

test('desktop novel-count marker detects a missing book in the ZIP', () => {
  const zip = new AdmZip(createBackup(fixture()));
  zip.deleteFile('NovelAndChapters/7.json');
  assert.throws(() => parseBackup(zip.toBuffer()), /Backup incompleto/);
});

test('metadata-only ZIP reports Android download section as absent and preserves progress', () => {
  const zip = new AdmZip(createBackup(fixture(), { downloadedFiles: false }));
  assert.equal(JSON.parse(zip.readAsText('Version.json')).sections.downloadedFiles, false);
  assert.equal(Boolean(zip.getEntry('novel-files.zip')), false);
  const parsed = parseBackup(zip.toBuffer());
  assert.equal(parsed.state.novels[0].chapters[0].isDownloaded, false);
  assert.equal(parsed.state.novels[0].chapters[0].progress, 0.4);
});

test('desktop export writes known Android equivalents without erasing native-only settings', () => {
  const state = fixture();
  state.settings = {
    desktopInterfaceLanguage: 'pt-BR', desktopTheme: 'oled',
    desktopPalette: 'lavender', desktopReaderAutoHide: false,
    desktopReaderHideDelay: 6.2,
    APP_SETTINGS: JSON.stringify({ timeTrackingEnabled: false }),
    CUSTOM_ACCENT_COLOR: '#fedcba',
  };
  const zip = new AdmZip(createBackup(state));
  const android = JSON.parse(zip.readAsText('Setting.json'));
  assert.equal(android.APP_LOCALE, 'pt-BR');
  assert.equal(android.THEME_MODE, 'dark');
  assert.equal(android.AMOLED_BLACK, true);
  assert.equal(android.APP_THEME_ID, undefined, 'custom Android accent must not be replaced by a palette');
  assert.deepEqual(JSON.parse(android.APP_SETTINGS), { timeTrackingEnabled: false });
  assert.equal(android.CUSTOM_ACCENT_COLOR, '#fedcba');
  assert.equal('desktopReaderAutoHide' in android, false);
  assert.equal('desktopReaderHideDelay' in android, false);
  assert.equal(JSON.parse(zip.readAsText('Version.json')).desktopState.originalSettings.desktopReaderHideDelay, 6.2);
  const parsed = parseBackup(zip.toBuffer());
  assert.equal(parsed.isDesktopBackup, true);
  assert.equal(parsed.state.settings.desktopInterfaceLanguage, 'pt-BR');
  assert.equal(parsed.state.settings.APP_LOCALE, undefined,
    'Restoring a Desktop archive must preserve the exact original settings, not its Android mirror');
  assert.equal(state.settings.APP_LOCALE, undefined, 'export cannot mutate live settings');
});

test('a Desktop backup keeps its original settings outside Android Setting.json', () => {
  const state = fixture();
  state.settings = {
    desktopInterfaceLanguage: 'pt-BR',
    desktopTheme: 'oled',
    desktopPalette: 'lavender',
    desktopReaderHideDelay: 7.5,
    desktopReaderAutoHide: false,
    LIBRARY_SETTINGS: JSON.stringify({ incognitoMode: true, sortOrder: 'recent' }),
    CUSTOM_ACCENT_COLOR: '#123456',
  };
  const zip = new AdmZip(createBackup(state));
  const android = JSON.parse(zip.readAsText('Setting.json'));
  const version = JSON.parse(zip.readAsText('Version.json'));
  assert.equal(Object.keys(android).some(k => k.startsWith('desktop')), false);
  assert.deepEqual(version.desktopState.originalSettings, state.settings);
  assert.deepEqual(parseBackup(zip.toBuffer()).state.settings, state.settings);
  assert.deepEqual(JSON.parse(android.LIBRARY_SETTINGS), {
    incognitoMode: true, sortOrder: 'recent',
  });
  // Original settings are retained even where a desktop approximation would differ.
  assert.equal(android.CUSTOM_ACCENT_COLOR, '#123456');
});

test('a self-exported Desktop archive is a true no-op when restored locally', () => {
  const { planRestore } = require('../src/restorePlan.cjs');
  const state = fixture();
  state.settings = {
    desktopInterfaceLanguage: 'pt-BR',
    desktopTheme: 'dark', desktopPalette: 'lavender',
    desktopReaderAutoHide: false, desktopReaderHideDelay: 8,
  };
  const restored = parseBackup(createBackup(state));
  assert.equal(restored.isDesktopBackup, true);
  assert.deepEqual(restored.state.settings, state.settings);
  const result = planRestore(state, restored);
  assert.equal(result.changed, false);
  assert.deepEqual(result.next, state);
});

test('rejects malformed optional original Desktop settings metadata', () => {
  const zip = new AdmZip(createBackup(fixture()));
  const manifest = JSON.parse(zip.readAsText('Version.json'));
  manifest.desktopState.originalSettings = [];
  zip.updateFile('Version.json', Buffer.from(JSON.stringify(manifest)));
  assert.throws(() => parseBackup(zip.toBuffer()), /Reader Desktop inválidos/);
});
