// Deterministic ordering for the backup chooser and its "latest" shortcut.
// Never rely exclusively on the order supplied by a Drive API response.
function createdAtMillis(file) {
  const time = Date.parse(file?.createdTime || '');
  return Number.isFinite(time) ? time : 0;
}
function sortDriveBackups(backups) {
  return [...backups].sort((a, b) =>
    createdAtMillis(b) - createdAtMillis(a) ||
    String(b.name || '').localeCompare(String(a.name || '')) ||
    String(a.id || '').localeCompare(String(b.id || '')),
  );
}
module.exports = { sortDriveBackups, createdAtMillis };
