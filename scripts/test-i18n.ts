import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NATIVE_FOODS, nativeToEnglish } from '../src/data/nativeFoods';
import { DICTS, LANGUAGES, Lang, coachLanguageName, isLang, translate, translatePlural } from '../src/i18n';
import { en } from '../src/i18n/en';
import { ALL_UNITS, BADGE_TEXT, CHALLENGE_TEXT, UNIT_TEXT, badgeName, nudgeVars, unitLabel } from '../src/i18n/gamifyText';
import { BADGES, CHALLENGES, buildCtx, nudge } from '../src/lib/gamify';
import { tokens } from '../src/lib/foodText';
import { searchFoods } from '../src/lib/foodSearch';

const keys = Object.keys(en) as (keyof typeof en)[];
const SCRIPT: Record<Exclude<Lang, 'en'>, RegExp> = { hi: /[ऀ-ॿ]/, te: /[ఀ-౿]/, ta: /[஀-௿]/ };
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

// ---- every language has every key, with the same placeholders, in the right script ----
for (const lang of ['hi', 'te', 'ta'] as const) {
  const d = DICTS[lang];
  assert.deepEqual(Object.keys(d).sort(), [...keys].sort(), `${lang}: keys differ from English`);
  for (const k of keys) {
    const v = d[k];
    assert.ok(v && v.trim().length > 0, `${lang}.${k} is empty`);
    assert.equal(placeholders(v), placeholders(en[k]), `${lang}.${k}: {placeholders} differ from English`);
    assert.ok(SCRIPT[lang].test(v), `${lang}.${k} is not written in the ${lang} script: ${v}`);
    // no other Indian script mixed in by accident
    for (const [other, re] of Object.entries(SCRIPT)) if (other !== lang) assert.ok(!re.test(v), `${lang}.${k} contains ${other} characters`);
    assert.ok(!/�/.test(v), `${lang}.${k} has a broken character`);
  }
}
// English values are English
for (const k of keys) assert.ok(!/[ऀ-෿]/.test(en[k]), `en.${k} contains non-English script`);
// plural pairs exist everywhere
for (const base of ['today.streak', 'today.newBadge']) for (const l of ['en', 'hi', 'te', 'ta'] as Lang[]) assert.ok(DICTS[l][`${base}.one` as keyof typeof en] && DICTS[l][`${base}.other` as keyof typeof en], `${l}: ${base} plural forms`);
// the ten level titles exist (used by name in code)
for (let i = 1; i <= 10; i++) assert.ok(en[`level.${i}` as keyof typeof en]);

// ---- translate() ----
assert.equal(translate('en', 'tab.today'), 'Today');
assert.equal(translate('hi', 'tab.today'), 'आज');
assert.equal(translate('te', 'tab.today'), 'ఈరోజు');
assert.equal(translate('ta', 'tab.today'), 'இன்று');
assert.equal(translate('en', 'today.level', { level: 3, title: 'Consistent', points: 100 }), 'Level 3 · Consistent · 100 pts');
assert.equal(translate('hi', 'today.level', { level: 3, title: 'नियमित', points: 100 }), 'लेवल 3 · नियमित · 100 अंक');
assert.equal(translate('en', 'friends.added', { other: 1 }), '{name} is now your friend.', 'missing vars are left visible, not dropped');
assert.equal(translatePlural('en', 'today.streak', 1), '1 day logged in a row');
assert.equal(translatePlural('en', 'today.streak', 5), '5 days logged in a row');
assert.equal(translatePlural('ta', 'today.streak', 5), '5 நாட்கள் தொடர்ந்து பதிவு');
assert.equal(translatePlural('te', 'today.streak', 1), '1 రోజు వరుసగా నమోదు');
assert.equal(translate('xx' as Lang, 'tab.me'), 'Me', 'unknown language falls back to English');
assert.deepEqual(LANGUAGES.map((l) => l.code), ['en', 'hi', 'te', 'ta']);
assert.ok(isLang('hi') && !isLang('fr') && !isLang(undefined));
assert.equal(coachLanguageName('en'), null);
assert.equal(coachLanguageName('te'), 'Telugu');

