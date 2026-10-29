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
