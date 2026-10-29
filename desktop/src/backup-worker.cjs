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
    for (const value of Object.values(workerData.state.files)) {
      try {
        size += files.size(value);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    if (size > 512 * 1024 * 1024)
      throw new Error('Os arquivos excedem o limite de 512 MB do backup.');
    for (const [name, value] of Object.entries(workerData.state.files)) {
      try {
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
      novels: workerData.state.novels.map(novel => ({
        ...novel,
        chapters: novel.chapters.map(chapter => {
          const prefix = `Novels/${novel.pluginId}/${novel.id}/${chapter.id}/`;
          return {
            ...chapter,
            isDownloaded: Boolean(
              chapter.isDownloaded &&
                Object.hasOwn(exported, prefix + 'index.html'),
            ),
            ...(missingChapters.has(prefix)
              ? { desktopAssetsCached: false }
              : {}),
          };
        }),
      })),
    };
    fs.writeFileSync(workerData.filename + '.tmp', createBackup(full));
    fs.renameSync(workerData.filename + '.tmp', workerData.filename);
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
