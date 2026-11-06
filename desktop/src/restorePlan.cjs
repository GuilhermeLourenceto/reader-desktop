// Keep selective backup restoration identical to the previous restore flow.
// This module is also used by unit tests without launching Electron.
const { isDeepStrictEqual } = require('node:util');
const { validateState } = require('./storage.cjs');

function planRestore(current, restored, importFiles = files => files) {
  const { state: backup, sections } = restored;
  const next = { ...current, files: { ...current.files } };

  if (sections.library) {
    next.novels = backup.novels;
    next.categories = backup.categories;
  }
  if (sections.settings)
    next.settings = { ...backup.settings, desktopOnboardingCompleted: true };
  if (sections.plugins) next.plugins = backup.plugins;

  // Restoring a selected section *replaces* it. Obsolete files must be
  // removed from the metadata, even if the rest of the backup is identical.
  for (const name of Object.keys(next.files)) {
    if (
      (sections.plugins && name.startsWith('Plugins/')) ||
      (sections.library &&
        (name.startsWith('Novels/') || name.startsWith('Covers/')))
    )
      delete next.files[name];
  }
  Object.assign(next.files, importFiles(backup.files));

  if (sections.library)
    next.novels = next.novels.map(novel => ({
      ...novel,
      chapters: novel.chapters.map(chapter => ({
        ...chapter,
        isDownloaded: Boolean(
          chapter.isDownloaded &&
            Object.hasOwn(
              next.files,
              `Novels/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`,
            ),
        ),
      })),
    }));

  const validated = validateState(next);
  return { next: validated, changed: !isDeepStrictEqual(current, validated) };
}

module.exports = { planRestore };
