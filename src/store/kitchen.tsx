import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_EQUIPMENT, Detail, Diet, Equipment, PantryItem, Suggestion, inPantry, sanitizeEquipment } from '../lib/kitchenAi';
import { KITCHEN_SYNC_KEYS } from '../lib/sync';

export type SavedRecipe = Suggestion & { detail: Detail | null; savedAt: string };
export type ShopItem = { id: string; name: string; done: boolean; why?: string };

type Persisted = {
  pantry: PantryItem[];
  savedRecipes: SavedRecipe[];
  shopping: ShopItem[];
  equipment: Equipment;
  equipmentSet: boolean; // the person has told us what they cook with
  diet: Diet;
};

const DEFAULTS: Persisted = { pantry: [], savedRecipes: [], shopping: [], equipment: DEFAULT_EQUIPMENT, equipmentSet: false, diet: 'any' };
const KEY = 'kabe:kitchen:v2';
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type Ctx = Persisted & {
  ready: boolean;
  addPantry: (name: string, qty?: string) => void;
  addPantryMany: (items: { name: string; qty: string }[]) => number;
  removePantry: (id: string) => void;
  clearPantry: () => void;
  saveRecipe: (s: Suggestion, detail: Detail | null) => void;
  removeRecipe: (id: string) => void;
  addShopping: (name: string, why?: string) => void;
  toggleShopping: (id: string) => void;
  removeShopping: (id: string) => void;
  /** Moves ticked buy-list items into the pantry. */
  moveBought: () => void;
  setEquipment: (e: Equipment) => void;
  setDiet: (d: Diet) => void;
  importSnapshot: (s: Record<string, unknown>) => void;
  resetKitchen: () => void;
};

const KitchenContext = createContext<Ctx | null>(null);

export function KitchenProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Persisted>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        setData({ ...DEFAULTS, ...saved, equipment: sanitizeEquipment(saved.equipment) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
  }, [data, ready]);

  const addPantry = useCallback((name: string, qty = '') => {
    const n = name.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!n) return;
    setData((d) => (inPantry(n, d.pantry) && d.pantry.some((p) => p.name.toLowerCase() === n.toLowerCase()) ? d : { ...d, pantry: [...d.pantry, { id: uid(), name: n, qty: qty.trim().slice(0, 30) }] }));
  }, []);
  const addPantryMany = useCallback((items: { name: string; qty: string }[]) => {
    setData((d) => ({ ...d, pantry: [...d.pantry, ...items.map((i) => ({ id: uid(), name: i.name, qty: i.qty }))].slice(0, 200) }));
    return items.length;
  }, []);
  const removePantry = useCallback((id: string) => setData((d) => ({ ...d, pantry: d.pantry.filter((p) => p.id !== id) })), []);
  const clearPantry = useCallback(() => setData((d) => ({ ...d, pantry: [] })), []);
  const saveRecipe = useCallback(
    (s: Suggestion, detail: Detail | null) =>
      setData((d) => ({ ...d, savedRecipes: [{ ...s, detail, savedAt: new Date().toISOString() }, ...d.savedRecipes.filter((r) => r.name.toLowerCase() !== s.name.toLowerCase())].slice(0, 100) })),
    [],
  );
  const removeRecipe = useCallback((id: string) => setData((d) => ({ ...d, savedRecipes: d.savedRecipes.filter((r) => r.id !== id) })), []);
  const addShopping = useCallback((name: string, why?: string) => {
    const n = name.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!n) return;
    setData((d) => (d.shopping.some((s) => s.name.toLowerCase() === n.toLowerCase()) ? d : { ...d, shopping: [...d.shopping, { id: uid(), name: n, done: false, ...(why ? { why: why.slice(0, 120) } : {}) }] }));
  }, []);
  const toggleShopping = useCallback((id: string) => setData((d) => ({ ...d, shopping: d.shopping.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) })), []);
  const removeShopping = useCallback((id: string) => setData((d) => ({ ...d, shopping: d.shopping.filter((s) => s.id !== id) })), []);
  const moveBought = useCallback(
    () =>
      setData((d) => {
        const bought = d.shopping.filter((s) => s.done);
        if (!bought.length) return d;
        const fresh = bought.filter((b) => !inPantry(b.name, d.pantry)).map((b) => ({ id: uid(), name: b.name, qty: '' }));
        return { ...d, pantry: [...d.pantry, ...fresh], shopping: d.shopping.filter((s) => !s.done) };
      }),
    [],
  );
  const setEquipment = useCallback((equipment: Equipment) => setData((d) => ({ ...d, equipment: sanitizeEquipment(equipment), equipmentSet: true })), []);
  const setDiet = useCallback((diet: Diet) => setData((d) => ({ ...d, diet })), []);

  const importSnapshot = useCallback((s: Record<string, unknown>) => {
    setData((d) => {
      const next: Record<string, unknown> = { ...d };
      for (const k of KITCHEN_SYNC_KEYS) next[k] = s[k] ?? (DEFAULTS as Record<string, unknown>)[k];
      next.equipment = sanitizeEquipment(next.equipment);
      return next as Persisted;
    });
  }, []);
  const resetKitchen = useCallback(() => setData(DEFAULTS), []);

  const value = useMemo(
    () => ({ ...data, ready, addPantry, addPantryMany, removePantry, clearPantry, saveRecipe, removeRecipe, addShopping, toggleShopping, removeShopping, moveBought, setEquipment, setDiet, importSnapshot, resetKitchen }),
    [data, ready, addPantry, addPantryMany, removePantry, clearPantry, saveRecipe, removeRecipe, addShopping, toggleShopping, removeShopping, moveBought, setEquipment, setDiet, importSnapshot, resetKitchen],
  );
  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>;
}

export function useKitchen() {
  const ctx = useContext(KitchenContext);
  if (!ctx) throw new Error('useKitchen must be used inside KitchenProvider');
  return ctx;
}
