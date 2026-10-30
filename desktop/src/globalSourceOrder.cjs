// Show useful search results first; keep pending sources ahead of exhausted/failed ones.
// JavaScript's stable sort preserves the original source order inside each group.
function orderGlobalSearchRows(rows) {
  const priority = row =>
    row.items?.length > 0 ? 0 : row.pending || row.queued ? 1 : 2;
  return [...rows].sort((a, b) => priority(a) - priority(b));
}

module.exports = { orderGlobalSearchRows };
