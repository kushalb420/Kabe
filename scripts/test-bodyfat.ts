import assert from 'node:assert/strict';
import { categoryFor, navyBodyFat } from '../src/lib/bodyfat';

const near = (a: number, b: number, tol: number, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ~${b}, got ${a}`);

// hand-worked examples (see the formula in bodyfat.ts)
const m = navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 85, neckCm: 38 })!;
near(m.pct, 16.1, 0.3, 'man 180/85/38');
assert.equal(m.category, 'fitness');
near(m.high - m.low, 8, 0.2, 'the range is ±4 points');
const f = navyBodyFat({ sex: 'female', heightCm: 165, waistCm: 75, neckCm: 32, hipsCm: 98 })!;
near(f.pct, 28.9, 0.4, 'woman 165/75/32/98');
assert.equal(f.category, 'average');

// bigger waist, more fat; bigger neck, less fat
const a = navyBodyFat({ sex: 'male', heightCm: 175, waistCm: 90, neckCm: 38 })!.pct;
const b = navyBodyFat({ sex: 'male', heightCm: 175, waistCm: 100, neckCm: 38 })!.pct;
const c = navyBodyFat({ sex: 'male', heightCm: 175, waistCm: 90, neckCm: 42 })!.pct;
assert.ok(b > a && c < a);

// never a guess
assert.equal(navyBodyFat({ sex: 'female', heightCm: 165, waistCm: 75, neckCm: 32 }), null, 'women need hips');
assert.equal(navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 30, neckCm: 38 }), null, 'waist smaller than neck');
assert.equal(navyBodyFat({ sex: 'male', heightCm: 0, waistCm: 85, neckCm: 38 }), null);
assert.equal(navyBodyFat({ sex: 'male', heightCm: 180, waistCm: NaN, neckCm: 38 }), null);
assert.equal(navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 85, neckCm: 120 }), null, 'a neck of 120 cm is a typo');
assert.equal(navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 200, neckCm: 25 }), null, 'a result above 60% is rejected');
assert.equal(navyBodyFat({ sex: 'female', heightCm: 165, waistCm: 75, neckCm: 32, hipsCm: 20 }), null);

// categories
assert.equal(categoryFor(5, 'male'), 'essential');
assert.equal(categoryFor(10, 'male'), 'athlete');
assert.equal(categoryFor(16, 'male'), 'fitness');
assert.equal(categoryFor(20, 'male'), 'average');
assert.equal(categoryFor(30, 'male'), 'above');
assert.equal(categoryFor(13, 'female'), 'essential');
assert.equal(categoryFor(23, 'female'), 'fitness');
assert.equal(categoryFor(33, 'female'), 'above');

console.log('Body-fat tests passed.');
