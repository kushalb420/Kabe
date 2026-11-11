import assert from 'node:assert/strict';
import { FOODS } from '../src/data/foods';
import { COACH_RULES, ChatMsg, LOOKUP_TOOL, buildSystemInstruction, historyToSteps, makeLookup, runCoach } from '../src/lib/coachChat';
import { analyzeCoach } from '../src/lib/coach';
import { buildCoachContext } from '../src/lib/coachContext';
import { DEFAULT_PROFILE } from '../src/lib/nutrition';

const ok = (steps: any[]) => ({ status: 200, json: { status: 'completed', steps } });
const text = (t: string) => ok([{ type: 'model_output', content: [{ type: 'text', text: t }] }]);

(async () => {
  // --- lookup tool: real data, honest when missing ---
  const lookup = makeLookup(FOODS);
  assert.match(lookup('chicken'), /Chicken breast, cooked — per 100 g: 165 kcal/);
  assert.match(lookup('roti'), /Roti.*297 kcal/);
  assert.match(lookup('xyzzyqq'), /Do not guess numbers/);
  assert.match(lookup('   '), /Empty/);

  // --- web fallback inside the lookup tool ---
  const { makeFoodLookup } = await import('../src/lib/coachChat');
  const webFood = { id: 'w', name: 'khichdi', category: 'Food', kcal: 130, protein: 4.5, carbs: 22, fat: 2.5, satFat: 1, sugar: 0.5, fiber: 2, servingG: 150, servingLabel: '1 katori (150 g)' };
  const wl = makeFoodLookup('K', FOODS, async () => webFood);
  assert.match(await wl('chicken'), /Chicken breast/); // the built-in list answers first, no Gemini call needed
  const fromWeb = await wl('khichdi');
  assert.match(fromWeb, /khichdi — per 100 g: 130 kcal.*saturated fat 1 g/);
  assert.match(await makeFoodLookup('K', FOODS, async () => null)('xyzzyqq'), /Do not guess numbers/);
  assert.match(await makeFoodLookup('K', FOODS, async () => { throw new Error('offline'); })('xyzzyqq'), /Do not guess numbers/);
  // the chat loop awaits an async lookup
  let first = true;
  const asyncAnswer = await runCoach({
    call: async (b: any) => (first ? ((first = false), ok([{ type: 'function_call', id: 'q1', name: 'lookup_food', arguments: { query: 'khichdi' } }])) : (assert.match(JSON.stringify(b.input), /per 100 g/), text('Khichdi is about 130 kcal per 100 g.'))),
    history: [], question: 'khichdi?', system: 's', lookup: wl,
  });
  assert.match(asyncAnswer, /130 kcal/);

  // --- history → steps ---
  const hist: ChatMsg[] = [{ id: '1', role: 'user', text: 'hi' }, { id: '2', role: 'coach', text: 'hello' }];
  assert.deepEqual(historyToSteps(hist), [
    { type: 'user_input', content: 'hi' },
    { type: 'model_output', content: [{ type: 'text', text: 'hello' }] },
  ]);

  // --- plain answer, no tool ---
  const bodies: any[] = [];
  const a1 = await runCoach({ call: async (b) => (bodies.push(b), text('Eat more protein.')), history: hist, question: 'tips?', system: 'SYS', lookup });
  assert.equal(a1, 'Eat more protein.');
  assert.equal(bodies[0].system_instruction, 'SYS');
  assert.equal(bodies[0].store, false);
  assert.equal(bodies[0].tools[0].name, 'lookup_food');
  assert.deepEqual(bodies[0].input.at(-1), { type: 'user_input', content: 'tips?' });
  assert.equal(bodies[0].input.length, 3);

  // --- tool round trip: function_call → we execute → function_result with call_id + prior steps resent ---
  const seen: any[] = [];
  let n = 0;
  const a2 = await runCoach({
    call: async (b) => {
      seen.push(b);
      if (n++ === 0) {
        return ok([
          { type: 'thought', summary: [{ type: 'text', text: 'need data' }], signature: 'sig' },
          { type: 'function_call', id: 'c1', name: 'lookup_food', arguments: { query: 'chicken breast' } },
        ]);
      }
      return text('Cooked chicken breast is roughly 165 kcal per 100 g.');
    },
    history: [],
    question: 'is chicken ok?',
    system: 'SYS',
    lookup,
  });
  assert.match(a2, /165 kcal/);
  assert.equal(seen.length, 2);
  const second = seen[1].input;
  assert.equal(second[0].type, 'user_input');
  assert.equal(second[1].type, 'thought'); // model steps resent exactly as received
  assert.equal(second[1].signature, 'sig');
  assert.equal(second[2].type, 'function_call');
  const fr = second[3];
  assert.equal(fr.type, 'function_result');
  assert.equal(fr.call_id, 'c1');
  assert.equal(fr.name, 'lookup_food');
  assert.match(fr.result[0].text, /Chicken breast/);

  // --- runaway tool loop is stopped ---
  await assert.rejects(
    runCoach({ call: async () => ok([{ type: 'function_call', id: 'x', name: 'lookup_food', arguments: { query: 'a' } }]), history: [], question: 'q', system: 's', lookup, maxRounds: 2 }),
    /stuck/,
  );

  // --- model fallback on unavailable model; other errors surface with friendly text ---
  const tried: string[] = [];
  const a3 = await runCoach({
    call: async (b: any) => (tried.push(b.model), b.model === 'm1' ? { status: 404, json: { error: { message: 'model not found' } } } : text('ok')),
    models: ['m1', 'm2'], history: [], question: 'q', system: 's', lookup,
  });
  assert.equal(a3, 'ok');
  assert.deepEqual(tried, ['m1', 'm2']);
  await assert.rejects(runCoach({ call: async () => ({ status: 429, json: {} }), history: [], question: 'q', system: 's', lookup }), /limit reached/);
  await assert.rejects(runCoach({ call: async () => ({ status: 400, json: { error: { message: 'API key not valid' } } }), history: [], question: 'q', system: 's', lookup }), /AI service rejected its key/);
  await assert.rejects(runCoach({ call: async () => ok([]), history: [], question: 'q', system: 's', lookup }), /no answer/);
  await assert.rejects(runCoach({ call: async () => ({ status: 404, json: {} }), models: ['a', 'b'], history: [], question: 'q', system: 's', lookup }), /No free AI model/);

  // --- safety rules are present in the instruction ---
  const sys = buildSystemInstruction('{"x":1}');
  for (const must of ['not a doctor', 'never guess or invent', 'dietitian', '1% of body weight']) assert.ok(sys.includes(must), must);
  assert.ok(sys.endsWith('{"x":1}'));
  assert.ok(!sys.includes('Reply in'), 'English users get no language instruction');
  const sysHi = buildSystemInstruction('{"x":1}', 'Hindi');
  assert.ok(sysHi.includes('Reply in Hindi') && sysHi.includes('numbers, units and food names exact') && sysHi.endsWith('{"x":1}'));
  assert.ok(sysHi.includes('not a doctor'), 'safety rules stay when the language changes');
  assert.ok(COACH_RULES.includes('lookup_food'));
  assert.equal(LOOKUP_TOOL.parameters.required[0], 'query');

  // --- context contains computed analysis and real numbers only ---
  const today = '2026-03-30';
  const analysis = analyzeCoach({ profile: DEFAULT_PROFILE, goals: { kcal: 2000, protein: 100 }, entries: [], weights: [], goalWeight: 55, today });
  const ctx: any = buildCoachContext({
    today, profile: DEFAULT_PROFILE, goals: { kcal: 2000, protein: 100, carbs: 220, fat: 65, fiber: 30 },
    entries: [{ date: today, meal: 'lunch', name: 'Roti', grams: 80, kcal: 238, protein: 7.8, carbs: 37, fat: 6, fiber: 4, id: '1', source: 'database' } as any],
    weights: [], goalWeight: 55, workouts: [], water: { [today]: 500 }, waterGoal: 2500, caffeine: [], habits: [{ id: 'h', name: 'Walk' }],
    habitLog: {}, supplements: [], supplementLog: {}, quickFoods: [FOODS[0]], analysis,
    lifestyle: { readinessToday: 46, sleepAvgHours7d: 6.3, activeMinutes7d: 130 },
  });
  assert.equal(ctx.recoveryAndActivity.readinessToday, 46, 'recovery/activity summary reaches the coach');
  assert.ok(buildSystemInstruction('{}').includes('recoveryAndActivity'), 'coach is told to use it');
  assert.equal(ctx.remainingToday.kcal, 1762);
  assert.equal(ctx.todaySoFar.itemsLogged, 1);
  assert.equal(ctx.analysis.planStatus, 'insufficient');
  assert.match(String(ctx.analysis.measuredDailyCaloriesBurned), /unknown/);
  assert.equal(ctx.favouriteAndRecentFoods[0].kcalPerServing, 119); // roti 297 × 40 g
  assert.deepEqual(ctx.habitsNotDoneToday, ['Walk']);
  assert.ok(JSON.stringify(ctx).length < 6000, 'context stays small');
  console.log('Coach chat tests passed.');
})();

