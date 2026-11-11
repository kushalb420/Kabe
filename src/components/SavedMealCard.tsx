import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useT } from '../i18n/useT';
import { foodFromMealItem } from '../lib/myFoods';
import { r0, r1, scaleToGrams } from '../lib/nutrition';
import { MealType, SavedMealItem, useKabe } from '../store/kabe';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { goBack } from '../lib/nav';
import { Text, TextInput } from './Text';
import { Button, Card } from './ui';

/**
 * A saved meal opened up: every food in it with its amount. Change an amount, take an item out, keep a single food in Saved
 * foods with the star, then log it (and, if you like, save the changes back into the meal).
 */
export function SavedMealCard({ id, meal, date }: { id: string; meal: MealType; date: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { savedMeals, favorites, toggleFavorite, addMealItems, updateSavedMeal } = useKabe();
  const sm = savedMeals.find((m) => m.id === id);
  const [grams, setGrams] = useState<Record<number, string>>({});
  const [removed, setRemoved] = useState<number[]>([]);

  // the edited list, always worked out from the saved amounts so nothing drifts
  const list = useMemo(() => {
    if (!sm) return [] as { i: number; item: SavedMealItem }[];
    return sm.items
      .map((orig, i) => {
        const g = parseFloat(grams[i] ?? '');
        return { i, item: g > 0 && g !== orig.grams ? scaleToGrams(orig, g) : orig };
      })
      .filter((x) => !removed.includes(x.i));
  }, [sm, grams, removed]);
  if (!sm) return null;

  const total = list.reduce((a, x) => a + x.item.kcal, 0);
  const items = list.map((x) => x.item);
  const log = () => {
    addMealItems(items, meal, date);
    goBack();
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.title} numberOfLines={2}>{sm.name}</Text>
      <Text style={styles.sub}>{t('saved.editHint')}</Text>
      {list.map(({ i, item }) => {
        const food = foodFromMealItem(item);
        const starred = !!food && favorites.includes(food.id);
        return (
          <View key={i} style={styles.item}>
            <View style={styles.top}>
              <Text style={[styles.name, { flex: 1 }]} numberOfLines={2}>{item.name}</Text>
              {food && (
                <Pressable hitSlop={10} onPress={() => toggleFavorite(food)} accessibilityLabel={t('saved.keepFood')}>
                  <Ionicons name={starred ? 'star' : 'star-outline'} size={22} color={colors.accent} />
                </Pressable>
              )}
              <Pressable hitSlop={10} onPress={() => setRemoved((r) => [...r, i])} accessibilityLabel={t('common.remove')}>
                <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
              </Pressable>
            </View>
            <View style={styles.top}>
              <TextInput
                value={grams[i] ?? String(Math.round(item.grams))}
                onChangeText={(v) => setGrams((g) => ({ ...g, [i]: v }))}
                keyboardType="decimal-pad"
                selectTextOnFocus
                style={styles.grams}
              />
              <Text style={styles.sub}>g</Text>
              <Text style={[styles.sub, { flex: 1, textAlign: 'right' }]}>
                {r0(item.kcal)} kcal · {t('macro.protein')} {r1(item.protein)} · {t('macro.carbs')} {r1(item.carbs)} · {t('macro.fat')} {r1(item.fat)}
              </Text>
            </View>
          </View>
        );
      })}
      <Text style={styles.total}>{t('saved.total', { kcal: r0(total) })}</Text>
      <Button title={t('addFood.addToDiary')} icon="checkmark" onPress={log} disabled={items.length === 0} />
      {(removed.length > 0 || Object.keys(grams).length > 0) && items.length > 0 && (
        <Button title={t('saved.saveChanges')} icon="bookmark" variant="ghost" onPress={() => { updateSavedMeal(sm.id, items); setGrams({}); setRemoved([]); }} />
      )}
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  total: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
  item: { gap: 6, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grams: { width: 84, fontSize: 16, fontWeight: '700', borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10, color: colors.ink, backgroundColor: colors.card },
});
