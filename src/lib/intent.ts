// What the user wants from Kabe (pure logic, tested in scripts/test-insights.ts). Used to tailor the insights.
// Everything is a fixed choice except one short free-text note, which is only ever sent to the AI as quoted data.

export const GOAL_IDS = ['loseFat', 'buildMuscle', 'maintain', 'eatHealthier', 'moreEnergy', 'betterSleep', 'moreActive', 'saveMoney', 'manageCondition'] as const;
export const STRUGGLE_IDS = ['snacking', 'skipMeals', 'lowProtein', 'eatOut', 'sugar', 'lateDinner', 'portions', 'cooking'] as const;
export const CARE_IDS = ['diabetes', 'bp', 'thyroid', 'pcos', 'cholesterol', 'lactose', 'gluten', 'nutAllergy'] as const;

export type GoalId = (typeof GOAL_IDS)[number];
export type StruggleId = (typeof STRUGGLE_IDS)[number];
export type CareId = (typeof CARE_IDS)[number];

export type Intent = { goals: GoalId[]; struggles: StruggleId[]; care: CareId[]; note: string; answered: boolean };

export const EMPTY_INTENT: Intent = { goals: [], struggles: [], care: [], note: '', answered: false };
export const MAX_NOTE = 300;

const keep = <T extends string>(raw: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(raw) ? allowed.filter((id) => raw.includes(id)) : [];

/** Anything stored or synced is cleaned before use: unknown ids dropped, note trimmed, control characters removed. */
export function sanitizeIntent(raw: unknown): Intent {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const note = typeof o.note === 'string' ? o.note.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE) : '';
  return { goals: keep(o.goals, GOAL_IDS), struggles: keep(o.struggles, STRUGGLE_IDS), care: keep(o.care, CARE_IDS), note, answered: o.answered === true };
}

export const toggle = <T extends string>(list: T[], id: T, max = 4): T[] =>
  list.includes(id) ? list.filter((x) => x !== id) : list.length >= max ? list : [...list, id];

/** Marked "answered" once the person has picked at least one goal. */
export const isAnswered = (i: Intent): boolean => i.goals.length > 0;
