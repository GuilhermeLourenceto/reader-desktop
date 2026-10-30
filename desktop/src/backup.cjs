const AdmZip = require('adm-zip');
const { chapterPercent } = require('./domain.cjs');
const { validateState } = require('./storage.cjs');
const {
  BackupEntryName,
  ZipBackupName,
} = require('../vendor/lnreader/src/services/backup/types.ts');
const {
  resolveBackupOptions,
} = require('../vendor/lnreader/src/services/backup/options.ts');
const { INSTALLED_PLUGINS_KEY } = require('../vendor/lnreader/src/plugins/constants.ts');

const MAX_BYTES = 512 * 1024 * 1024;
function safePath(name) {
  if (
    typeof name !== 'string' ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.startsWith('/') ||
    name.includes(':') ||
    name.split('/').some(part => part === '..' || part === '.')
  ) {
    throw new Error('Caminho inválido no backup');
  }
  return name;
}
function readArchive(buffer, budget, outer = false, onFile) {
  const zip = new AdmZip(buffer);
  const entries = new Map();
  const names = new Set();
  for (const entry of zip.getEntries()) {
    safePath(entry.entryName);
    if (
      !outer ||
      ![
        ZipBackupName.DATA,
        ZipBackupName.PLUGINS,
        ZipBackupName.NOVEL_FILES,
        ZipBackupName.DOWNLOAD,
      ].includes(entry.entryName.split('/').pop())
    )
      budget.size += entry.header.size;
    budget.count++;
    if (
      entry.header.size > MAX_BYTES ||
      budget.size > MAX_BYTES ||
      budget.count > 100000
    )
      throw new Error(
        'Backup excede o limite total de 512 MB descompactados ou 100000 entradas',
      );
    if (!entry.isDirectory) {
      if (names.has(entry.entryName))
        throw new Error('Entradas duplicadas no backup');
      names.add(entry.entryName);
      const data = entry.getData();
      if (onFile) onFile(entry.entryName, data);
      else entries.set(entry.entryName, data);
    }
  }
  return entries;
}
function unwrapBackup(entries, budget) {
  if (entries.has(BackupEntryName.VERSION)) return entries;

  const candidates = [];
  for (const name of entries.keys()) {
    const dataSuffix = `/${ZipBackupName.DATA}`;
    if (name !== ZipBackupName.DATA && !name.endsWith(dataSuffix)) continue;
    const prefix =
      name === ZipBackupName.DATA ? '' : name.slice(0, -dataSuffix.length + 1);
    const expected = [
      `${prefix}${ZipBackupName.DATA}`,
      `${prefix}${ZipBackupName.PLUGINS}`,
      `${prefix}${ZipBackupName.NOVEL_FILES}`,
    ];
    if (expected.every(entryName => entries.has(entryName)))
      candidates.push({ expected });
  }
  if (candidates.length === 0) return entries;
  if (candidates.length !== 1)
    throw new Error('Backup contém mais de uma estrutura de dados');

  const [{ expected }] = candidates;
  if (entries.size !== expected.length)
    throw new Error('Estrutura externa do backup inválida');
  const [dataName, pluginsName, novelFilesName] = expected;
  const normalized = readArchive(entries.get(dataName), budget);
  normalized.set(ZipBackupName.PLUGINS, entries.get(pluginsName));
  normalized.set(ZipBackupName.NOVEL_FILES, entries.get(novelFilesName));
  return normalized;
}
function emptyState() {
  return {
    novels: [],
    categories: [],
    settings: {},
    plugins: [],
    repositories: [],
    pluginStorage: {},
    files: {},
    progressUnit: 'percent',
  };
}
function parseBackup(
  buffer,
  { storeFile = (_name, data) => data.toString('base64') } = {},
) {
  const budget = { size: 0, count: 0 };
  const entries = unwrapBackup(readArchive(buffer, budget, true), budget);
  const json = (name, fallback) =>
    entries.has(name)
      ? JSON.parse(entries.get(name).toString('utf8'))
      : fallback;
  const version = json(BackupEntryName.VERSION, {});
  if (version.formatVersion && ![1, 2].includes(version.formatVersion))
    throw new Error('Versão de backup não suportada');
  const sections = resolveBackupOptions(
    version.formatVersion === 2 ? version.sections : undefined,
  );
  const state = emptyState();
  if (sections.library) {
    const novelEntries = [...entries].filter(
      ([name]) =>
        name.startsWith(`${BackupEntryName.NOVEL_AND_CHAPTERS}/`) &&
        name.endsWith('.json'),
    );
    if (!entries.has(BackupEntryName.CATEGORY))
      throw new Error('Backup sem Category.json');
    const ids = new Set();
    for (const [, content] of novelEntries) {
      const novel = JSON.parse(content.toString('utf8'));
      if (
        !Number.isSafeInteger(novel.id) ||
        typeof novel.name !== 'string' ||
        typeof novel.pluginId !== 'string' ||
        typeof novel.path !== 'string' ||
        !Array.isArray(novel.chapters) ||
        ids.has(novel.id)
      )
        throw new Error('Novel inválida no backup');
      safePath(novel.pluginId);
      ids.add(novel.id);
      state.novels.push(novel);
    }
    // AdmZip lists NovelAndChapters/*.json by ZIP filename, so without an
    // explicit order a large library can silently reorder after restoration.
    // This optional field lives in the existing v2 manifest, not a new ZIP
    // member, keeping original LNReader readers able to ignore the extension.
    if (version.desktopNovelOrder !== undefined) {
      const order = version.desktopNovelOrder;
      if (!Array.isArray(order) || order.length !== state.novels.length)
        throw new Error('Ordem de obras inválida no backup');
      const ranks = new Map();
      for (const id of order) {
        if (!Number.isSafeInteger(id) || ranks.has(id))
          throw new Error('Ordem de obras inválida no backup');
        ranks.set(id, ranks.size);
      }
      if (state.novels.some(novel => !ranks.has(novel.id)))
        throw new Error('Ordem de obras inválida no backup');
      state.novels.sort((a, b) => ranks.get(a.id) - ranks.get(b.id));
    }
    state.categories = json(BackupEntryName.CATEGORY, []);
    if (!Array.isArray(state.categories))
      throw new Error('Categorias inválidas');
  }
  if (sections.settings) state.settings = json(BackupEntryName.SETTING, {});
  if (
    !state.settings ||
    typeof state.settings !== 'object' ||
    Array.isArray(state.settings)
  )
    throw new Error('Configurações inválidas');
  if (sections.plugins) {
    const registry = state.settings[INSTALLED_PLUGINS_KEY] || [];
    state.plugins = json(
      BackupEntryName.PLUGIN_METADATA,
      typeof registry === 'string' ? JSON.parse(registry) : registry,
    );
    if (
      !Array.isArray(state.plugins) ||
      state.plugins.some(
        plugin =>
          typeof plugin.id !== 'string' || typeof plugin.url !== 'string',
      )
    )
      throw new Error('Registro de plugins inválido');
    delete state.settings[INSTALLED_PLUGINS_KEY];
  }
  const addFiles = (archive, prefix, select = () => true) => {
    if (!entries.has(archive)) throw new Error(`Backup sem ${archive}`);
    readArchive(entries.get(archive), budget, false, (name, data) => {
      if (select(name))
        state.files[safePath(prefix + name)] = storeFile(prefix + name, data);
    });
    entries.delete(archive);
  };
  if (version.formatVersion === 2) {
    if (sections.plugins) addFiles(ZipBackupName.PLUGINS, 'Plugins/');
    if (sections.downloadedFiles)
      addFiles(ZipBackupName.NOVEL_FILES, 'Novels/');
  } else {
    addFiles(
      ZipBackupName.DOWNLOAD,
      '',
      name => name.startsWith('Plugins/') || name.startsWith('Novels/'),
    );
  }
  for (const [name, data] of entries) {
    if (name.startsWith(`${BackupEntryName.COVERS}/`))
      state.files[name] = storeFile(name, data);
  }
  validateState(state);
  return { state, sections };
}
function createBackup(state) {
  const bytes = value =>
    Buffer.isBuffer(value) ? value : Buffer.from(value, 'base64');
  const { files, ...metadata } = state;
  const size = Object.values(files).reduce(
    (total, value) =>
      total +
      (Buffer.isBuffer(value)
        ? value.length
        : Buffer.byteLength(value, 'base64')),
    Buffer.byteLength(JSON.stringify(metadata)) + 1024,
  );
  if (size > MAX_BYTES)
    throw new Error(
      'Os dados excedem o limite de 512 MB deste formato de backup.',
    );
  const zip = new AdmZip();
  const addJSON = (name, value) =>
    zip.addFile(name, Buffer.from(JSON.stringify(value)));
  addJSON(BackupEntryName.VERSION, {
    appVersion: require('../package.json').version,
    formatVersion: 2,
    sections: resolveBackupOptions(),
    // Backwards-compatible, optional metadata. Preserve exactly the user's
    // library ordering instead of relying on ZIP directory enumeration.
    desktopNovelOrder: state.novels.map(novel => novel.id),
  });
  zip.addFile(`${BackupEntryName.NOVEL_AND_CHAPTERS}/`, Buffer.alloc(0));
  for (const novel of state.novels)
    addJSON(`${BackupEntryName.NOVEL_AND_CHAPTERS}/${novel.id}.json`, {
      ...novel,
      chapters: novel.chapters.map(chapter =>
        chapter.desktopProgressUnit
          ? {
              ...chapter,
              progress: chapterPercent(chapter),
              desktopProgressUnit: 'percent',
            }
          : chapter,
      ),
    });
  addJSON(BackupEntryName.CATEGORY, state.categories);
  addJSON(BackupEntryName.SETTING, state.settings);
  addJSON(BackupEntryName.PLUGIN_METADATA, state.plugins);
  for (const [prefix, archive] of [
    ['Plugins/', ZipBackupName.PLUGINS],
    ['Novels/', ZipBackupName.NOVEL_FILES],
  ]) {
    const nested = new AdmZip();
    for (const [name, content] of Object.entries(state.files)) {
      safePath(name);
      if (name.startsWith(prefix))
        nested.addFile(name.slice(prefix.length), bytes(content));
    }
    // ZIP members are already compressed; storing the container avoids a second pass.
    zip.addFile(archive, nested.toBuffer());
    zip.getEntry(archive).header.method = 0;
  }
  for (const [name, content] of Object.entries(state.files)) {
    if (name.startsWith(`${BackupEntryName.COVERS}/`)) {
      zip.addFile(safePath(name), bytes(content));
      // Covers are image files, normally already compressed.
      zip.getEntry(name).header.method = 0;
    }
  }
  return zip.toBuffer();
}
module.exports = { safePath, emptyState, parseBackup, createBackup };
