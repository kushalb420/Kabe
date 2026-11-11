// Step counting helpers (pure, tested in scripts/test-steps.ts). The phone's pedometer is read in components/StepCounter.tsx.

/** Android only reports steps since Kabe started listening, so the day's total is what was already logged plus that session. */
export const withSession = (base: number, session: number): number => Math.max(0, Math.round(base) + Math.max(0, Math.round(session)));

/** The phone's own count can only go up during a day, so a lower reading never replaces a higher saved one (e.g. typed by hand). */
export const nextTotal = (saved: number, reading: number): number => Math.max(Math.round(saved), Math.round(reading));

/** Save at most every `minGapMs`, and only when the number really changed (keeps the app fast and storage quiet). */
export function shouldSave(last: { value: number; at: number } | null, value: number, now: number, minGapMs = 15000): boolean {
  if (!last) return true;
  return value !== last.value && now - last.at >= minGapMs;
}

/** Midnight at the start of the given date, for "steps since the start of today". */
export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
