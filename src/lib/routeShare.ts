// What goes on the route card and how it travels to the website (pure, tested in scripts/test-routecard.ts).
// The website (https://kushalb420.github.io/route) draws the same card from a link and lets the person download it as a picture.
// Everything is in the part of the link after "#", which a browser never sends to any server.
import { base64ToBytes, decodeRoute, encodeRoute, type Route } from './routeCard';
import { bytesToBase64 } from './voice';
import { formatClock, formatPaceMin } from './gps';

export const SITE = 'https://kushalb420.github.io';

export type StoryData = {
  kind: string; // "RUN"
  date: string; // "14 Nov"
  km: string; // "6.09"
  distanceLabel: string;
  paceLabel: string;
  pace: string;
  timeLabel: string;
  time: string;
  footer: string;
  route: string; // encodeRoute text
};

const FIELDS: (keyof StoryData)[] = ['kind', 'date', 'km', 'distanceLabel', 'paceLabel', 'pace', 'timeLabel', 'time', 'footer', 'route'];

const toUrlSafe = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromUrlSafe = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/');

/** The link that opens this card on the website. */
export function storyUrl(d: StoryData): string {
  const json = JSON.stringify(Object.fromEntries(FIELDS.map((k) => [k, String(d[k]).slice(0, 4000)])));
  return `${SITE}/route#${toUrlSafe(bytesToBase64(new TextEncoder().encode(json)))}`;
}

/** The card data from a link's "#..." part; null when it is not a card made by Kabe. */
export function parseStoryHash(hash: string): StoryData | null {
  try {
    const raw = hash.replace(/^#/, '');
    if (!raw || raw.length > 12000) return null;
    const o = JSON.parse(new TextDecoder().decode(base64ToBytes(fromUrlSafe(raw)))) as Record<string, unknown>;
    const d = {} as Record<string, string>;
    for (const k of FIELDS) {
      if (typeof o[k] !== 'string') return null;
      d[k] = (o[k] as string).slice(0, k === 'route' ? 12000 : 80);
    }
    return d as unknown as StoryData;
  } catch {
    return null;
  }
}

type Say = (key: any, vars?: Record<string, string | number>) => string;

/** The texts on a card, from a finished (or saved) session, in the app's language. */
export function buildStoryData(
  i: { kind: 'walk' | 'run' | 'cycle'; date: Date; km: number; minutes: number; seconds?: number; route: Route },
  t: Say,
  locale?: string,
): StoryData {
  const sec = i.seconds && i.seconds > 0 ? i.seconds : i.minutes * 60;
  const hours = sec / 3600;
  const kmh = i.km >= 0.05 && sec > 0 ? Math.round((i.km / hours) * 10) / 10 : null;
  const pace = i.km >= 0.05 && sec > 0 ? sec / 60 / i.km : null;
  const cycle = i.kind === 'cycle';
  return {
    kind: String(t(`act.type.${i.kind}`)).toUpperCase(),
    date: i.date.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
    km: i.km.toFixed(2),
    distanceLabel: `${String(t('track.distance')).toUpperCase()} · KM`,
    paceLabel: String(t(cycle ? 'track.speed' : 'track.pace')),
    pace: cycle ? (kmh === null ? '–' : String(t('track.speedVal', { v: kmh }))) : pace === null ? '–' : String(t('track.paceVal', { p: formatPaceMin(pace) })),
    timeLabel: String(t('route.time')),
    time: formatClock(sec * 1000),
    footer: String(t('route.footer')),
    route: encodeRoute(i.route),
  };
}

export const routeOfStory = (d: StoryData): Route => decodeRoute(d.route);
