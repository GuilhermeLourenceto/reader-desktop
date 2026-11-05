import { parse } from '@babel/parser';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { messages } = require('../src/locales.cjs');
// Translate only source-code literals. Never inspect the DOM or novel data.
export const localization = {
  name: 'interface-messages',
  setup(build) {
    build.onLoad({ filter: /[\\/]src[\\/].+\.jsx$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
      const edits = [];
      function visit(node, parent, key) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'JSXText') {
          const text = node.value.replace(/\s+/g, ' ').trim();
          if (messages[text]) {
            const leading = /^[ \t]/.test(node.value.split(/\r?\n/)[0])
              ? ' '
              : '';
            const trailing =
              /[ \t]$/.test(node.value.split(/\r?\n/).at(-1)) &&
              !/^[ \t]*$/.test(node.value.split(/\r?\n/).at(-1))
                ? ' '
                : '';
            edits.push([
              node.start,
              node.end,
              `{${JSON.stringify(leading)} + __uiT(${JSON.stringify(text)}) + ${JSON.stringify(trailing)}}`,
            ]);
          }
        } else if (node.type === 'StringLiteral' && messages[node.value]) {
          if (parent?.type !== 'ObjectProperty' || key !== 'key') {
            const replacement = `__uiT(${JSON.stringify(node.value)})`;
            edits.push([
              node.start,
              node.end,
              parent?.type === 'JSXAttribute'
                ? `{${replacement}}`
                : replacement,
            ]);
          }
        }
        for (const [childKey, value] of Object.entries(node)) {
          if (['loc', 'extra', 'start', 'end'].includes(childKey)) continue;
          if (Array.isArray(value))
            value.forEach((child) => visit(child, node, childKey));
          else if (value && typeof value === 'object')
            visit(value, node, childKey);
        }
      }
      visit(ast);
      let contents = source;
      for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0]))
        contents = contents.slice(0, start) + value + contents.slice(end);
      // JSX components may live in nested feature folders.
      // Resolve i18n relative to each file instead of assuming src/*.jsx.
      const relativeI18n = relative(dirname(args.path), resolve('src/i18n.cjs'))
        .replace(/\\/g, '/');
      const i18nImport = relativeI18n.startsWith('.') ? relativeI18n : './' + relativeI18n;
      return {
        contents: `import { t as __uiT } from '${i18nImport}';\n${contents}`,
        loader: 'jsx',
      };
    });
  },
};
