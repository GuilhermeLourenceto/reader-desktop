const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');
const { languages, messages } = require('../src/locales.cjs');

const sourceDir = path.join(__dirname, '../src');
const sampleExemptions = {
  'features/reader/ReaderPreview.jsx': new Set([
    'Capítulo 1 — Uma nova história',
    'A luz da manhã atravessava a janela quando ela abriu o livro. Lá fora, a cidade despertava lentamente, mas entre aquelas páginas havia um mundo inteiro esperando.',
    'O caminho seguia entre as árvores, dobrando a cada descoberta. Nada parecia urgente: havia tempo para observar os detalhes, ouvir o vento e escolher a próxima direção.',
    '— Toda jornada começa com uma primeira página — disse o viajante.',
    'Ela sorriu e continuou a leitura. Algumas histórias não precisavam de pressa; precisavam apenas de espaço para acontecer.',
  ]),
  'ReaderThemes.jsx': new Set(['Aa']), // Typography specimen, not a phrase
  'features/settings/Settings.jsx': new Set(['LNReader', 'LNReader Desktop', 'Reader Desktop', 'Desktop ·']),
  'features/onboarding/Onboarding.jsx': new Set(['Reader Desktop']),
  'renderer.jsx': new Set(['https://…/plugins.json', '×', 'A−', 'A+']),
};

// Check components in nested folders as well as the root of src/.
function listJsxFiles(directory = sourceDir, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) return listJsxFiles(path.join(directory, entry.name), relative);
    return entry.isFile() && entry.name.endsWith('.jsx') ? [relative] : [];
  });
}

function collectSourceLabels(file) {
  const source = fs.readFileSync(path.join(sourceDir, file), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const labels = new Set();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXText') {
      const label = node.value.replace(/\s+/g, ' ').trim();
      if (label && /[A-Za-zÀ-ÿ\u0400-\u04ff]/.test(label)) labels.add(label);
    }
    if (
      node.type === 'JSXAttribute' &&
      ['placeholder', 'aria-label', 'title'].includes(node.name?.name) &&
      node.value?.type === 'StringLiteral'
    ) labels.add(node.value.value);
    for (const [field, value] of Object.entries(node)) {
      if (['loc', 'extra', 'start', 'end'].includes(field)) continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  return labels;
}

test('every visible literal JSX label in Desktop is localized, except sample novel text or branding', () => {
  const missing = [];
  let verified = 0;
  for (const file of listJsxFiles()) {
    for (const label of collectSourceLabels(file)) {
      if (sampleExemptions[file]?.has(label)) continue;
      if (!messages[label]) {
        missing.push(file + ': ' + label);
        continue;
      }
      for (const [locale] of languages)
        assert.ok(typeof messages[label][locale] === 'string' && messages[label][locale].trim(),
          file + ': ' + label + ' missing ' + locale);
      verified++;
    }
  }
  assert.deepEqual(missing, [], 'Untranslated UI labels detected');
  assert.ok(verified >= 100, 'Localization audit should inspect at least 100 labels');
});
