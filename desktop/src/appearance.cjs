// Preserve all nine palette accents but give OLED a truly black canvas.
const OLED_NEUTRALS = Object.freeze({
  background: '#000000',
  surface: '#000000',
  surfaceVariant: '#181818',
  outlineVariant: '#343434',
  backdrop: 'rgba(0, 0, 0, 0.72)',
});

function resolveAppearance(preference, systemIsDark) {
  const oled = preference === 'oled';
  const dark = oled || (preference === 'system' ? Boolean(systemIsDark) : preference !== 'light');
  return { dark, mode: oled ? 'oled' : dark ? 'dark' : 'light' };
}

function appearanceColors(palette, paletteId, mode) {
  const oled = mode === 'oled';
  const colors = oled ? { ...palette, ...OLED_NEUTRALS } : { ...palette };
  const customPalette = paletteId && paletteId !== 'default';
  return {
    ...colors,
    surfaceContainer: oled
      ? '#0b0b0b'
      : customPalette
        ? `color-mix(in srgb, ${palette.surface} 94%, ${palette.onSurface})`
        : mode === 'dark' ? '#24252c' : '#f1f2fa',
    surfaceContainerHigh: oled
      ? '#151515'
      : customPalette
        ? `color-mix(in srgb, ${palette.surface} 88%, ${palette.onSurface})`
        : mode === 'dark' ? '#2d2e36' : '#e7e8f1',
    readerBackground: colors.background,
    readerText: colors.onBackground,
  };
}

module.exports = { resolveAppearance, appearanceColors, OLED_NEUTRALS };
