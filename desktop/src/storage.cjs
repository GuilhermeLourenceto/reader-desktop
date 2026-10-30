const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const isReference = value =>
  typeof value === 'string' && /^@file:[a-f0-9]{64}$/.test(value);

class DiskFiles {
  constructor(directory) {
    this.directory = directory;
    fs.mkdirSync(directory, { recursive: true });
  }
  write(buffer) {
    const hash = createHash('sha256').update(buffer).digest('hex');
    const target = path.join(this.directory, hash);
    if (
      !fs.existsSync(target) ||
      createHash('sha256').update(fs.readFileSync(target)).digest('hex') !==
        hash
    ) {
      const temporary = target + '.' + randomUUID() + '.tmp';
      try {
        const handle = fs.openSync(temporary, 'wx');
        try {
          fs.writeFileSync(handle, buffer);
          fs.fsyncSync(handle);
        } finally {
          fs.closeSync(handle);
        }
        try {
          fs.renameSync(temporary, target);
        } catch (error) {
          // Another writer may already have published this immutable blob.
          // Windows can reject replacing it while that writer is reading it.
          if (
            !fs.existsSync(target) ||
            createHash('sha256')
              .update(fs.readFileSync(target))
              .digest('hex') !== hash
          )
            throw error;
        }
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
    }
    return '@file:' + hash;
  }
  read(value) {
    if (!isReference(value)) return Buffer.from(value, 'base64');
    const buffer = fs.readFileSync(path.join(this.directory, value.slice(6)));
    if (createHash('sha256').update(buffer).digest('hex') !== value.slice(6)) {
      const error = new Error(
        'Arquivo baixado corrompido. Baixe o capítulo novamente.',
      );
      error.code = 'CORRUPT_FILE';
      throw error;
    }
    return buffer;
  }
  import(files) {
    return Object.fromEntries(
      Object.entries(files).map(([name, value]) => [
        name,
        isReference(value) ? value : this.write(Buffer.from(value, 'base64')),
      ]),
    );
  }
  size(value) {
    return isReference(value)
      ? fs.statSync(path.join(this.directory, value.slice(6))).size
      : Buffer.byteLength(value, 'base64');
  }
  export(files, select = () => true, ignoreMissing = false) {
    const output = {};
    for (const [name, value] of Object.entries(files)) {
      if (!select(name)) continue;
      try {
        output[name] = this.read(value).toString('base64');
      } catch (error) {
        if (!ignoreMissing || error.code !== 'ENOENT') throw error;
      }
    }
    return output;
  }
  prune(files, previousFiles = {}) {
    const retained = new Set(
      [...Object.values(files), ...Object.values(previousFiles)]
        .filter(isReference)
        .map(value => value.slice(6)),
    );
    for (const name of fs.readdirSync(this.directory)) {
      if (/^[a-f0-9]{64}(?:\.tmp)?$/.test(name) && !retained.has(name))
        fs.unlinkSync(path.join(this.directory, name));
    }
  }
}

function validateState(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    !Array.isArray(input.novels) ||
    !Array.isArray(input.plugins)
  )
    throw new Error('Biblioteca inválida');
  const state = {
    categories: [],
    settings: {},
    repositories: [],
    pluginStorage: {},
    files: {},
    ...input,
  };
  for (const key of ['categories', 'repositories'])
    if (!Array.isArray(state[key])) throw new Error(`Dados inválidos: ${key}`);
  for (const key of ['settings', 'files', 'pluginStorage'])
    if (
      !state[key] ||
      typeof state[key] !== 'object' ||
      Array.isArray(state[key])
    )
      throw new Error(`Dados inválidos: ${key}`);
  const ids = new Set();
  for (const novel of state.novels) {
    if (
      !novel ||
      !Number.isSafeInteger(novel.id) ||
      novel.id < 0 ||
      ids.has(novel.id) ||
      typeof novel.name !== 'string' ||
      typeof novel.path !== 'string' ||
      typeof novel.pluginId !== 'string' ||
      !Array.isArray(novel.chapters)
    )
      throw new Error('Obra inválida na biblioteca');
    ids.add(novel.id);
    for (const field of ['author', 'status', 'summary', 'cover'])
      if (novel[field] != null && typeof novel[field] !== 'string')
        throw new Error(`Metadado inválido na biblioteca: ${field}`);
    if (
      novel.genres != null &&
      typeof novel.genres !== 'string' &&
      (!Array.isArray(novel.genres) ||
        novel.genres.some(value => typeof value !== 'string'))
    )
      throw new Error('Gêneros inválidos na biblioteca');
    if (
      novel.totalPages != null &&
      (!Number.isSafeInteger(Number(novel.totalPages)) ||
        Number(novel.totalPages) < 0 ||
        Number(novel.totalPages) > 10000)
    )
      throw new Error('Paginação inválida na biblioteca');
    const chapterIds = new Set();
    for (const chapter of novel.chapters) {
      if (
        !chapter ||
        !Number.isSafeInteger(chapter.id) ||
        chapter.id < 0 ||
        chapterIds.has(chapter.id) ||
        typeof chapter.path !== 'string' ||
        typeof chapter.name !== 'string'
      )
        throw new Error('Capítulo inválido na biblioteca');
      chapterIds.add(chapter.id);
    }
  }
  if (
    state.plugins.some(
      plugin =>
        !plugin ||
        typeof plugin.id !== 'string' ||
        typeof plugin.url !== 'string' ||
        ['name', 'lang', 'version', 'site', 'iconUrl'].some(
          key => plugin[key] != null && typeof plugin[key] !== 'string',
        ),
    )
  )
    throw new Error('Fonte inválida na biblioteca');
  if (
    state.categories.some(
      category =>
        !category ||
        typeof category.name !== 'string' ||
        !Array.isArray(category.novelIds),
    )
  )
    throw new Error('Categoria inválida na biblioteca');
  if (Object.values(state.files).some(value => typeof value !== 'string'))
    throw new Error('Arquivos inválidos na biblioteca');
  if (state.repositories.some(value => typeof value !== 'string'))
    throw new Error('Repositórios inválidos');
  if (
    Object.entries(state.pluginStorage).some(
      ([key, value]) =>
        !key.startsWith('plugin_db:') || typeof value !== 'string',
    )
  )
    throw new Error('Cache das fontes inválido');
  for (const [key, minimum, maximum] of [
    ['desktopFontSize', 14, 40],
    ['desktopLineHeight', 1.2, 2.6],
    ['desktopReaderWidth', 500, 1200],
    ['desktopPageStep', 0, 100],
  ]) {
    const value = state.settings[key];
    if (
      value != null &&
      (!Number.isFinite(value) || value < minimum || value > maximum)
    )
      throw new Error(`Configuração inválida: ${key}`);
  }
  for (const key of [
    'desktopFontFamily',
    'desktopReaderTheme',
    'desktopTheme',
    'desktopTextAlign',
    'desktopCoverSize',
    'desktopPalette',
    'desktopPagination',
  ])
    if (state.settings[key] != null && typeof state.settings[key] !== 'string')
      throw new Error(`Configuração inválida: ${key}`);
  if (
    state.settings.desktopPagination != null &&
    !['scroll', 'pages'].includes(state.settings.desktopPagination)
  )
    throw new Error('Configuração inválida: desktopPagination');
  return state;
}

function writeState(filename, state) {
  const temporary = filename + '.tmp';
  const handle = fs.openSync(temporary, 'w');
  try {
    fs.writeFileSync(handle, JSON.stringify(state));
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  if (fs.existsSync(filename)) fs.copyFileSync(filename, filename + '.bak');
  fs.renameSync(temporary, filename);
}

function readState(filename, fallback) {
  const candidates = [filename, filename + '.bak', filename + '.tmp'];
  let failure;
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const state = validateState(
        JSON.parse(fs.readFileSync(candidate, 'utf8')),
      );
      if (candidate !== filename) {
        if (fs.existsSync(filename))
          fs.copyFileSync(filename, filename + `.corrupt-${Date.now()}`);
        fs.copyFileSync(candidate, filename);
      }
      return { state, recovered: candidate !== filename };
    } catch (error) {
      failure = error;
    }
  }
  if (failure)
    throw new Error(
      'Não foi possível ler a biblioteca nem sua cópia de recuperação. Os arquivos foram preservados.',
      { cause: failure },
    );
  return { state: fallback(), recovered: false };
}
module.exports = { DiskFiles, validateState, writeState, readState };
