const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const { parseBackup, createBackup } = require('./backup.cjs');
const { DiskFiles } = require('./storage.cjs');
try {
  const files = new DiskFiles(workerData.contentDirectory);
  if (workerData.action === 'export') {
    const exported = {},
      missing = [];
    let size = 0;
    // One pass instead of stat'ing the whole library and then reading it all
    // again. Every included blob is still verified by DiskFiles.read(SHA-256).
    for (const [name, value] of Object.entries(workerData.state.files)) {
      try {
        size += files.size(value);
        if (size > 512 * 1024 * 1024)
          throw new Error('Os arquivos excedem o limite de 512 MB do backup.');
        exported[name] = files.read(value);
      } catch (error) {
        if (!['ENOENT', 'CORRUPT_FILE'].includes(error.code)) throw error;
        missing.push(name);
      }
    }
    const missingChapters = new Set(
      missing
        .filter(name => name.startsWith('Novels/'))
        .map(name => name.split('/').slice(0, 4).join('/') + '/'),
    );
    const full = {
      ...workerData.state,
      files: exported,
      novels: workerData.state.novels.map(novel => {
        let changed = false;
        const chapters = novel.chapters.map(chapter => {
          const prefix = `Novels/${novel.pluginId}/${novel.id}/${chapter.id}/`;
          const downloaded = Boolean(
            chapter.isDownloaded &&
              Object.hasOwn(exported, prefix + 'index.html'),
          );
          const missingAssets = missingChapters.has(prefix);
          if (chapter.isDownloaded === downloaded &&
              (!missingAssets || chapter.desktopAssetsCached === false))
            return chapter;
          changed = true;
          return {
            ...chapter,
            isDownloaded: downloaded,
            ...(missingAssets ? { desktopAssetsCached: false } : {}),
          };
        });
        return changed ? { ...novel, chapters } : novel;
      }),
    };
    const temporary = workerData.filename + '.tmp';
    try {
      // Finish writing and flushing the archive before atomically publishing
      // it. A failed export must not overwrite the last valid backup.
      const archive = createBackup(full);
      const handle = fs.openSync(temporary, 'w');
      try {
        fs.writeFileSync(handle, archive);
        fs.fsyncSync(handle);
      } finally {
        fs.closeSync(handle);
      }
      fs.renameSync(temporary, workerData.filename);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    parentPort.postMessage({
      ok: true,
      result: { missingCount: missing.length },
    });
  } else {
    if (fs.statSync(workerData.filename).size > 512 * 1024 * 1024)
      throw new Error('Backup excede 512 MB');
    const restored = parseBackup(fs.readFileSync(workerData.filename), {
      storeFile: (_name, data) => files.write(data),
    });
    parentPort.postMessage({ ok: true, restored });
  }
} catch (error) {
  parentPort.postMessage({ ok: false, message: error.message });
}
