// Applies corrections from a reviewed docs/translations-review.csv back into the app.
// Fill the "corrected Hindi / Telugu / Tamil" columns for any text you changed, then run:
//   npx tsx scripts/apply-translations.ts [path/to/file.csv]
//   (add --dry to only list what would change)
// Only rows of kind "text" are applied. Recipe names and steps are edited in src/i18n/recipeText.ts.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const file = args.find((a) => !a.startsWith('--')) ?? 'docs/translations-review.csv';

/** Minimal CSV reader (quotes, doubled quotes, commas and line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  const src = text.replace(/^[﻿]+/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const LANGS = ['hi', 'te', 'ta'] as const;

const rows = parseCsv(readFileSync(file, 'utf8'));
const header = rows.shift() ?? [];
const col = (name: string) => header.indexOf(name);
const iKind = col('kind');
const iKey = col('key');
const iEn = col('English');
const cols = { hi: [col('Hindi'), col('corrected Hindi')], te: [col('Telugu'), col('corrected Telugu')], ta: [col('Tamil'), col('corrected Tamil')] } as const;
if ([iKind, iKey, iEn, ...Object.values(cols).flat()].some((i) => i < 0)) throw new Error('This does not look like translations-review.csv (columns are missing).');

const files = [...readdirSync('src/i18n/parts').filter((f) => f.endsWith('.ts')).map((f) => `src/i18n/parts/${f}`), 'src/i18n/hi.ts', 'src/i18n/te.ts', 'src/i18n/ta.ts'];
const originals = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const sources = new Map(files.map((f) => [f, originals.get(f)!.replace(/\r\n/g, '\n')]));
let changed = 0;
let skipped = 0;

for (const r of rows) {
  if (r[iKind] !== 'text') continue;
  const key = r[iKey];
  for (const lang of LANGS) {
    const [, iNew] = cols[lang];
    const value = (r[iNew] ?? '').trim();
    if (!value) continue;
    if (placeholders(value) !== placeholders(r[iEn])) {
      console.log(`SKIPPED ${lang} ${key}: the {placeholders} differ from English`);
      skipped++;
      continue;
    }
    let done = false;
    for (const [f, src] of sources) {
      const re = new RegExp(`^(\\s*)'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': .*$`, 'gm');
      if (!re.test(src)) continue;
      // parts files hold all four languages: only touch the block of this language
      const isBase = /\/(hi|te|ta)\.ts$/.test(f);
      if (isBase && !f.endsWith(`/${lang}.ts`)) continue;
      let next = src;
      if (isBase) next = src.replace(re, (_m, ind) => `${ind}'${key}': ${JSON.stringify(value)},`);
      else {
        next = src
          .split(/(?=^  (?:en|hi|te|ta): \{)/m)
          .map((chunk) => (chunk.startsWith(`  ${lang}: {`) ? chunk.replace(re, (_m, ind) => `${ind}'${key}': ${JSON.stringify(value)},`) : chunk))
          .join('');
      }
      if (next !== src) {
        sources.set(f, next);
        done = true;
        break;
      }
    }
    if (done) {
      changed++;
      console.log(`${dry ? 'would change' : 'changed'} ${lang} ${key}`);
    } else {
      console.log(`SKIPPED ${lang} ${key}: not found in the app`);
      skipped++;
    }
  }
}
// only files whose text really changed are written back (line endings of other files are left alone)
if (!dry) for (const [f, src] of sources) if (src !== originals.get(f)!.replace(/\r\n/g, '\n')) writeFileSync(f, src);
console.log(`${dry ? 'Would apply' : 'Applied'} ${changed} correction(s), skipped ${skipped}. Run npm test afterwards.`);
