// Which cards show on the Today screen, and in what order (pure logic, tested in scripts/test-dashboard.ts).
// The calorie ring at the top is always shown; everything below it can be hidden or moved.

export const CARD_IDS = ['macros', 'meals', 'water', 'activity', 'route', 'logFood'] as const;
export type CardId = (typeof CARD_IDS)[number];
export type Layout = { order: CardId[]; hidden: CardId[] };

// What people do most comes first: log, scan, then today's numbers, then the extras.
export const DEFAULT_ORDER: CardId[] = ['logFood', 'macros', 'water', 'activity', 'route', 'meals'];
export const DEFAULT_LAYOUT: Layout = { order: [...DEFAULT_ORDER], hidden: [] };

const isCard = (x: unknown): x is CardId => typeof x === 'string' && (CARD_IDS as readonly string[]).includes(x);

/** Anything stored or synced is cleaned: unknown ids dropped, repeats removed, new cards added at the end, hidden kept only for real cards. */
export function sanitizeLayout(raw: unknown): Layout {
  const o = (raw && typeof raw === 'object' ? raw : {}) as { order?: unknown; hidden?: unknown };
  const seen = new Set<CardId>();
  const order: CardId[] = [];
  for (const x of Array.isArray(o.order) ? o.order : []) {
    if (isCard(x) && !seen.has(x)) {
      seen.add(x);
      order.push(x);
    }
  }
  for (const id of DEFAULT_ORDER) if (!seen.has(id)) order.push(id); // a card added by a newer version shows up instead of vanishing
  const hidden = [...new Set((Array.isArray(o.hidden) ? o.hidden : []).filter(isCard))];
  return { order, hidden };
}

export const visibleOrder = (l: Layout): CardId[] => l.order.filter((id) => !l.hidden.includes(id));

export function toggleHidden(l: Layout, id: CardId): Layout {
  return { order: l.order, hidden: l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id] };
}

/** Move one step up (-1) or down (1) among ALL cards (hidden ones keep their place), staying inside the list. */
export function move(l: Layout, id: CardId, dir: -1 | 1): Layout {
  const i = l.order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= l.order.length) return l;
  const order = [...l.order];
  [order[i], order[j]] = [order[j], order[i]];
  return { order, hidden: l.hidden };
}

export const isDefault = (l: Layout): boolean => l.hidden.length === 0 && l.order.every((id, i) => id === DEFAULT_LAYOUT.order[i]);
