import { useCallback, useEffect, useMemo, useState } from 'react';
import { toDateKey } from './nutrition';
import { BoardRow, fetchBoard, fetchMyProfile, saveProfile, weeklyTotals } from './social';
import { useCloud } from '../store/cloud';
import { useKabe } from '../store/kabe';
import { useTracker } from '../store/tracker';

/**
 * Your friends and your own profile, loaded from the server every time a screen that shows them opens (so the list is always
 * there, never "forgotten"). Used by the Friends screen and the friends card on Me.
 */
export function useFriends() {
  const cloud = useCloud();
  const kabe = useKabe();
  const tracker = useTracker();
  const client = cloud.client && cloud.user ? cloud.client : null;
  const today = toDateKey(new Date());
  const totals = useMemo(() => weeklyTotals(today, tracker.steps, tracker.activities, kabe.entries.map((e) => e.date)), [today, tracker.steps, tracker.activities, kabe.entries]);
  const [me, setMe] = useState<{ name: string; code: string } | null>(null);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    void Promise.resolve().then(() => alive && setLoading(true));
    (async () => {
      try {
        const mine = await fetchMyProfile(client);
        if (!alive) return;
        setMe(mine);
        if (mine) await saveProfile(client, mine.name, totals).catch(() => {}); // keep this week's totals fresh
      } catch {
        /* the list below still loads */
      }
      try {
        const rows = await fetchBoard(client, totals.week);
        if (alive) setBoard(rows);
      } catch {
        /* keeps what it had */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // reload when the connection, the week, the points or a manual refresh change
  }, [client, totals.week, totals.points, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { client, me, setMe, board, setBoard, loading, refresh, totals };
}
