// A developer's own Google AI key for local work (EXPO_PUBLIC_GEMINI_KEY in .env). Never use this for a release:
// anything EXPO_PUBLIC_ is readable inside the finished app. Releases use the backend AI proxy instead (docs/DEPLOY.md).
export const BUILTIN_GEMINI_KEY: string = (process.env.EXPO_PUBLIC_GEMINI_KEY ?? '').trim();
