import { presetReaderThemes } from '../vendor/lnreader/src/utils/constants/readerConstants';

const originalNames = [
  ['original-light', 'Claro original'],
  ['original-sepia', 'Sépia original'],
  ['original-green', 'Verde suave'],
  ['original-dark', 'Escuro original'],
  ['amoled', 'Preto AMOLED'],
];
export const readerThemes = [
  { id: 'app', name: 'Seguir aplicativo' },
  {
    id: 'dark',
    name: 'Escuro',
    backgroundColor: '#25252f',
    textColor: '#d5d1d8',
  },
  {
    id: 'light',
    name: 'Claro',
    backgroundColor: '#fffdf8',
    textColor: '#292728',
  },
  {
    id: 'sepia',
    name: 'Sépia',
    backgroundColor: '#f0e5cf',
    textColor: '#4b3e2d',
  },
  ...presetReaderThemes.map((theme, index) => ({
    ...theme,
    id: originalNames[index][0],
    name: originalNames[index][1],
  })),
];
