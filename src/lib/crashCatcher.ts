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
    reportCrash(e, fatal);
    if (!fatal) previous?.(e, fatal); // a fatal error is shown on screen instead of closing the app
  });
}
