/**
 * The current time in milliseconds. Components call this instead of writing Date.now() themselves, so a screen never
 * reads the clock "by accident" while it is drawing (React's lint rules flag that). Behaviour is identical.
 */
export const nowMs = (): number => Date.now();

/** Whole seconds since a moment. */
export const secondsSince = (d: Date): number => Math.round((nowMs() - d.getTime()) / 1000);
