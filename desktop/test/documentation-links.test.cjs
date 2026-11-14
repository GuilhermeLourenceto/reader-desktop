// Keep links within the repository valid as files are reorganized.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const directories = [root, path.join(root, 'desktop'), path.join(root, 'desktop/docs'), path.join(root, '.github')];
const markdownLink = /!?\[[^\]]+\]\(([^)]+)\)/g;

test('relative links in project markdown point to existing files or directories', () => {
  const broken = [];
  let inspected = 0;
  for (const directory of directories) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filename = path.join(directory, entry.name);
      const text = fs.readFileSync(filename, 'utf8');
      for (const match of text.matchAll(markdownLink)) {
        const raw = match[1].trim().replace(/^<|>$/g, '');
        if (/^(?:#|https?:\/\/|mailto:|data:|\/\/)/i.test(raw)) continue;
        let href = raw.split('#', 1)[0].split('?', 1)[0];
        if (!href) continue;
        try { href = decodeURIComponent(href); }
        catch { broken.push(path.relative(root, filename) + ': invalid URL encoding'); continue; }
        inspected++;
        const target = path.resolve(path.dirname(filename), href);
        if ((target !== root && !target.startsWith(root + path.sep)) || !fs.existsSync(target))
          broken.push(path.relative(root, filename) + ': ' + raw);
      }
    }
  }
  assert.ok(inspected >= 15, 'expected links from README and documentation');
  assert.deepEqual(broken, [], 'broken local markdown links');
});
