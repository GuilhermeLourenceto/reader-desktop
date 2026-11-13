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
function readArchive(buffer, budget, outer = false, onFile, shouldExtract = () => true) {
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
      // Legacy download.zip may include unrelated files. Count and validate
      // every ZIP member, but do not inflate a payload that will be discarded.
      if (!shouldExtract(entry.entryName)) continue;
      const data = entry.getData();
      if (onFile) onFile(entry.entryName, data);
      else entries.set(entry.entryName, data);
    }
  }
  return entries;
}
function unwrapBackup(entries, budget) {
  if (entries.has(BackupEntryName.VERSION)) return entries;

  const candidates = [...entries.keys()].filter(
    name => name === ZipBackupName.DATA || name.endsWith(`/${ZipBackupName.DATA}`),
  );
  if (candidates.length === 0) return entries;
  if (candidates.length !== 1)
    throw new Error('Backup contém mais de uma estrutura de dados');

  const dataName = candidates[0];
  const prefix = dataName.slice(0, -ZipBackupName.DATA.length);
  const archiveNames = [
    ZipBackupName.DATA,
    ZipBackupName.PLUGINS,
    ZipBackupName.NOVEL_FILES,
    ZipBackupName.DOWNLOAD,
  ];
  const allowed = new Set(archiveNames.map(name => prefix + name));
  if ([...entries.keys()].some(name => !allowed.has(name)))
    throw new Error('Estrutura externa do backup inválida');

  // Android includes only the archives selected in the backup options.
  // A settings-only or plugins-only backup need not contain novel-files.zip.
  const normalized = readArchive(entries.get(dataName), budget);
  for (const archiveName of archiveNames.slice(1)) {
    if (entries.has(prefix + archiveName))
      normalized.set(archiveName, entries.get(prefix + archiveName));
  }
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
function parseBackup(buffer, options = {}) {
  const budget = { size: 0, count: 0 };
  const entries = unwrapBackup(readArchive(buffer, budget, true), budget);
  return parseBackupEntries(entries, options, budget);
}
// Streamed imports pass CRC-verified metadata directly, without another ZIP in RAM.
function parseBackupEntries(
  entries,
  { storeFile = (_name, data) => data.toString('base64'),
    streamedArchives = false, preparsedNovels } = {},
  budget = { size: 0, count: 0 },
) {
  const missingSections = [];
  const json = (name, fallback) =>
    entries.has(name)
      ? JSON.parse(entries.get(name).toString('utf8'))
      : fallback;
  const version = json(BackupEntryName.VERSION, {});
  if (version.formatVersion && ![1, 2].includes(version.formatVersion))
    throw new Error('Versão de backup não suportada');
  // Android interprets v2 without a section manifest as a legacy backup.
  const formatVersion = version.formatVersion === 2 && version.sections ? 2 : 1;
  const sections = resolveBackupOptions(
    formatVersion === 2 ? version.sections : undefined,
  );
  const state = emptyState();
  // Optional Reader Desktop metadata in the original Android v2 manifest.
  if (version.desktopState !== undefined) {
    const value = version.desktopState;
    if (
      !value || typeof value !== 'object' || Array.isArray(value) ||
      !Array.isArray(value.repositories) ||
      value.repositories.some(url => typeof url !== 'string') ||
      !value.pluginStorage || typeof value.pluginStorage !== 'object' ||
      Array.isArray(value.pluginStorage) ||
      Object.entries(value.pluginStorage).some(
        ([key, text]) => !key.startsWith('plugin_db:') || typeof text !== 'string',
      ) ||
      (value.progressUnit !== undefined && value.progressUnit !== 'percent')
    ) throw new Error('Dados do Reader Desktop inválidos no backup');
    state.repositories = value.repositories;
    state.pluginStorage = value.pluginStorage;
    state.progressUnit = value.progressUnit || 'percent';
  }
  if (sections.library) {
    const importedNovels = preparsedNovels ?? [...entries].filter(
      ([name]) =>
        name.startsWith(`${BackupEntryName.NOVEL_AND_CHAPTERS}/`) &&
        name.endsWith('.json'),
    ).map(([, content]) => JSON.parse(content.toString('utf8')));
    if (
      version.desktopNovelCount !== undefined &&
      (!Number.isSafeInteger(version.desktopNovelCount) ||
        version.desktopNovelCount !== importedNovels.length)
    ) throw new Error('Backup incompleto: quantidade de obras divergente');
    if (!entries.has(BackupEntryName.CATEGORY))
      missingSections.push('categories');
    const ids = new Set();
    for (const novel of importedNovels) {
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
  if (sections.settings) {
    if (!entries.has(BackupEntryName.SETTING))
      missingSections.push('settings');
    state.settings = json(BackupEntryName.SETTING, {});
  }
  if (
    !state.settings ||
    typeof state.settings !== 'object' ||
    Array.isArray(state.settings)
  )
    throw new Error('Configurações inválidas');
  if (sections.plugins) {
    const registry = state.settings[INSTALLED_PLUGINS_KEY];
    if (!entries.has(BackupEntryName.PLUGIN_METADATA) && registry == null)
      missingSections.push('plugins');
    state.plugins = json(
      BackupEntryName.PLUGIN_METADATA,
      typeof registry === 'string' ? JSON.parse(registry) : registry ?? [],
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
    if (!streamedArchives)
      readArchive(entries.get(archive), budget, false, (name, data) => {
        state.files[safePath(prefix + name)] = storeFile(prefix + name, data);
      }, select);
    entries.delete(archive);
  };
  if (formatVersion === 2) {
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
  if (!streamedArchives)
    for (const [name, data] of entries) {
      if (name.startsWith(`${BackupEntryName.COVERS}/`))
        state.files[name] = storeFile(name, data);
    }
  validateState(state);
  return { state, sections, missingSections };
}
function createBackup(state, { downloadedFiles = true } = {}) {
  const bytes = value =>
    Buffer.isBuffer(value) ? value : Buffer.from(value, 'base64');
  const { files, ...metadata } = state;
  // A single pass validates paths, enforces the size budget, and groups files.
  // The Android v2 manifest, entries, and nested ZIP layout remain unchanged.
  const groups = { plugins: [], novels: [], covers: [] };
  let size = Buffer.byteLength(JSON.stringify(metadata)) + 1024;
  let entryCount = state.novels.length + 8;
  for (const [name, value] of Object.entries(files)) {
    safePath(name);
    if (!downloadedFiles && name.startsWith('Novels/')) continue;
    size += Buffer.isBuffer(value)
      ? value.length
      : Buffer.byteLength(value, 'base64');
    entryCount++;
    if (size > MAX_BYTES || entryCount > 100000)
      throw new Error('O backup excede o limite de 512 MB ou 100000 entradas.');
    if (name.startsWith('Plugins/')) groups.plugins.push([name, value]);
    else if (name.startsWith('Novels/')) groups.novels.push([name, value]);
    else if (name.startsWith(`${BackupEntryName.COVERS}/`))
      groups.covers.push([name, value]);
  }
  const zip = new AdmZip();
  const addJSON = (name, value) =>
    zip.addFile(name, Buffer.from(JSON.stringify(value)));
  addJSON(BackupEntryName.VERSION, {
    appVersion: require('../package.json').version,
    formatVersion: 2,
    sections: resolveBackupOptions({ downloadedFiles }),
    desktopState: {
      repositories: state.repositories || [],
      pluginStorage: state.pluginStorage || {},
      progressUnit: state.progressUnit || 'percent',
    },
    desktopNovelCount: state.novels.length,
    // Backwards-compatible, optional metadata. Preserve exactly the user's
    // library ordering instead of relying on ZIP directory enumeration.
    desktopNovelOrder: state.novels.map(novel => novel.id),
  });
  zip.addFile(`${BackupEntryName.NOVEL_AND_CHAPTERS}/`, Buffer.alloc(0));
  for (const novel of state.novels)
    addJSON(`${BackupEntryName.NOVEL_AND_CHAPTERS}/${novel.id}.json`, {
      ...novel,
      chapters: novel.chapters.map(chapter => {
        const saved = chapter.desktopProgressUnit
          ? { ...chapter, progress: chapterPercent(chapter), desktopProgressUnit: 'percent' }
          : chapter;
        return downloadedFiles ? saved : { ...saved, isDownloaded: false };
      }),
    });
  addJSON(BackupEntryName.CATEGORY, state.categories);
  addJSON(BackupEntryName.SETTING, state.settings);
  addJSON(BackupEntryName.PLUGIN_METADATA, state.plugins);
  for (const [prefix, archive, group] of [
    ['Plugins/', ZipBackupName.PLUGINS, groups.plugins],
    ['Novels/', ZipBackupName.NOVEL_FILES, groups.novels],
  ]) {
    if (archive === ZipBackupName.NOVEL_FILES && !downloadedFiles) continue;
    const nested = new AdmZip();
    for (const [name, content] of group) {
      const relativeName = name.slice(prefix.length);
      nested.addFile(relativeName, bytes(content));
      // A standard ZIP STORED entry avoids wasting CPU deflating JPEG, PNG,
      // WebP and other already-compressed assets. HTML, JS and text keep ZIP
      // DEFLATE for compact Android-compatible chapter exports.
      if (/\.(?:png|jpe?g|gif|webp|avif|heic|woff2?|mp3|m4a|ogg|mp4|webm|pdf|zip|epub|gz)$/i.test(relativeName))
        nested.getEntry(relativeName).header.method = 0;
    }
    zip.addFile(archive, nested.toBuffer());
    // A ZIP inside a ZIP is already compressed.
    zip.getEntry(archive).header.method = 0;
  }
  for (const [name, content] of groups.covers) {
    zip.addFile(name, bytes(content));
    zip.getEntry(name).header.method = 0;
  }
  const result = zip.toBuffer();
  // Never emit a file that the Reader Desktop import worker itself refuses.
  if (result.length > MAX_BYTES)
    throw new Error('O arquivo ZIP excede o limite de 512 MB.');
  return result;
}
module.exports = { safePath, emptyState, parseBackup, parseBackupEntries, createBackup };
