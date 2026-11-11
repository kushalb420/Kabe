import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_FILES, fontFor } from '../src/lib/fonts';

assert.equal(fontFor('800'), 'SpaceGrotesk_700Bold');
assert.equal(fontFor('700'), 'SpaceGrotesk_700Bold');
assert.equal(fontFor('bold'), 'SpaceGrotesk_700Bold');
assert.equal(fontFor(900), 'SpaceGrotesk_700Bold');
assert.equal(fontFor('600'), 'DMSans_700Bold');
assert.equal(fontFor('500'), 'DMSans_500Medium');
assert.equal(fontFor('400'), 'DMSans_400Regular');
assert.equal(fontFor('normal'), 'DMSans_400Regular');
assert.equal(fontFor(undefined), 'DMSans_400Regular');
assert.equal(fontFor('nonsense'), 'DMSans_400Regular');
for (const w of ['100', '300', '400', '500', '600', '700', '800', '900', 'bold', 'normal', undefined]) assert.ok((FONT_FILES as readonly string[]).includes(fontFor(w)), `font for ${w} is one we load`);

// every screen uses the app's Text (so every word gets the font), never react-native's own
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
for (const f of files.filter((x) => !/components[\\/]Text\.tsx$/.test(x))) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'react-native';/g)) {
    const names = m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]);
    assert.ok(!names.includes('Text') && !names.includes('TextInput'), `${f} imports Text/TextInput from react-native (use components/Text)`);
  }
}
console.log(`Font tests passed (${files.length} files checked).`);
