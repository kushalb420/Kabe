import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NutrientGrid } from '../../src/components/NutrientGrid';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { Card, LinkRow } from '../../src/components/ui';
import { FEATURES } from '../../src/config/app';
import type { Key } from '../../src/i18n';
import { useT } from '../../src/i18n/useT';
import { r0, sumMacros, sumOptional, toDateKey } from '../../src/lib/nutrition';
import { MEALS, useKabe } from '../../src/store/kabe';
import { useColors, useThemedStyles, type Colors } from '../../src/theme';
import { Sticker } from '../../src/components/Sticker';

const shift = (d: Date, days: number) => {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
};

type Entry = ReturnType<typeof useKabe>['entries'][number];
/** The seven numbers for a set of entries (free sugar and saturated fat count what is known). */
const nutrientsOf = (list: Entry[]) => {
  const m = sumMacros(list);
  return { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: m.fiber, sugar: sumOptional(list, 'sugar').total, satFat: sumOptional(list, 'satFat').total };
};

/** The Meals tab: what you ate (with the totals of every meal and of the day) and the food tools: kitchen, eating out, what to eat next. */
export default function Meals() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { entries } = useKabe();
  const { t } = useT();
  const [day, setDay] = useState(new Date());
  const key = toDateKey(day);
  const isToday = key === toDateKey(new Date());
  const dayEntries = useMemo(() => entries.filter((e) => e.date === key), [entries, key]);

  const label = isToday ? t('diary.today') : day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Screen title={t('diary.title')} headerRight={<Sticker name="salmon" size={62} tilt={-8} bob style={{ marginTop: 6 }} />}>
      {FEATURES.kitchen && <LinkRow icon="restaurant-outline" title={t('today.kitchen')} sub={t('today.kitchenSub')} onPress={() => router.push('/kitchen')} />}
      {FEATURES.restaurant && <LinkRow icon="storefront-outline" title={t('today.restaurant')} sub={t('today.restaurantSub')} onPress={() => router.push('/restaurant')} />}
      {FEATURES.nextMeal && <LinkRow icon="bulb-outline" title={t('next.link')} sub={t('next.linkSub')} onPress={() => router.push({ pathname: '/kitchen', params: { fit: '1' } })} />}

      <View style={styles.dateRow}>
        <Pressable onPress={() => setDay(shift(day, -1))} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.date}>{label}</Text>
        <Pressable onPress={() => setDay(shift(day, 1))} hitSlop={12} disabled={isToday}>
          <Ionicons name="chevron-forward" size={24} color={isToday ? colors.line : colors.ink} />
        </Pressable>
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={styles.sectionTitle}>{t('diary.dayTotal')}</Text>
        <NutrientGrid values={nutrientsOf(dayEntries)} />
      </Card>

      {MEALS.map((m) => {
        const items = dayEntries.filter((e) => e.meal === m.key);
        return (
          <Card key={m.key} style={{ gap: 8 }}>
            <View style={styles.mealHead}>
              <Ionicons name={m.icon as any} size={20} color={colors.primary} />
              <Text style={styles.mealTitle}>{t(`meal.${m.key}` as Key)}</Text>
              <Text style={styles.mealKcal}>{r0(sumMacros(items).kcal)} kcal</Text>
              {items.length > 0 && (
                <Pressable hitSlop={10} onPress={() => router.push({ pathname: '/save-meal', params: { date: key, meal: m.key } })}>
                  <Ionicons name="bookmark-outline" size={22} color={colors.primary} />
                </Pressable>
              )}
              <Pressable hitSlop={10} onPress={() => router.push({ pathname: '/add-food', params: { date: key, meal: m.key } })}>
                <Ionicons name="add-circle" size={28} color={colors.primary} />
              </Pressable>
            </View>
            {items.length === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Sticker name="egg" size={34} tilt={-8} />
                <Text style={[styles.empty, { flex: 1 }]}>{t('diary.nothing')}</Text>
              </View>
            ) : (
              <>
                <NutrientGrid values={nutrientsOf(items)} compact />
                {items.map((e) => (
                  <Pressable key={e.id} style={styles.row} onPress={() => router.push({ pathname: '/edit-entry', params: { id: e.id } })}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {e.name}
                      </Text>
                      <Text style={styles.rowSub}>
                        {r0(e.grams)} g · P {r0(e.protein)} · C {r0(e.carbs)} · F {r0(e.fat)}
                      </Text>
                    </View>
                    <Text style={styles.rowKcal}>{r0(e.kcal)}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </Card>
        );
      })}
      <Text style={styles.hint}>{t('diary.tip')}</Text>
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 18, fontWeight: '700', color: colors.ink },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
  mealKcal: { fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  empty: { color: colors.inkSoft, fontSize: 13, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  rowKcal: { fontSize: 16, fontWeight: '700', color: colors.ink },
  hint: { textAlign: 'center', fontSize: 12, color: colors.inkSoft },
});
