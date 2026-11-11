import { useEffect, useMemo } from 'react';
import { RawData, buildCtx, evaluateBadges, evaluateChallenges, levelFor, nudge, nudgeInfo, totalPoints } from '../lib/gamify';
import { toDateKey } from '../lib/nutrition';
import { useKabe } from './kabe';
import { useKitchen } from './kitchen';
import { useTracker } from './tracker';

/** Streaks, badges, challenges, level and nudge, derived from the user's logs. Records newly earned badges once data has loaded. */
export function useGamify() {
  const k = useKabe();
  const t = useTracker();
  const kit = useKitchen();
  const today = toDateKey(new Date());
  const ready = k.ready && t.ready && kit.ready;

  const raw: RawData = useMemo(
    () => ({
      today,
      entries: k.entries,
      goals: k.goals,
      water: t.water,
      waterGoal: t.waterGoal,
      steps: t.steps,
      stepGoal: t.stepGoal,
      workouts: k.workouts,
      activities: t.activities,
      weights: t.weights,
      goalWeight: t.goalWeight,
      goalDirection: k.profile?.goal ?? 'maintain',
      checkins: t.checkins,
      restDays: t.restDays,
      plan: Object.fromEntries(kit.savedRecipes.map((r) => [r.id, 1])), // the "Planner" badge counts saved recipes
      pantryCount: kit.pantry.length,
    }),
    [today, k.entries, k.goals, t.water, t.waterGoal, t.steps, t.stepGoal, k.workouts, t.activities, t.weights, t.goalWeight, k.profile?.goal, t.checkins, t.restDays, kit.savedRecipes, kit.pantry.length],
  );
  const ctx = useMemo(() => buildCtx(raw), [raw]);
  const live = useMemo(() => evaluateBadges(ctx), [ctx]);
  const challenges = useMemo(() => evaluateChallenges(ctx), [ctx]);

  // an earned badge stays earned (and keeps its date) even if the underlying logs are later deleted
  const badges = useMemo(() => live.map((b) => ({ ...b, earned: b.unlocked || !!t.badges[b.id], earnedOn: t.badges[b.id] as string | undefined })), [live, t.badges]);

  useEffect(() => {
    if (!ready) return;
    const newB = live.filter((b) => b.unlocked && !t.badges[b.id]).map((b) => b.id);
    const newC = challenges.filter((c) => c.done && !t.challengesDone[c.key]).map((c) => c.key);
    if (newB.length || newC.length) t.recordProgress(newB, newC, today);
  }, [ready, live, challenges, t.badges, t.challengesDone, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const doneChallenges = new Set([...Object.keys(t.challengesDone), ...challenges.filter((c) => c.done).map((c) => c.key)]).size;
  const points = totalPoints(badges.map((b) => ({ ...b, unlocked: b.earned })), doneChallenges);
  return {
    ready,
    streaks: ctx.streaks,
    badges,
    challenges,
    points,
    level: levelFor(points),
    nudge: nudge(ctx, live, challenges),
    nudgeInfo: nudgeInfo(ctx, live, challenges),
    fresh: badges.filter((b) => b.earnedOn === today),
  };
}
