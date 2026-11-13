// Large LNReader ZIP backups, read/written in bounded streams (including ZIP64).
// Never materialize the archive or the downloaded chapter collection in RAM.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { randomUUID, createHash } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const AdmZip = require('adm-zip');
const unzipper = require('unzipper');
const { safePath, parseBackup } = require('./backup.cjs');
const { validateState } = require('./storage.cjs');
const { chapterPercent } = require('./domain.cjs');
const { BackupEntryName, ZipBackupName } = require('../vendor/lnreader/src/services/backup/types.ts');
const { resolveBackupOptions } = require('../vendor/lnreader/src/services/backup/options.ts');

const MAX_ENTRIES = 100000;
const MAX_METADATA_ENTRY = 128 * 1024 * 1024;
const MAX_METADATA_TOTAL = 384 * 1024 * 1024;
const MAX_OFFLINE_ENTRY = 2 * 1024 * 1024 * 1024;
const ALREADY_COMPRESSED = /\.(?:png|jpe?g|gif|webp|avif|heic|woff2?|mp3|m4a|ogg|mp4|webm|pdf|zip|epub|gz)$/i;

class ZipWriter {
  constructor(filename) {
    this.filename = filename;
    this.offset = 0;
    this.entries = [];
    this.handle = null;
  }
  async open() {
    this.handle = await fs.promises.open(this.filename, 'wx');
    return this;
  }
  async write(buffer) {
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesWritten } = await this.handle.write(
        buffer, offset, buffer.length - offset, this.offset,
      );
      if (!bytesWritten) throw new Error('Falha ao escrever o arquivo ZIP');
      this.offset += bytesWritten;
      offset += bytesWritten;
    }
  }
  async add(name, openSource, compressed = false, expectedHash, progress = () => {}) {
    safePath(name);
    const title = Buffer.from(name, 'utf8');
    if (title.length > 65535 || this.entries.length >= MAX_ENTRIES)
      throw new Error('Arquivo ZIP excede o limite de entradas ou nome');
    const offset = this.offset;
    const method = compressed ? 8 : 0;
    // ZIP64 local header and stream descriptor avoid pre-buffering the file.
    const header = Buffer.alloc(30 + title.length + 20);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(45, 4);
    header.writeUInt16LE(0x0808, 6); // UTF-8 + data descriptor
    header.writeUInt16LE(method, 8);
    header.writeUInt32LE(0xffffffff, 18);
    header.writeUInt32LE(0xffffffff, 22);
    header.writeUInt16LE(title.length, 26);
    header.writeUInt16LE(20, 28);
    title.copy(header, 30);
    header.writeUInt16LE(1, 30 + title.length);
    header.writeUInt16LE(16, 32 + title.length);
    await this.write(header);
    let crc = 0, plain = 0, packed = 0;
    const digest = createHash('sha256');
    const measure = new Transform({
      transform(chunk, _encoding, callback) {
        plain += chunk.length;
        crc = zlib.crc32(chunk, crc);
        digest.update(chunk);
        progress(chunk.length);
        callback(null, chunk);
      },
    });
    const input = openSource();
    const output = compressed
      ? input.pipe(measure).pipe(zlib.createDeflateRaw())
      : input.pipe(measure);
    // A failed source must reject the ZIP rather than emitting an unhandled
    // stream error or publishing an incomplete archive.
    input.on('error', error => output.destroy(error));
    if (compressed) measure.on('error', error => output.destroy(error));
    for await (const chunk of output) {
      packed += chunk.length;
      await this.write(chunk);
    }
    const hash = digest.digest('hex');
    if (expectedHash && expectedHash !== hash)
      throw new Error('Arquivo offline corrompido (SHA-256); exportação cancelada');
    const descriptor = Buffer.alloc(24);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(crc >>> 0, 4);
    descriptor.writeBigUInt64LE(BigInt(packed), 8);
    descriptor.writeBigUInt64LE(BigInt(plain), 16);
    await this.write(descriptor);
    this.entries.push({ title, offset, crc: crc >>> 0, plain, packed, method });
  }
  async finish() {
    const start = this.offset;
    for (const entry of this.entries) {
      const header = Buffer.alloc(46 + entry.title.length + 28);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(45, 4);
      header.writeUInt16LE(45, 6);
      header.writeUInt16LE(0x0808, 8);
      header.writeUInt16LE(entry.method, 10);
      header.writeUInt32LE(entry.crc, 16);
      header.writeUInt32LE(0xffffffff, 20);
      header.writeUInt32LE(0xffffffff, 24);
      header.writeUInt16LE(entry.title.length, 28);
      header.writeUInt16LE(28, 30);
      header.writeUInt32LE(0xffffffff, 42);
      entry.title.copy(header, 46);
      const index = 46 + entry.title.length;
      header.writeUInt16LE(1, index);
      header.writeUInt16LE(24, index + 2);
      header.writeBigUInt64LE(BigInt(entry.plain), index + 4);
      header.writeBigUInt64LE(BigInt(entry.packed), index + 12);
      header.writeBigUInt64LE(BigInt(entry.offset), index + 20);
      await this.write(header);
    }
    const centralSize = this.offset - start;
    const zip64Offset = this.offset;
    const end64 = Buffer.alloc(56);
    end64.writeUInt32LE(0x06064b50, 0);
    end64.writeBigUInt64LE(44n, 4);
    end64.writeUInt16LE(45, 12);
    end64.writeUInt16LE(45, 14);
    end64.writeBigUInt64LE(BigInt(this.entries.length), 24);
    end64.writeBigUInt64LE(BigInt(this.entries.length), 32);
    end64.writeBigUInt64LE(BigInt(centralSize), 40);
    end64.writeBigUInt64LE(BigInt(start), 48);
    await this.write(end64);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    locator.writeBigUInt64LE(BigInt(zip64Offset), 8);
    locator.writeUInt32LE(1, 16);
    await this.write(locator);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0xffff, 8);
    end.writeUInt16LE(0xffff, 10);
    end.writeUInt32LE(0xffffffff, 12);
    end.writeUInt32LE(0xffffffff, 16);
    await this.write(end);
    await this.handle.sync();
    await this.handle.close();
    this.handle = null;
  }
  async abort() {
    if (this.handle) {
      await this.handle.close();
      this.handle = null;
    }
  }
}

