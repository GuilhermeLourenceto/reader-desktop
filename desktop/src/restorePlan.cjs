// Non-destructive restore for LNReader Android and Reader Desktop archives.
const { isDeepStrictEqual } = require('node:util');
const { validateState } = require('./storage.cjs');
const { fromAndroidPreferences } = require('./state/backupPreferences.cjs');

function allocateIds(existing, incoming) {
  const used = new Set(existing.filter(Number.isSafeInteger));
  let next = 1;
  for (const id of [...existing, ...incoming])
    if (Number.isSafeInteger(id)) next = Math.max(next, id + 1);
  return preferred => {
    if (Number.isSafeInteger(preferred) && preferred >= 0 && !used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    while (used.has(next)) next++;
    if (!Number.isSafeInteger(next)) throw new Error('Não há IDs disponíveis');
    used.add(next);
    return next++;
  };
}

function planRestore(current, restored, importFiles = files => files,
  rewriteHtml = (_name, value) => value) {
  const { state: backup, sections } = restored;
  const missing = new Set(restored.missingSections || []);
  const restoreLibrary = sections.library && !missing.has('library');
  const restorePlugins = sections.plugins && !missing.has('plugins');
  const next = { ...current, files: { ...current.files } };
  const sourceBooks = new Map();
  const sourceIds = new Map();

  if (restoreLibrary) {
    const allocateNovel = allocateIds(
      current.novels.map(n => n.id), backup.novels.map(n => n.id));
    const allocateChapter = allocateIds(
      current.novels.flatMap(n => n.chapters.map(c => c.id)),
      backup.novels.flatMap(n => n.chapters.map(c => c.id)));
    const novels = [...current.novels];
    const positions = new Map(novels.map((novel, i) => [novel.id, i]));
    const bySource = new Map(novels.map(n => [JSON.stringify([n.pluginId, n.path]), n]));
    const seen = new Set();

    for (const novel of backup.novels) {
      const identity = JSON.stringify([novel.pluginId, novel.path]);
      if (seen.has(identity)) throw new Error('Obras duplicadas no backup');
      seen.add(identity);
      const previous = bySource.get(identity);
      const id = previous ? previous.id : allocateNovel(novel.id);
      const oldChapters = new Map((previous?.chapters || []).map(c => [c.path, c]));
      const chapters = [], chapterIds = new Map(), chapterPaths = new Set();
      for (const chapter of novel.chapters) {
        if (chapterPaths.has(chapter.path)) throw new Error('Capítulos duplicados no backup');
        chapterPaths.add(chapter.path);
        const old = oldChapters.get(chapter.path);
        const chapterId = old ? old.id : allocateChapter(chapter.id);
        const merged = { ...old, ...chapter, id: chapterId };
        if (old?.novelId != null || chapter.novelId != null) merged.novelId = id;
        chapters.push(merged);
        chapterIds.set(chapter.id, chapterId);
      }
      for (const old of previous?.chapters || [])
        if (!chapterPaths.has(old.path)) chapters.push(old);
      const merged = { ...previous, ...novel, id, chapters };
      if (previous) novels[positions.get(previous.id)] = merged;
      else {
        positions.set(id, novels.length);
        novels.push(merged);
      }
      bySource.set(identity, merged);
      sourceBooks.set(novel.pluginId + '/' + novel.id, {
        oldNovelId: novel.id, novelId: id, chapterIds,
      });
      sourceIds.set(novel.id, id);
    }
    next.novels = novels;

    if (!missing.has('categories')) {
      const categories = [...current.categories];
      const allocateCategory = allocateIds(
        current.categories.map(c => c.id), backup.categories.map(c => c.id));
      for (const category of backup.categories) {
        const ids = [...new Set(category.novelIds.map(id => sourceIds.get(id))
          .filter(id => id !== undefined))];
        const position = categories.findIndex(c => c.name === category.name);
        if (position < 0) {
          categories.push({ ...category, id: allocateCategory(category.id), novelIds: ids });
        } else {
          categories[position] = {
            ...categories[position],
            novelIds: [...new Set([...categories[position].novelIds, ...ids])],
          };
        }
      }
      next.categories = categories;
    }
  }

  if (sections.settings && !missing.has('settings')) {
    const settings = { ...current.settings, ...backup.settings };
    // Desktop options are local to this installation; Android does not own them.
    for (const key of Object.keys(settings)) {
      if (!key.startsWith('desktop')) continue;
      if (Object.hasOwn(current.settings, key)) settings[key] = current.settings[key];
      else delete settings[key];
    }
    // Apply only exact Android equivalents. Unavailable or unknown values
    // must never reset local Desktop choices such as auto-hide controls.
    if (!restored.isDesktopBackup)
      Object.assign(settings, fromAndroidPreferences(backup.settings));
    // Onboarding completion belongs to this installation, not the archive.
    next.settings = settings;
  }

  if (restorePlugins) {
    const plugins = [...current.plugins];
    const installed = new Set(plugins.map(plugin => plugin.id));
    for (const plugin of backup.plugins) {
      if (!installed.has(plugin.id)) {
        plugins.push(plugin);
        installed.add(plugin.id);
      }
    }
    next.plugins = plugins;
  }
  next.repositories = [...new Set([...current.repositories, ...backup.repositories])];
  next.pluginStorage = { ...backup.pluginStorage, ...current.pluginStorage };

  const imported = importFiles(backup.files);
  for (const [name, value] of Object.entries(imported)) {
    if (restorePlugins && name.startsWith('Plugins/')) {
      if (!Object.hasOwn(next.files, name)) next.files[name] = value;
      continue;
    }
    if (!restoreLibrary) continue;
    if (name.startsWith('Covers/')) {
      const oldId = Number(name.slice(7));
      if (sourceIds.has(oldId)) {
        const target = 'Covers/' + sourceIds.get(oldId);
        if (!Object.hasOwn(next.files, target)) next.files[target] = value;
      }
      continue;
    }
    const match = /^Novels\/([^/]+)\/(\d+)\/(.*)$/.exec(name);
    if (!match) continue;
    const [, pluginId, sourceNovelId, remainder] = match;
    const mapping = sourceBooks.get(pluginId + '/' + sourceNovelId);
    if (!mapping) continue;
    let translated = remainder;
    const chapterFile = /^(\d+)\/(.*)$/.exec(remainder);
    if (chapterFile) {
      const newId = mapping.chapterIds.get(Number(chapterFile[1]));
      if (newId === undefined) continue;
      translated = newId + '/' + chapterFile[2];
    }
    const target = 'Novels/' + pluginId + '/' + mapping.novelId + '/' + translated;
    if (Object.hasOwn(next.files, target)) continue;
    let content = value;
    if (name.endsWith('/index.html')) {
      const replacements = [...mapping.chapterIds]
        .filter(([oldId, newId]) => mapping.oldNovelId !== mapping.novelId || oldId !== newId)
        .map(([oldId, newId]) => ({
          from: '/Novels/' + pluginId + '/' + mapping.oldNovelId + '/' + oldId + '/',
          to: '/Novels/' + pluginId + '/' + mapping.novelId + '/' + newId + '/',
        }));
      if (replacements.length) content = rewriteHtml(name, value, replacements);
    }
    next.files[target] = content;
  }

  if (restoreLibrary) {
    const oldDownloaded = new Map(current.novels.flatMap(novel =>
      novel.chapters.map(chapter => [
        novel.pluginId + '/' + novel.id + '/' + chapter.id,
        chapter.isDownloaded === true,
      ])));
    next.novels = next.novels.map(novel => ({
      ...novel,
      chapters: novel.chapters.map(chapter => {
        const key = 'Novels/' + novel.pluginId + '/' + novel.id + '/' +
          chapter.id + '/index.html';
        const present = Object.hasOwn(next.files, key);
        const oldDownloadedKey = novel.pluginId + '/' + novel.id + '/' + chapter.id;
        const downloaded = present && (chapter.isDownloaded === true ||
          oldDownloaded.get(oldDownloadedKey) === true);
        return chapter.isDownloaded === downloaded
          ? chapter : { ...chapter, isDownloaded: downloaded };
      }),
    }));
  }
  const validated = validateState(next);
  return { next: validated, changed: !isDeepStrictEqual(current, validated) };
}

module.exports = { planRestore };
