const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveAppearance, appearanceColors } = require('../src/appearance.cjs');

test('OLED is distinct from normal dark and ignores the system light preference', () => {
  assert.deepEqual(resolveAppearance('oled', false), { mode: 'oled', dark: true });
  assert.deepEqual(resolveAppearance('oled', true), { mode: 'oled', dark: true });
  assert.deepEqual(resolveAppearance('system', false), { mode: 'light', dark: false });
  assert.deepEqual(resolveAppearance('system', true), { mode: 'dark', dark: true });
  assert.deepEqual(resolveAppearance('light', true), { mode: 'light', dark: false });
  assert.deepEqual(resolveAppearance('dark', false), { mode: 'dark', dark: true });
});

const names = ['default', 'midnight', 'teal', 'yotsuba', 'lavender', 'strawberry', 'tako', 'catppuccin', 'yinyang'];
for (const id of names) {
  const palette = {
    background: 'rgb(27, 27, 31)',
    surface: 'rgb(27, 27, 31)',
    surfaceVariant: 'rgb(45, 45, 49)',
    outlineVariant: 'rgb(63, 64, 70)',
    onSurface: 'rgb(230, 230, 235)',
    onBackground: 'rgb(226, 226, 230)',
    primary: 'rgb(177, 197, 255)',
    onPrimary: 'rgb(0, 44, 112)',
    secondaryContainer: 'rgb(60, 60, 70)',
  };
  test(`OLED neutral surfaces remain truly black while ${id} accents survive`, () => {
    const original = JSON.parse(JSON.stringify(palette));
    const oled = appearanceColors(palette, id, 'oled');
    assert.equal(oled.background, '#000000');
    assert.equal(oled.surface, '#000000');
    assert.equal(oled.readerBackground, '#000000');
    assert.equal(oled.readerText, palette.onBackground);
    assert.equal(oled.surfaceContainer, '#0b0b0b');
    assert.equal(oled.surfaceContainerHigh, '#151515');
    assert.equal(oled.primary, palette.primary);
    assert.equal(oled.onPrimary, palette.onPrimary);
    assert.equal(oled.secondaryContainer, palette.secondaryContainer);
    assert.deepEqual(palette, original, 'Must not mutate vendor themes');
    const dark = appearanceColors(palette, id, 'dark');
    assert.equal(dark.background, palette.background, 'Leaving OLED restores original dark palette');
    assert.notEqual(dark.surfaceContainer, oled.surfaceContainer);
    const light = appearanceColors(palette, id, 'light');
    assert.equal(light.background, palette.background, 'Non-OLED appearance stays unchanged');
  });
}
