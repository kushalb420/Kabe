import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND, THEMES } from '../src/config/app';
import { ACCENT_IDS, ACCENT_UNLOCK_LEVEL, Colors, baseColors, isAccentId, isAccentUnlocked, paletteFor } from '../src/palette';

// ---- every colour is a real colour, and the palette comes from the config ----
const HEX = /^#[0-9A-Fa-f]{6}$/;
for (const [k, v] of Object.entries(baseColors)) assert.ok(HEX.test(v), `${k} is not a colour: ${v}`);
assert.equal(baseColors.bg, BRAND.yellow, 'the page colour is the brand yellow from the config');
assert.equal(baseColors.primarySoft, BRAND.sage);

// ---- contrast (WCAG): text must be readable on what it sits on ----
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
assert.ok(Math.abs(contrast('#000000', '#FFFFFF') - 21) < 1e-9, 'contrast formula sanity');

// [text colour, background it is drawn on]
const PAIRS: [keyof Colors, keyof Colors][] = [
  ['ink', 'bg'], ['ink', 'card'], ['inkSoft', 'bg'], ['inkSoft', 'card'],
  ['onPrimary', 'primary'], // button labels and selected chips
  ['primary', 'card'], ['primary', 'bg'], ['primary', 'primarySoft'],
  ['primaryDark', 'card'], ['primaryDark', 'bg'], ['primaryDark', 'primarySoft'],
  ['danger', 'card'], ['danger', 'bg'], ['warn', 'card'], ['warn', 'bg'],
  ['good', 'card'], ['info', 'card'],
  ['ink', 'primarySoft'],
];
for (const id of ACCENT_IDS) {
  const p = paletteFor(id);
  assert.deepEqual(Object.keys(p).sort(), Object.keys(baseColors).sort(), `${id} defines every colour`);
  for (const [fg, bg] of PAIRS) assert.ok(contrast(p[fg], p[bg]) >= 4.5, `${id}: ${fg} on ${bg} is only ${contrast(p[fg], p[bg]).toFixed(2)}:1`);
  assert.ok(contrast('#FFFFFF', p.strong) >= 7, `${id}: white on the rest-timer bar`);
  assert.equal(paletteFor(id), p, 'palettes are cached, so screens do not re-render for nothing');
  assert.equal(p.card, baseColors.card, `${id}: a theme never changes cards`);
}
assert.equal(THEMES.length, ACCENT_IDS.length);
assert.equal(paletteFor('forest'), baseColors, 'the first theme is the base palette');
assert.notEqual(paletteFor('ocean').bg, baseColors.bg, 'a theme tints the page');
assert.equal(paletteFor('nonsense' as never), baseColors, 'an unknown theme falls back to the first');
assert.ok(isAccentId('berry') && !isAccentId('pink') && !isAccentId(null));
assert.equal(ACCENT_UNLOCK_LEVEL.forest, 1);
assert.ok(isAccentUnlocked('forest', 1) && !isAccentUnlocked('ocean', 2) && isAccentUnlocked('ocean', 3) && isAccentUnlocked('berry', 7) && !isAccentUnlocked('berry', 6));
// the saturated-fat colour must be tellable from the total-fat colour next to it
assert.notEqual(baseColors.satFat, baseColors.fat);
assert.ok(contrast(baseColors.satFat, baseColors.fat) > 1.5, 'saturated fat stands out from fat in the stacked bar');
// the page is light (this app has no dark mode)
assert.ok(lum(baseColors.bg) > 0.5);

// ---- every screen follows the theme: nobody uses a fixed colour object or a fixed white background ----
const files: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === 'node_modules' || f.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(f)) files.push(p);
  }
};
walk('app');
walk('src');
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  assert.ok(!/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*'[^']*\/theme'/.test(src), `${f} imports a fixed colors object (use useColors / useThemedStyles)`);
  assert.ok(!/backgroundColor:\s*'#fff(fff)?'/i.test(src), `${f} has a fixed white background (use colors.card)`);
  if (/useThemedStyles\(/.test(src) && !/\bmakeStyles\b\s*=/.test(src)) assert.fail(`${f} uses useThemedStyles but defines no makeStyles`);
  if (/\bstyles\./.test(src) && /StyleSheet\.create/.test(src)) assert.ok(/useThemedStyles\(makeStyles\)/.test(src), `${f} has styles that never get the palette`);
}
assert.ok(files.length > 30, 'the scan really covered the app');

console.log(`Theme tests passed (${Object.keys(baseColors).length} colours, ${PAIRS.length * ACCENT_IDS.length} contrast pairs, ${files.length} files scanned).`);