// ---- plain-text answers and the goal proposal line ----
import { plainText, splitGoalProposal } from '../src/lib/coachText';
{
  assert.equal(plainText('**Eat more protein.**\n\n* Dal\n* Eggs\n\n### Tip\nUse `curd`.'), 'Eat more protein.\n\n• Dal\n• Eggs\n\nTip\nUse curd.');
  assert.equal(plainText('See [this](http://x.y) and __that__'), 'See this and that');
  const ok = splitGoalProposal('Try more protein.\nGOALS: {"kcal":2000,"protein":120,"carbs":220,"fat":65}');
  assert.equal(ok.text, 'Try more protein.');
  assert.deepEqual(ok.goals, { kcal: 2000, protein: 120, carbs: 220, fat: 65 });
  assert.equal(splitGoalProposal('Hi\nGOALS: {"kcal":500,"protein":120,"carbs":220,"fat":65}').goals, null, 'too low');
  assert.equal(splitGoalProposal('Hi\nGOALS: {"kcal":2000,"protein":10,"carbs":10,"fat":10}').goals, null, 'does not add up');
  assert.equal(splitGoalProposal('Hi\nGOALS: not json').goals, null);
  assert.equal(splitGoalProposal('No change needed.').goals, null);
  assert.equal(splitGoalProposal('Hi\nGOALS: not json').text, 'Hi', 'the line never shows');
  console.log('Coach text tests passed.');
}
