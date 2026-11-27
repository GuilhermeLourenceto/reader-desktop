// Guard the original stylesheet bytes through future file relocations.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const styleParts = ["00-foundation.css","10-navigation-and-library.css","20-reader-and-settings.css","30-novel-and-chapters.css","40-history-and-updates.css","50-filters-and-responsive.css"];
function checksum(text) {
  let value = 2166136261;
  for (let i=0; i<text.length; i++)
    value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  return value.toString(16).padStart(8,'0');
}
test('modular styles preserve the reviewed CSS cascade before onboarding', () => {
  const css = styleParts.map(file => readFileSync(path.join(root, 'src/styles', file), 'utf8')).join('');
  assert.equal(css.length, 45787);
  assert.equal(checksum(css), 'ce20c7f2');
  assert.ok(css.includes('.reader-view') && css.includes('.settings-group') && css.includes('.source'));
});