function sourceOf(files, value) {
  if (typeof value === 'string' && /^@file:[a-f0-9]{64}$/.test(value)) {
    return {
      open: () => fs.createReadStream(path.join(files.directory, value.slice(6))),
      hash: value.slice(6),
    };
  }
  return {
    open: () => Readable.from([Buffer.isBuffer(value) ? value : Buffer.from(value, 'base64')]),
  };
}

async function addJson(zip, name, data, progress) {
  const bytes = Buffer.from(JSON.stringify(data));
  await zip.add(name, () => Readable.from([bytes]), true, undefined, progress);
}

async function exportBackup({ state, contentDirectory, filename, includeDownloads = true, progress = () => {} }) {
  const workspace = await fs.promises.mkdtemp(
    path.join(path.dirname(filename), '.reader-backup-'),
  );
  const temp = filename + '.tmp';
  const files = { directory: contentDirectory };
  let count = 0;
  const addStored = async (zip, name, value, compress) => {
    if (++count > MAX_ENTRIES) throw new Error('Backup contém entradas demais');
    const { open, hash } = sourceOf(files, value);
    await zip.add(name, open, compress, hash, progress);
  };
  const nested = async (prefix, archive) => {
    const filename = path.join(workspace, archive);
    const zip = await new ZipWriter(filename).open();
    try {
      for (const [name, value] of Object.entries(state.files)) {
        if (!name.startsWith(prefix)) continue;
        const relative = safePath(name.slice(prefix.length));
        await addStored(zip, relative, value, !ALREADY_COMPRESSED.test(relative));
      }
      await zip.finish();
    } catch (error) {
      await zip.abort();
      throw error;
    }
    return filename;
  };
  try {
    // Validate every name, including files not selected for the archive.
    // Otherwise an invalid entry could be silently omitted.
    for (const name of Object.keys(state.files)) safePath(name);
    if (fs.existsSync(temp)) throw new Error('Exportação anterior ainda está em andamento');
    const pluginZip = await nested('Plugins/', ZipBackupName.PLUGINS);
    const novelZip = includeDownloads
      ? await nested('Novels/', ZipBackupName.NOVEL_FILES) : null;
    const zip = await new ZipWriter(temp).open();
    try {
      await addJson(zip, BackupEntryName.VERSION, {
        appVersion: require('../package.json').version,
        formatVersion: 2,
        sections: resolveBackupOptions({ downloadedFiles: includeDownloads }),
        desktopState: {
          repositories: state.repositories || [],
          pluginStorage: state.pluginStorage || {},
          progressUnit: state.progressUnit || 'percent',
        },
        desktopNovelCount: state.novels.length,
        desktopNovelOrder: state.novels.map(novel => novel.id),
      }, progress);
      for (const novel of state.novels) {
        const chapters = novel.chapters.map(chapter => {
          const converted = chapter.desktopProgressUnit
            ? { ...chapter, progress: chapterPercent(chapter), desktopProgressUnit: 'percent' }
            : chapter;
          return includeDownloads ? converted : { ...converted, isDownloaded: false,
            desktopAssetsCached: false };
        });
        await addJson(zip, 'NovelAndChapters/' + novel.id + '.json',
          { ...novel, chapters }, progress);
        if (++count > MAX_ENTRIES) throw new Error('Backup contém entradas demais');
      }
      await addJson(zip, BackupEntryName.CATEGORY, state.categories, progress);
      await addJson(zip, BackupEntryName.SETTING, state.settings, progress);
      await addJson(zip, BackupEntryName.PLUGIN_METADATA, state.plugins, progress);
      await zip.add(ZipBackupName.PLUGINS, () => fs.createReadStream(pluginZip),
        false, undefined, progress);
      if (novelZip) await zip.add(ZipBackupName.NOVEL_FILES,
        () => fs.createReadStream(novelZip), false, undefined, progress);
      for (const [name, value] of Object.entries(state.files)) {
        if (name.startsWith('Covers/'))
          await addStored(zip, name, value, false);
        else if (!includeDownloads && /^Novels\/[^/]+\/\d+\/cover\.png$/.test(name)) {
          const id = name.split('/')[2];
          if (!Object.hasOwn(state.files, 'Covers/' + id))
            await addStored(zip, 'Covers/' + id, value, false);
        }
      }
      await zip.finish();
    } catch (error) {
      await zip.abort();
      throw error;
    }
    await fs.promises.rename(temp, filename);
    return { missingCount: 0 };
  } finally {
    await fs.promises.rm(temp, { force: true }).catch(() => {});
    await fs.promises.rm(workspace, { recursive: true, force: true });
  }
}

