// Daily reminders for each habit and supplement (pure, tested in scripts/test-reminders.ts).
// Each habit or supplement can have one time of day. It is scheduled like the other reminders (next days as one-off
// times) and left out for today once you have ticked it off.
import { MAX_SCHEDULED } from './reminders';

export type Remind = { hour: number; minute: number };
export type RemindableItem = { id: string; name: string; remind?: Remind };
export type ItemKind = 'habit' | 'supplement' | 'custom';
/** At most this many item notifications are scheduled at once (the phone allows about 64 in all). */
export const MAX_SCHEDULED_ITEMS = 48;
export type ItemUpcoming = { key: string; kind: ItemKind; id: string; name: string; at: Date };

export const DEFAULT_ITEM_REMIND: Remind = { hour: 9, minute: 0 };

const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** A stored reminder time, checked: anything odd means "no reminder". */
export function cleanRemind(raw: unknown): Remind | undefined {
  const o = raw as Partial<Remind> | null | undefined;
  const hour = int(o?.hour, 0, 23);
  const minute = int(o?.minute, 0, 59);
  return hour === null || minute === null ? undefined : { hour, minute };
}

/** Move the time by some minutes, wrapping around midnight. */
export function stepRemind(r: Remind, deltaMin: number): Remind {
  const total = (((r.hour * 60 + r.minute + deltaMin) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

/** Upcoming times for the items that have a reminder. Today's time is skipped when the item is already done today; `dueOn` can skip days the item is not for. */
export function upcomingItems<T extends RemindableItem>(items: T[], kind: ItemKind, now: Date, doneToday: string[], days = 7, dueOn?: (it: T, day: Date) => boolean): ItemUpcoming[] {
  const out: ItemUpcoming[] = [];
  for (const it of items) {
    const r = cleanRemind(it.remind);
    if (!r) continue;
    for (let d = 0; d < days; d++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, r.hour, r.minute);
      if (at.getTime() <= now.getTime()) continue;
      if (dueOn && !dueOn(it, at)) continue; // e.g. a supplement taken every 3 days: no reminder on the days in between
      if (d === 0 && doneToday.includes(it.id)) continue;
      out.push({ key: `${kind}-${it.id}-${d}`, kind, id: it.id, name: it.name, at });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** The general reminders and the item reminders together, earliest first, within the phone's limit. */
export function mergeSchedule<A extends { at: Date }, B extends { at: Date }>(general: A[], items: B[], max = MAX_SCHEDULED): (A | B)[] {
  return [...general, ...items].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}
