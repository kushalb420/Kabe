// Counting steps in a web browser (the iPhone version of Kabe), pure logic tested in scripts/test-websteps.ts.
// Browsers have no step counter, so steps are estimated from the phone's motion sensor, and only while Kabe is open.

const THRESHOLD = 1.1; // m/s² a footstep must rise above the resting (gravity) level
const MIN_GAP_MS = 280; // two steps are never closer than this

/** Feed it motion readings (acceleration including gravity, m/s²); `push` returns how many new steps that reading completed. */
export function stepDetector() {
  let base = 9.81;
  let smooth = 0;
  let prev = 0;
  let prevPrev = 0;
  let last = -1e9;
  return {
    push(x: number, y: number, z: number, tMs: number): number {
      const m = Math.sqrt(x * x + y * y + z * z);
      if (!Number.isFinite(m)) return 0;
      base += 0.02 * (m - base); // slowly follows gravity, so holding the phone at any angle works
      const s = smooth + 0.4 * (m - base - smooth); // a little smoothing removes sensor jitter
      smooth = s;
      const peak = prev > prevPrev && prev >= s && prev > THRESHOLD;
      const at = tMs;
      prevPrev = prev;
      prev = s;
      if (peak && at - last >= MIN_GAP_MS) {
        last = at;
        return 1;
      }
      return 0;
    },
  };
}

export const WEB_STEPS_KEY = 'kabe.webSteps';
export const WEB_STEPS_EVENT = 'kabe-websteps'; // turned on from the Activity screen
export const WEB_STEPS_ACTIVE_EVENT = 'kabe-websteps-active'; // motion readings are arriving

export type MotionAnswer = 'granted' | 'denied' | 'unsupported';

/** Asks the browser for motion access. iPhone Safari shows its own question, and only when this is called from a tap. */
export async function requestMotion(): Promise<MotionAnswer> {
  const w = globalThis as any;
  const DME = w.DeviceMotionEvent;
  if (!DME) return 'unsupported';
  if (typeof DME.requestPermission === 'function') {
    try {
      return (await DME.requestPermission()) === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  return 'granted'; // Android browsers need no question
}

/** Starts listening; returns a function that stops. `onActive` fires when the first reading arrives. */
export function startMotion(onSteps: (n: number) => void, onActive: () => void): () => void {
  const w = globalThis as any;
  const det = stepDetector();
  let seen = false;
  const handler = (e: any) => {
    const a = e?.accelerationIncludingGravity;
    if (!a || typeof a.x !== 'number' || typeof a.y !== 'number' || typeof a.z !== 'number') return;
    if (!seen) {
      seen = true;
      onActive();
    }
    const n = det.push(a.x, a.y, a.z, typeof e.timeStamp === 'number' ? e.timeStamp : Date.now());
    if (n) onSteps(n);
  };
  w.addEventListener('devicemotion', handler);
  return () => w.removeEventListener('devicemotion', handler);
}