function inspect(directory, budget) {
  const files = new Map();
  for (const entry of directory.files) {
    safePath(entry.path);
    if (++budget.count > MAX_ENTRIES) throw new Error('Backup contém mais de 100000 entradas');
    if (entry.type === 'Directory' || entry.path.endsWith('/')) continue;
    if (files.has(entry.path)) throw new Error('Backup contém arquivos duplicados');
    if (!Number.isSafeInteger(entry.uncompressedSize) ||
        !Number.isSafeInteger(entry.compressedSize) || entry.uncompressedSize < 0 ||
        entry.compressedSize < 0)
      throw new Error('Tamanho inválido no arquivo ZIP');
    if (entry.compressedSize === 0 && entry.uncompressedSize > 0)
      throw new Error('Arquivo ZIP suspeito (tamanhos inválidos)');
    if (entry.uncompressedSize > 64 * 1024 * 1024 &&
        entry.compressedSize > 0 &&
        entry.uncompressedSize / entry.compressedSize > 5000)
      throw new Error('Arquivo ZIP suspeito (expansão excessiva)');
    files.set(entry.path, entry);
  }
  return files;
}

async function copyEntry(entry, destination, limit, progress, returnBuffer = false) {
  if (entry.uncompressedSize > limit)
    throw new Error('Entrada ZIP excede o limite individual de segurança');
  if (destination && typeof fs.statfsSync === 'function') {
    const space = fs.statfsSync(path.dirname(destination));
    const free = BigInt(space.bavail) * BigInt(space.bsize);
    const required = BigInt(entry.uncompressedSize) + 128n * 1024n * 1024n;
    if (required > free)
      throw new Error('Espaço livre insuficiente para restaurar este backup');
  }
  let size = 0, crc = 0;
  const hash = createHash('sha256');
  const chunks = [];
  const verify = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      if (size > limit || size > entry.uncompressedSize) {
        callback(new Error('Entrada ZIP maior do que o declarado'));
        return;
      }
      crc = zlib.crc32(chunk, crc);
      hash.update(chunk);
      progress(chunk.length);
      if (returnBuffer) chunks.push(chunk);
      callback(null, chunk);
    },
  });
  if (returnBuffer) {
    await pipeline(entry.stream(), verify, new Transform({
      transform(_chunk, _encoding, callback) { callback(); },
    }));
  } else {
    await pipeline(entry.stream(), verify, fs.createWriteStream(destination, { flags: 'wx' }));
  }
  if (size !== entry.uncompressedSize)
    throw new Error('Entrada ZIP incompleta');
  const expected = entry.crc32 ?? entry.vars?.crc32;
  if (typeof expected !== 'number' || !Number.isSafeInteger(expected))
    throw new Error('Entrada ZIP sem CRC-32 verificável');
  if ((expected >>> 0) !== (crc >>> 0))
    throw new Error('CRC incorreto no backup');
  return returnBuffer ? Buffer.concat(chunks) : hash.digest('hex');
}

