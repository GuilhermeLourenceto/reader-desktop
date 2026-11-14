const languages = [
  ['pt-BR', 'Português (Brasil)'],
  ['en', 'English'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['it', 'Italiano'],
  ['ru', 'Русский'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['zh-CN', '简体中文'],
];
const rows = require('./i18n/core.cjs').trim().split('\n').map(row => row.split('|'));
rows.push(
  ...require('./i18n/catalogs/locale-details.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./i18n/catalogs/locale-help.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./i18n/catalogs/locale-errors.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./i18n/catalogs/locale-dynamic.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./i18n/catalogs/locale-theme-labels.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./i18n/catalogs/locale-dialogs.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./i18n/catalogs/locale-library-ux.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(...require('./i18n/catalogs/locale-reader-desktop.cjs').trim().split('\n').map(row => row.split('|')));
rows.push(...require('./i18n/catalogs/locale-diagnostics.cjs').trim().split('\n').map(row => row.split('|')));
const messages = Object.fromEntries(
  rows.map((row) => [
    row[0],
    Object.fromEntries(languages.map(([code], index) => [code, row[index]])),
  ]),
);
for (const [key, alias] of Object.entries({
  'Resetar leitura da obra': 'Resetar leitura',
  'Marcar como lido': 'Marcar lido',
  'Marcar como não lido': 'Marcar não lido',
  'Apagar download do capítulo': 'Apagar download',
  'Apagar download da atualização': 'Apagar download',
  'Baixar atualização': 'Baixar capítulo',
  'Capítulo lido': 'Lido',
  'Carregando mais capítulos': 'Carregando mais capítulos…',
  'Tentar carregar capítulos novamente': 'Tentar novamente',
  'Tentar capítulo novamente': 'Tentar novamente',
  'Carregando LNReader': 'Carregando LNReader…',
  'Controles do leitor': 'Ajustes de leitura',
  'Prévia do leitor em tamanho real': 'Prévia da leitura',
}))
  messages[key] = { ...messages[alias], 'pt-BR': key };
module.exports = { languages, messages };
