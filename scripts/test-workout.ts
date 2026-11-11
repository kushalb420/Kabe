import assert from 'node:assert/strict';
import { EXERCISES } from '../src/data/exercises';
import { Workout, est1RM, fmtDuration, lastSets, records, suggestNext, workoutVolume } from '../src/lib/workout';

assert.equal(new Set(EXERCISES.map((x) => x.id)).size, EXERCISES.length, 'duplicate exercise ids');

assert.equal(est1RM(100, 1), 100);
assert.ok(Math.abs(est1RM(100, 10) - 133.33) < 0.01);
assert.equal(est1RM(0, 10), 0);

const set = (weight: number, reps: number, done = true) => ({ id: `${weight}-${reps}`, weight, reps, done });
const w = (date: string, sets: ReturnType<typeof set>[]): Workout => ({
  id: date,
  name: 'T',
  date,
  startedAt: 0,
  durationSec: 600,
  exercises: [{ exerciseId: 'bench-press', name: 'Bench', sets }],
});

const newer = w('2026-02-02', [set(60, 12), set(60, 12), set(60, 12), set(80, 5, false)]);
const older = w('2026-01-01', [set(50, 10)]);

// unfinished sets are ignored
assert.equal(workoutVolume(newer), 60 * 12 * 3);
assert.equal(lastSets('bench-press', [newer, older]).length, 3);
assert.equal(lastSets('squat', [newer, older]).length, 0);

// progression rule
assert.deepEqual(suggestNext(lastSets('bench-press', [newer])), {
  weight: 62.5,
  reps: 8,
  reason: 'You hit 12 reps on every set — add 2.5 kg.',
  why: { key: 'addWeight', reps: 12, step: 2.5 },
});
const s2 = suggestNext([set(60, 10), set(60, 9)])!;
assert.equal(s2.weight, 60);
assert.equal(s2.reps, 10);
assert.equal(suggestNext([]), null);

// records ignore undone sets and >12 reps
const rec = records([newer, older]);
assert.equal(rec.length, 1);
assert.equal(rec[0].weight, 60);

assert.equal(fmtDuration(65), '1:05');
console.log(`Workout tests passed (${EXERCISES.length} exercises).`);