async function importBackup({ filename, contentDirectory, progress = () => {} }) {
  const workspace = await fs.promises.mkdtemp(
    path.join(contentDirectory, '.reader-import-'),
  );
  const budget = { count: 0 };
  const temporary = [];
  try {
    const outer = inspect(await unzipper.Open.file(filename), budget);
    let metadata = outer, prefix = '';
    if (!outer.has('Version.json')) {
      const candidates = [...outer.keys()].filter(name =>
        name === 'data.zip' || name.endsWith('/data.zip'));
      if (candidates.length !== 1) throw new Error('Backup sem Version.json');
      const dataName = candidates[0];
      prefix = dataName.slice(0, -'data.zip'.length);
      const allowed = new Set(['data.zip','plugins.zip','novel-files.zip','download.zip']
        .map(x => prefix + x));
      if ([...outer.keys()].some(name => !allowed.has(name)))
        throw new Error('Estrutura externa inválida');
      const nestedName = path.join(workspace, 'data.zip');
      await copyEntry(outer.get(dataName), nestedName, Number.MAX_SAFE_INTEGER, progress);
      metadata = inspect(await unzipper.Open.file(nestedName), budget);
    }
    const inner = new AdmZip();
    let metadataTotal = 0;
    const permitted = name => name === 'Version.json' ||
      name === 'Category.json' || name === 'Setting.json' ||
      name === 'Plugins.json' || /^NovelAndChapters\/[^/]+\.json$/.test(name);
    for (const [name, entry] of metadata) {
      if (!permitted(name)) continue;
      metadataTotal += entry.uncompressedSize;
      if (metadataTotal > MAX_METADATA_TOTAL)
        throw new Error('Metadados grandes demais para serem processados com segurança');
      const data = await copyEntry(entry, null, MAX_METADATA_ENTRY, progress, true);
      inner.addFile(name, data);
    }
    const version = JSON.parse(inner.readAsText('Version.json') || '{}');
    const isV2 = version.formatVersion === 2 && version.sections;
    const sections = resolveBackupOptions(isV2 ? version.sections : undefined);
    const required = isV2
      ? [
          ...(sections.plugins ? ['plugins.zip'] : []),
          ...(sections.downloadedFiles ? ['novel-files.zip'] : []),
        ]
      : ['download.zip'];
    for (const archive of required) {
      if (!outer.has(prefix + archive) && !metadata.has(archive))
        throw new Error('Backup sem ' + archive);
      // The in-memory parser only processes metadata, never actual downloaded data.
      inner.addFile(archive, new AdmZip().toBuffer());
    }
    const restored = parseBackup(inner.toBuffer());
    const store = async (name, entry) => {
      safePath(name);
      if (entry.uncompressedSize > MAX_OFFLINE_ENTRY)
        throw new Error('Arquivo individual offline excede 2 GiB');
      const tmp = path.join(workspace, randomUUID());
      const hash = await copyEntry(entry, tmp, MAX_OFFLINE_ENTRY, progress);
      const target = path.join(contentDirectory, hash);
      // Re-importing an identical immutable object must not overwrite it.
      // This also keeps its mtime stable and avoids touching shared chapters.
      let alreadyPresent = false;
      try {
        const existing = createHash('sha256');
        for await (const chunk of fs.createReadStream(target)) existing.update(chunk);
        alreadyPresent = existing.digest('hex') === hash;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (alreadyPresent) {
        await fs.promises.unlink(tmp);
      } else {
        await fs.promises.rename(tmp, target);
      }
      restored.state.files[name] = '@file:' + hash;
    };
    const importArchive = async (archive, base) => {
      const chosen = outer.get(prefix + archive) || metadata.get(archive);
      if (!chosen) throw new Error('Backup sem ' + archive);
      const nestedFile = path.join(workspace, randomUUID() + '.zip');
      await copyEntry(chosen, nestedFile, Number.MAX_SAFE_INTEGER, progress);
      const entries = inspect(await unzipper.Open.file(nestedFile), budget);
      for (const [name, entry] of entries) {
        const target = base ? base + name : name;
        if (base || target.startsWith('Novels/') || target.startsWith('Plugins/'))
          await store(target, entry);
      }
    };
    if (isV2) {
      if (sections.plugins) await importArchive('plugins.zip', 'Plugins/');
      if (sections.downloadedFiles) await importArchive('novel-files.zip', 'Novels/');
    } else {
      await importArchive('download.zip', '');
    }
    if (sections.library) {
      for (const [name, entry] of metadata)
        if (name.startsWith('Covers/'))
          await store(name, entry);
    }
    validateState(restored.state);
    return restored;
  } finally {
    await fs.promises.rm(workspace, { recursive: true, force: true });
  }
}

module.exports = { ZipWriter, exportBackup, importBackup };
