/**
 * When to show the "you have been still" reminders, without any background service.
 *
 * Kabe checks your steps whenever it is opened or put away. From the last time it saw you moving, it schedules up to a few
 * reminders `afterMin` minutes apart, only inside your waking hours. Opening the app after a walk moves them later, so
 * the reminders only appear while there has been no movement since Kabe last looked.
 */
export function idleTimes(i: { now: number; lastActiveAt: number; afterMin: number; from: number; to: number; max?: number }): Date[] {
  const step = Math.max(10, i.afterMin) * 60_000;
  const out: Date[] = [];
  let t = i.lastActiveAt + step;
  // never in the past: catch up to the first slot that is still ahead
  if (t <= i.now + 30_000) t += Math.ceil((i.now + 30_000 - t) / step) * step;
  for (let k = 0; k < 48 && out.length < (i.max ?? 3); k++, t += step) {
    const h = new Date(t).getHours();
    if (h >= i.from && h < i.to) out.push(new Date(t));
  }
  return out;
}

/** Did the person move? `steps` is what Health Connect reported for the last stretch (null when unknown). */
export const movedEnough = (steps: number | null, minSteps: number): boolean => steps !== null && steps >= minSteps;
