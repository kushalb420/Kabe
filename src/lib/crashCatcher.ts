/**
 * If something goes wrong in the app's code, show what it was instead of the app silently closing. The message is also
 * the quickest way to tell the developer what to fix: take a screenshot of it.
 */
type Listener = (message: string) => void;
let last = '';
const listeners = new Set<Listener>();

export function describeError(e: unknown, fatal?: boolean): string {
  const head = fatal ? 'FATAL ' : '';
  if (e instanceof Error) return `${head}${e.name}: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 14).join('\n')}`;
  return `${head}${String(e)}`;
}

export function reportCrash(e: unknown, fatal?: boolean): void {
  last = describeError(e, fatal);
  listeners.forEach((l) => l(last));
}

const clearers = new Set<() => void>();
/** The person pressed "Try to continue": forget the error and let the app draw again. */
export function clearCrash(): void {
  last = '';
  listeners.forEach((l) => l(''));
  clearers.forEach((c) => c());
}
export function onCrashCleared(c: () => void): () => void {
  clearers.add(c);
  return () => {
    clearers.delete(c);
  };
}

/** Small errors that did not stop anything (a failed timer or handler). Kept for debugging, never shown full screen. */
export const quietErrors: string[] = [];

export function onCrash(l: Listener): () => void {
  listeners.add(l);
  if (last) l(last);
  return () => {
    listeners.delete(l);
  };
}

const EU = (globalThis as { ErrorUtils?: { setGlobalHandler?: (h: (e: unknown, fatal?: boolean) => void) => void; getGlobalHandler?: () => (e: unknown, fatal?: boolean) => void } }).ErrorUtils;
if (EU?.setGlobalHandler) {
  const previous = EU.getGlobalHandler?.();
  EU.setGlobalHandler((e, fatal) => {
    if (fatal) {
      reportCrash(e, true); // a fatal error is shown on screen instead of closing the app
      return;
    }
    // a non-fatal error did not stop the app: note it quietly instead of covering the screen with an error page
    quietErrors.push(describeError(e));
    if (quietErrors.length > 20) quietErrors.shift();
    previous?.(e, fatal);
  });
}
