// Writes docs/translations-review.csv: every screen text in English next to Hindi, Telugu and Tamil,
// so a native speaker can read and correct it. Run with: npx tsx scripts/export-translations.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { DICTS } from '../src/i18n';
import { RECIPE_TEXT, CUISINES } from '../src/i18n/recipeText';
import { RECIPES } from '../src/data/recipes';

const q = (s: string) => `"${String(s).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
const rows: string[] = ['"kind","key","English","Hindi","Telugu","Tamil","corrected Hindi","corrected Telugu","corrected Tamil"'];
for (const key of Object.keys(DICTS.en).sort()) rows.push(['text', key, DICTS.en[key as never], DICTS.hi[key as never], DICTS.te[key as never], DICTS.ta[key as never], '', '', ''].map(q).join(','));
for (const r of RECIPES) {
  rows.push(['recipe name', r.id, r.name, RECIPE_TEXT.hi[r.id].name, RECIPE_TEXT.te[r.id].name, RECIPE_TEXT.ta[r.id].name, '', '', ''].map(q).join(','));
  r.steps.forEach((s, i) => rows.push([`recipe step ${i + 1}`, r.id, s, RECIPE_TEXT.hi[r.id].steps[i], RECIPE_TEXT.te[r.id].steps[i], RECIPE_TEXT.ta[r.id].steps[i], '', '', ''].map(q).join(',')));
}
for (const c of Object.keys(CUISINES.hi)) rows.push(['cuisine', c, c, CUISINES.hi[c], CUISINES.te[c], CUISINES.ta[c], '', '', ''].map(q).join(','));
mkdirSync('docs', { recursive: true });
writeFileSync('docs/translations-review.csv', '﻿' + rows.join('\r\n') + '\r\n', 'utf8');
console.log(`Wrote docs/translations-review.csv (${rows.length - 1} rows)`);
