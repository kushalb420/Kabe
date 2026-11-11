// Which font file a text uses, from the weight a screen asks for (pure, tested in scripts/test-fonts.ts).
// Headings and bold labels use Space Grotesk (a close, free stand-in for Cabinet Grotesk); body text uses DM Sans
// (a free stand-in for Satoshi). Every weight is its own font file because Android cannot bold a custom font.
export const BOLD_FONT = 'SpaceGrotesk_700Bold';
export const FONT_FILES = ['SpaceGrotesk_700Bold', 'DMSans_400Regular', 'DMSans_500Medium', 'DMSans_700Bold'] as const;
export type FontName = (typeof FONT_FILES)[number];

export function fontFor(weight: string | number | undefined | null): FontName {
  const w = typeof weight === 'string' ? (weight === 'bold' ? 700 : weight === 'normal' ? 400 : parseInt(weight, 10)) : weight;
  if (typeof w !== 'number' || !isFinite(w)) return 'DMSans_400Regular';
  if (w >= 700) return 'SpaceGrotesk_700Bold';
  if (w >= 600) return 'DMSans_700Bold';
  if (w >= 500) return 'DMSans_500Medium';
  return 'DMSans_400Regular';
}
