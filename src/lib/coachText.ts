/** Make a coach answer easy to read: no markdown symbols, tidy bullets and spacing. */
export function plainText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/^[ \t]*[*-][ \t]+/gm, '• ')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type GoalProposal = { kcal: number; protein: number; carbs: number; fat: number };

/** Pull the optional "GOALS: {...}" line out of an answer. The numbers are checked; a bad line is dropped (never applied). */
export function splitGoalProposal(text: string): { text: string; goals: GoalProposal | null } {
  const m = text.match(/^\s*GOALS:\s*(\{.*\})\s*$/im);
  const clean = text.replace(/^\s*GOALS:.*$/gim, '').trim();
  if (!m) return { text: clean, goals: null };
  try {
    const g = JSON.parse(m[1]) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : NaN);
    const goals = { kcal: n(g.kcal), protein: n(g.protein), carbs: n(g.carbs), fat: n(g.fat) };
    const ok =
      goals.kcal >= 1000 && goals.kcal <= 5000 && goals.protein >= 20 && goals.protein <= 300 && goals.carbs >= 20 && goals.carbs <= 700 && goals.fat >= 15 && goals.fat <= 250 &&
      Math.abs(goals.protein * 4 + goals.carbs * 4 + goals.fat * 9 - goals.kcal) <= goals.kcal * 0.15;
    return { text: clean, goals: ok ? goals : null };
  } catch {
    return { text: clean, goals: null };
  }
}
