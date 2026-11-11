// Body-fat estimate from tape measurements (US Navy method). Pure and tested in scripts/test-bodyfat.ts.
// It is an estimate: real body fat can differ by several points, so the screen shows a range and says so.

export type Category = 'essential' | 'athlete' | 'fitness' | 'average' | 'above';

export type BodyFat = { pct: number; low: number; high: number; category: Category };

const log10 = Math.log10;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Upper limits (percent) of the usual ACE categories: below the first is "essential", and so on; above the last is "above". */
const LIMITS: Record<'male' | 'female', [number, number, number, number]> = {
  male: [6, 14, 18, 25],
  female: [14, 21, 25, 32],
};

export function categoryFor(pct: number, sex: 'male' | 'female'): Category {
  const [a, b, c, d] = LIMITS[sex];
  return pct < a ? 'essential' : pct < b ? 'athlete' : pct < c ? 'fitness' : pct < d ? 'average' : 'above';
}

/** All lengths in centimetres. Women also need hips. Returns null for impossible or missing inputs (never a guess). */
export function navyBodyFat(i: { sex: 'male' | 'female'; heightCm: number; waistCm: number; neckCm: number; hipsCm?: number }): BodyFat | null {
  const { sex, heightCm: h, waistCm: w, neckCm: n } = i;
  if (![h, w, n].every((x) => Number.isFinite(x) && x > 0)) return null;
  if (h < 120 || h > 230 || w < 40 || w > 220 || n < 20 || n > 70) return null;
  let pct: number;
  if (sex === 'male') {
    if (w - n <= 0) return null;
    pct = 495 / (1.0324 - 0.19077 * log10(w - n) + 0.15456 * log10(h)) - 450;
  } else {
    const hips = i.hipsCm;
    if (!hips || !Number.isFinite(hips) || hips < 50 || hips > 220) return null;
    if (w + hips - n <= 0) return null;
    pct = 495 / (1.29579 - 0.35004 * log10(w + hips - n) + 0.221 * log10(h)) - 450;
  }
  if (!Number.isFinite(pct) || pct < 3 || pct > 60) return null; // outside what the formula can mean: the measurements are probably a typo
  return { pct: r1(pct), low: r1(Math.max(2, pct - 4)), high: r1(pct + 4), category: categoryFor(pct, sex) };
}
