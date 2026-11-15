// The community cache: nutrition numbers other Kabe users' AI lookups already produced, so the same food is not worked out again.
// Only a food's name and its nutrition per 100 g are shared, never who logged it or when (see supabase/food_cache.sql).
// Every call is optional: with no connection, no account or no cache set up, the app simply carries on without it.
import { Known, sanitizeKnown } from './foodMemory';
import { MicroRow, parseMicro } from './micro';

export type CacheClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

const TRUST_USES = 2; // a food counts as known once two lookups agreed on it

/** Foods other people's lookups already worked out, by memKey. */
export async function getSharedFoods(c: CacheClient | null, keys: string[]): Promise<Record<string, Known>> {
  const out: Record<string, Known> = {};
  if (!c || !keys.length) return out;
  try {
    const { data, error } = await c.rpc('kabe_cache_get', { p_keys: keys.slice(0, 20) });
    if (error || !Array.isArray(data)) return out;
    for (const r of data as Record<string, unknown>[]) {
      if (typeof r.key !== 'string' || typeof r.uses !== 'number' || r.uses < TRUST_USES) continue;
      const k = sanitizeKnown({ name: r.name, unit: r.unit, unitGrams: Number(r.unit_grams), per100: r.per100, n: r.uses });
      if (k) out[r.key] = k;
    }
  } catch {
    /* offline or not set up */
  }
  return out;
}

export async function putSharedFood(c: CacheClient | null, key: string, k: Known): Promise<void> {
  if (!c || !key) return;
  try {
    await c.rpc('kabe_cache_put', { p_key: key, p_name: k.name, p_unit: k.unit, p_unit_grams: k.unitGrams, p_per100: k.per100 });
  } catch {
    /* a failed contribution does not matter */
  }
}

export async function getSharedMicros(c: CacheClient | null, keys: string[]): Promise<Record<string, MicroRow>> {
  const out: Record<string, MicroRow> = {};
  if (!c || !keys.length) return out;
  try {
    const { data, error } = await c.rpc('kabe_micro_get', { p_keys: keys.slice(0, 20) });
    if (error || !Array.isArray(data)) return out;
    for (const r of data as Record<string, unknown>[]) {
      if (typeof r.key !== 'string' || typeof r.uses !== 'number' || r.uses < TRUST_USES) continue;
      const row = parseMicro(r.data);
      if (row) out[r.key] = row;
    }
  } catch {
    /* offline or not set up */
  }
  return out;
}

export async function putSharedMicro(c: CacheClient | null, key: string, row: MicroRow): Promise<void> {
  if (!c || !key) return;
  try {
    await c.rpc('kabe_micro_put', { p_key: key, p_data: row });
  } catch {
    /* a failed contribution does not matter */
  }
}
