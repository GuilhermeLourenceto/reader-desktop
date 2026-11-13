const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = path.resolve(__dirname, '../src');
const modulePattern = /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g;

function modules(folder) {
  return fs.readdirSync(path.join(src, folder), { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:cjs|js|mjs)$/.test(entry.name))
    .map(entry => path.join(src, folder, entry.name));
}

test('domain rules do not depend on React, Electron or presentation', () => {
  const files = modules('domain');
  assert.ok(files.length >= 7, 'expected domain rule files');
  const violations = [];
  for (const filename of files) {
    const code = fs.readFileSync(filename, 'utf8');
    for (const [, specifier] of code.matchAll(modulePattern)) {
      const relative = specifier.startsWith('.')
        ? path.resolve(path.dirname(filename), specifier)
        : specifier;
      if (/^(react(?:-dom)?|electron)(?:\/|$)/.test(specifier) ||
          relative.startsWith(path.join(src, 'features') + path.sep) ||
          relative.startsWith(path.join(src, 'components') + path.sep) ||
          relative === path.join(src, 'renderer.jsx') ||
          relative === path.join(src, 'main.cjs')) {
        violations.push(path.relative(src, filename) + ': ' + specifier);
      }
    }
    if (/\b(?:window|document|localStorage|sessionStorage)\b/.test(code))
      violations.push(path.relative(src, filename) + ': browser global');
  }
  assert.deepEqual(violations, []);
});

test('privileged infrastructure does not import UI layers', () => {
  const files = modules('infrastructure');
  assert.ok(files.length >= 2, 'expected infrastructure files');
  const violations = [];
  for (const filename of files) {
    const code = fs.readFileSync(filename, 'utf8');
    for (const [, specifier] of code.matchAll(modulePattern)) {
      const target = specifier.startsWith('.')
        ? path.resolve(path.dirname(filename), specifier)
        : specifier;
      if (/^(react(?:-dom)?)(?:\/|$)/.test(specifier) ||
          target.startsWith(path.join(src, 'features') + path.sep) ||
          target.startsWith(path.join(src, 'components') + path.sep) ||
          target === path.join(src, 'renderer.jsx')) {
        violations.push(path.relative(src, filename) + ': ' + specifier);
      }
    }
  }
  assert.deepEqual(violations, []);
});
