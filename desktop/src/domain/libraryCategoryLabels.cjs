const { t } = require('../i18n.cjs');

// These names are the stock categories shown by imported LNReader libraries.
// Translate only their DISPLAY labels. Never rewrite category names or IDs in
// the stored library or backups, and never translate user-defined categories.
const BUILTIN_CATEGORY_NAMES = new Set(['Padrão', 'Localização']);

function categoryDisplayName(name, language) {
  if (typeof name !== 'string') return '';
  return BUILTIN_CATEGORY_NAMES.has(name) ? t(name, {}, language) : name;
}

module.exports = { categoryDisplayName };
