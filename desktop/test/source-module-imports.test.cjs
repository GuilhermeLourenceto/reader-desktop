// Verify source-relative imports after feature-folder refactors.
// The check is dependency-free and runs as part of npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../src');
const extensions = ['', '.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx', '.json'];
const indexExtensions = ['index.js', 'index.jsx', 'index.cjs', 'index.ts', 'index.tsx'];

function* sources(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* sources(filename);
    else if (/\\.(?:js|jsx|cjs|mjs)$/.test(filename)) yield filename;
  }
}

function existsImport(base) {
  return extensions.some(ext => {
    const filename = base + ext;
    return fs.existsSync(filename) && fs.statSync(filename).isFile();
  }) || indexExtensions.some(file => fs.existsSync(path.join(base, file)));
}

test('every source-relative import resolves after module reorganization', () => {
  const unresolved = [];
  let imports = 0;
  const expression = /(?:\\bfrom\\s*|\\brequire\\s*\\(\\s*|\\bimport\\s*\\(\\s*)['"](\\.\\.?\\/[^'"]+)['"]/g;
  for (const filename of sources(root)) {
    const content = fs.readFileSync(filename, 'utf8');
    for (const match of content.matchAll(expression)) {
      const target = path.resolve(path.dirname(filename), match[1]);
      imports++;
      if (!existsImport(target))
        unresolved.push(path.relative(root, filename) + ': ' + match[1]);
    }
  }
  assert.ok(imports > 40, 'expected to inspect relative imports');
  assert.deepEqual(unresolved, [], 'Broken source imports');
});
