// What can leave the phone, and whether each route is currently on (pure logic, tested in scripts/test-privacy.ts).
// The list is static and written to match the code: only these network routes exist in Kabe.

export type FlowId = 'ai' | 'products' | 'cloud';
/** on = will be used when you use the feature · off = switched off · possible = used only when you do that action */
export type FlowStatus = 'on' | 'off' | 'possible';
export type Flow = { id: FlowId; status: FlowStatus };

/** `aiConsent` covers photos, voice, menus and the weekly summary; `coachConsent` is the coach chat's own agreement. Either one with a key means Google can be contacted. */
export function dataFlows(s: { geminiKey: string; aiConsent: boolean; coachConsent: boolean; cloudUser: boolean }): Flow[] {
  const hasKey = s.geminiKey.trim().length > 0;
  return [
    { id: 'ai', status: hasKey && (s.aiConsent || s.coachConsent) ? 'on' : 'off' },
    { id: 'products', status: 'possible' }, // shared barcode products: used when you scan a barcode or read a label for one
    { id: 'cloud', status: s.cloudUser ? 'on' : 'off' },
  ];
}

/** True when anything leaves the phone without a direct tap on a lookup/scan/AI feature. Kabe never does this. */
export const sendsInBackground = (s: { cloudUser: boolean }): boolean => s.cloudUser; // only your own sync, and only after you signed in
