import assert from 'node:assert/strict';
import { MAX_PROTEIN_PER_KG, MIN_KCAL, Profile, maxRateKgWeek, planOptions, suggestGoals } from '../src/lib/nutrition';

const man: Profile = { sex: 'male', age: 30, heightCm: 175, weightKg: 85, activity: 'light', goal: 'maintain', targetKg: 75 };
const lose = planOptions(man);
assert.ok(lose.length >= 2 && lose.length <= 4, 'a handful of time frames');
assert.equal(lose.filter((o) => o.recommended).length, 1, 'exactly one is recommended');
for (const o of lose) {
  assert.ok(o.kgPerWeek <= maxRateKgWeek(man) + 1e-9, 'never faster than the safe rate');
  assert.ok(o.kgPerWeek <= 0.01 * man.weightKg + 1e-9, 'at most 1% of body weight a week');
  assert.ok(o.kcal >= MIN_KCAL.male, 'never below the calorie floor');
}
for (let i = 1; i < lose.length; i++) {
  assert.ok(lose[i].weeks > lose[i - 1].weeks, 'sorted by weeks');
  assert.ok(lose[i].kcal >= lose[i - 1].kcal, 'a longer time frame means more food a day');
}

// choosing a time frame changes the calories, and the macros follow
const fast = suggestGoals({ ...man, weeks: lose[0].weeks });
const slow = suggestGoals({ ...man, weeks: lose[lose.length - 1].weeks });
assert.ok(fast.kcal <= slow.kcal);
assert.equal(fast.kcal, lose[0].kcal);

// protein is never above 2.2 g per kg, whatever the goal or calories
for (const goalKg of [60, 85, 110]) {
  for (const w of [50, 70, 90, 130]) {
    const p: Profile = { ...man, weightKg: w, targetKg: goalKg };
    for (const weeks of [undefined, 8, 32]) {
      const m = suggestGoals({ ...p, weeks });
      assert.ok(m.protein <= Math.round(w * MAX_PROTEIN_PER_KG), `protein ${m.protein} for ${w} kg`);
      assert.ok(m.carbs >= 0 && m.fat > 0);
    }
  }
}

const woman: Profile = { sex: 'female', age: 28, heightCm: 160, weightKg: 55, activity: 'sedentary', goal: 'maintain', targetKg: 60 };
const gain = planOptions(woman);
assert.ok(gain.length >= 1);
for (const o of gain) assert.ok(o.kgPerWeek <= 0.5 * 0.55 + 1e-9, 'gaining stays slow');

assert.deepEqual(planOptions({ ...woman, targetKg: 55.5 }), [], 'already at the target: nothing to choose');
assert.deepEqual(planOptions({ ...woman, targetKg: undefined }), []);
// a tiny change still gets a sensible option
const small = planOptions({ ...man, targetKg: 82 });
assert.ok(small.length >= 1 && small.every((o) => o.kcal >= MIN_KCAL.male));
console.log('Plan tests passed.');
