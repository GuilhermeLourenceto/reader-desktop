function markNewChapters(previous, chapters, timestamp) {
  const known = new Set(previous.map(chapter => chapter.path));
  return chapters.map(chapter =>
    known.has(chapter.path) ? chapter : { ...chapter, updatedTime: timestamp },
  );
}
function updateGroups(novels) {
  const groups = new Map();
  for (const novel of novels.filter(novel => novel.inLibrary)) {
    for (const chapter of novel.chapters) {
      const time = Date.parse(chapter.updatedTime);
      if (!Number.isFinite(time)) continue;
      const date = new Date(time);
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(date.getDate()).padStart(2, '0')}`;
      const key = `${novel.id}:${day}`;
      if (!groups.has(key))
        groups.set(key, { key, day, time, novel, chapters: [] });
      const group = groups.get(key);
      group.time = Math.max(group.time, time);
      group.chapters.push(chapter);
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.day.localeCompare(a.day) || b.time - a.time || a.novel.id - b.novel.id,
  );
}
module.exports = { markNewChapters, updateGroups };
