import { darkThemes, lightThemes } from '../../src/theme/md3/index';

// O índice do tema original não expõe nomes traduzidos para o desktop, então os
// rótulos ficam aqui na mesma ordem de `src/theme/md3/index.ts`.
const palettes = [
  ['default', 'Padrão'],
  ['midnight', 'Crepúsculo'],
  ['teal', 'Turquesa'],
  ['yotsuba', 'Yotsuba'],
  ['lavender', 'Lavanda'],
  ['strawberry', 'Morango'],
  ['tako', 'Tako'],
  ['catppuccin', 'Catppuccin'],
  ['yinyang', 'Yin Yang'],
];

export const appThemes = palettes.map(([id, name], index) => ({
  id,
  name,
  light: lightThemes[index],
  dark: darkThemes[index],
}));

export function appTheme(id, dark) {
  const theme = appThemes.find(item => item.id === id) || appThemes[0];
  return dark ? theme.dark : theme.light;
}