// ---- every literal t('key') / tn('base') used in the source exists ----
const files: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === 'node_modules' || f.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(f)) files.push(p);
  }
};
walk('app');
walk('src');
const used = new Set<string>();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-z][\w.]*)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/\btn\(\s*'([a-z][\w.]*)'/g)) {
    used.add(`${m[1]}.one`);
    used.add(`${m[1]}.other`);
  }
}
assert.ok(used.size >= 20, `only ${used.size} translation keys are used in the app — wiring missing?`);
for (const k of used) assert.ok(k in en, `source uses unknown translation key "${k}"`);
// and nothing sits unused for long: every key is referenced somewhere (static or by known dynamic prefix)
const dynamic = ['k2.eq.', 'supp.mode.', 'buy.cat.', 'friends.m.', 'rec.sub.', 'rem.', 'body.neck', 'body.fat.', 'dash.card.', 'micro.n.', 'micro.today', 'micro.week', 'ins.t.', 'about.goal.', 'about.struggle.', 'about.care.', 'privacy.f.', 'privacy.s.', 'next.why.', 'week.h.', 'week.step.', 'stats.p', 'stats.note.', 'meal.', 'level.', 'today.greet.', 'macro.', 'caff.', 'day.', 'muscle.', 'equip.', 'wo.why.', 'coach.conf.', 'coach.reason.', 'coach.note.', 'coach.status.', 'coach.forecast.', 'coach.q', 'cat.', 'diet.', 'plan.diet.', 'rec.diet.', 'grp.', 'tier.', 'act.type.', 'act.effort.', 'act.d', 'act.when', 'recov.head.', 'recov.tip.', 'recov.lo.', 'recov.hi.', 'rest.tag.', 'label.w.', 'theme.', 'me.act.', 'me.actHelp.', 'me.goalFrom.', 'me.carbs.', 'me.carbsHelp.', 'me.goal.', 'cloud.st.', 'body.waist', 'body.chest', 'body.hips', 'body.arm', 'body.thigh'];
const allSrc = files.filter((f) => !/[\\/]i18n[\\/]((en|hi|te|ta)\.ts|parts[\\/].*)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n'); // the dictionaries themselves don't count as "use"
for (const k of keys) {
  if (used.has(k) || dynamic.some((p) => k.startsWith(p)) || k.endsWith('.one') || k.endsWith('.other')) continue;
  assert.ok(allSrc.includes(`'${k}'`), `translation key "${k}" is never used`);
}

// ---- native food words ----
for (const [lang, group] of Object.entries(NATIVE_FOODS)) {
  const re = SCRIPT[lang as 'hi' | 'te' | 'ta'];
  assert.ok(Object.keys(group).length >= 50, `${lang}: only ${Object.keys(group).length} food words`);
  for (const [word, eng] of Object.entries(group)) {
    assert.ok(re.test(word), `${lang} food word is in the wrong script: ${word}`);
    for (const [other, o] of Object.entries(SCRIPT)) if (other !== lang) assert.ok(!o.test(word), `${lang} word ${word} contains ${other} characters`);
    assert.match(eng, /^[a-z ]+$/, `${word} → "${eng}" must be plain English`);
  }
}
assert.equal(nativeToEnglish('chicken curry'), 'chicken curry', 'English is untouched');
assert.equal(nativeToEnglish('रोटी'), 'roti');
assert.equal(nativeToEnglish('तूर दाल'), 'toor dal');
assert.equal(nativeToEnglish('కందిపప్పు'), 'toor dal');
assert.equal(nativeToEnglish('துவரம் பருப்பு'), 'toor dal');
assert.equal(nativeToEnglish('கோதுமை மாவு'), 'wheat flour');
assert.equal(nativeToEnglish('రోటీ, పప్పు'), 'roti dal', 'commas and Devanagari danda are separators');
assert.equal(nativeToEnglish('अज्ञात शब्द'), 'अज्ञात शब्द', 'unknown words are kept as they are');
assert.deepEqual(tokens('रोटी'), ['roti']);
assert.deepEqual(tokens('ఉల్లిపాయ ముక్కలు'), ['onion', 'ముక్కలు'.replace(/[^a-z0-9\s]/g, '')].filter(Boolean));

// search and matching in native scripts reach the real food data
const top = (q: string) => searchFoods(q, 8).map((f) => f.name.toLowerCase());
assert.ok(top('रोटी').some((n) => n.includes('roti') || n.includes('chapati')), 'Hindi: रोटी');
assert.ok(top('पनीर').some((n) => n.includes('paneer')), 'Hindi: पनीर');
assert.ok(top('इडली').some((n) => n.includes('idli')), 'Hindi: इडली');
assert.ok(top('అన్నం').some((n) => n.includes('rice')), 'Telugu: అన్నం');
assert.ok(top('పెరుగు').some((n) => n.includes('yogurt') || n.includes('curd')), 'Telugu: పెరుగు');
assert.ok(top('దోశ').some((n) => n.includes('dosa')), 'Telugu: దోశ');
assert.ok(top('தயிர்').some((n) => n.includes('yogurt') || n.includes('curd')), 'Tamil: தயிர்');
assert.ok(top('இட்லி').some((n) => n.includes('idli')), 'Tamil: இட்லி');
assert.ok(top('முட்டை').some((n) => n.includes('egg')), 'Tamil: முட்டை');

// ---- a translated text is in its own script and has no broken characters ----
const pure = (lang: 'hi' | 'te' | 'ta', s: string, what: string) => {
  assert.ok(SCRIPT[lang].test(s), `${lang} ${what} is not in the ${lang} script: ${s}`);
  for (const [other, re] of Object.entries(SCRIPT)) if (other !== lang) assert.ok(!re.test(s), `${lang} ${what} contains ${other} characters`);
  assert.ok(!/�/.test(s), `${lang} ${what} has a broken character`);
};
// ---- badges, challenges and their units ----
for (const lang of ['hi', 'te', 'ta'] as const) {
  assert.deepEqual(Object.keys(BADGE_TEXT[lang]).sort(), BADGES.map((b) => b.id).sort(), `${lang}: badge translations differ from the badge list`);
  for (const b of BADGES) {
    const [n, d] = BADGE_TEXT[lang][b.id];
    pure(lang, n, `badge name ${b.id}`);
    pure(lang, d, `badge description ${b.id}`);
    assert.equal(badgeName(lang, b.id, b.name), n);
  }
  assert.deepEqual(Object.keys(CHALLENGE_TEXT[lang]).sort(), CHALLENGES.map((c) => c.id).sort(), `${lang}: challenge translations differ`);
  for (const c of CHALLENGES) pure(lang, CHALLENGE_TEXT[lang][c.id], `challenge ${c.id}`);
  for (const u of ALL_UNITS()) {
    assert.ok(UNIT_TEXT[lang][u], `${lang}: no translation for unit "${u}"`);
    pure(lang, UNIT_TEXT[lang][u], `unit ${u}`);
  }
}
assert.equal(badgeName('en', 'log-7', 'One week strong'), 'One week strong');
assert.equal(badgeName('hi', 'no-such-badge', 'Fallback'), 'Fallback');
assert.equal(unitLabel('hi', 'weird unit'), 'weird unit');
const nv = nudgeVars('hi', { vars: { name: 'Protein pro', left: 3 }, badgeId: 'protein-10' });
assert.equal(nv.name, 'प्रोटीन प्रो');
assert.equal(nv.left, 3);
assert.deepEqual(nudgeVars('hi', { vars: { n: 3 } }), { n: 3 });

// ---- every code the logic can return has a message ----
const hasKey = (k: string) => assert.ok(k in en, `missing translation key ${k}`);
['shortSleep', 'soreMuscles', 'soreGeneral', 'streak', 'stress', 'rest', 'push'].forEach((id) => hasKey(`recov.tip.${id}`));
['push', 'moderate', 'light', 'rest'].forEach((id) => hasKey(`recov.head.${id}`));
['coverage', 'weighIns', 'span', 'nonsense'].forEach((id) => hasKey(`coach.reason.${id}`));
['floored', 'maintain', 'lose', 'gain'].forEach((id) => hasKey(`coach.note.${id}`));
['progressing', 'slow', 'plateau', 'unclear', 'stable', 'drifting', 'insufficient'].forEach((id) => hasKey(`coach.status.${id}`));
['no_goal', 'insufficient', 'flat', 'wrong_direction', 'too_far', 'reached'].forEach((id) => hasKey(`coach.forecast.${id}`));
['bodyweight', 'addWeight', 'same'].forEach((id) => hasKey(`wo.why.${id}`));
['unclearBasis', 'noServing', 'kcalMissing', 'atwater', 'sugarOverCarbs', 'fiberOverCarbs', 'tooMuchMass', 'kcalTooHigh'].forEach((id) => hasKey(`label.w.${id}`)); // every warning checkLabel can return
['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Full body'].forEach((m) => hasKey(`muscle.${m}`));
['Vegetables', 'Fruit', 'Dairy & eggs', 'Meat & protein', 'Grains & flour', 'Lentils & beans', 'Oils & fats', 'Nuts', 'Other'].forEach((c) => hasKey(`cat.${c}`));
['breakfast', 'lunch', 'dinner', 'snack'].forEach((m) => hasKey(`meal.${m}`));
for (let d = 0; d < 7; d++) hasKey(`day.${d}`);
// the logic's own English text and the dictionary agree
assert.equal(translate('en', 'nudge.start'), nudge(buildCtx({ today: '2026-03-11', entries: [], goals: { kcal: 2000, protein: 100 }, water: {}, waterGoal: 2500, steps: {}, stepGoal: 8000, workouts: [], activities: [], weights: [], goalWeight: null, goalDirection: 'maintain', checkins: {}, restDays: [], plan: {}, pantryCount: 0 }), [], []));

console.log(`i18n tests passed (${keys.length} keys × 3 languages, ${Object.values(NATIVE_FOODS).reduce((s, g) => s + Object.keys(g).length, 0)} native food words).`);
