import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Key } from '../i18n';
import { useT } from '../i18n/useT';
import { foodFromMealItem } from '../lib/myFoods';
import { r0, r1, scaleToGrams } from '../lib/nutrition';
import { SAVED_DIETS, SavedDiet, foodToItem } from '../lib/savedMeals';
import { MealType, SavedMealItem, useKabe } from '../store/kabe';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { goBack } from '../lib/nav';
import { FoodPicker } from './FoodPicker';
import { Text, TextInput } from './Text';
import { Button, Card } from './ui';

/**
 * A saved meal opened up. Everything can be changed here: its name, what kind of diet it suits, the amount of every food, which
 * foods are in it (take one out, or search and add more), and a single food can be kept in Saved foods with the star. Then log it
 * (and, if you like, save the changes back into the meal).
 */
export function SavedMealCard({ id, meal, date }: { id: string; meal: MealType; date: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { savedMeals, favorites, toggleFavorite, addMealItems, updateSavedMeal } = useKabe();
  const sm = savedMeals.find((m) => m.id === id);
  const [draft, setDraft] = useState<SavedMealItem[]>(sm?.items ?? []);
  const [grams, setGrams] = useState<Record<number, string>>({}); // what is typed in an amount box, by position
  const [name, setName] = useState(sm?.name ?? '');
  const [diet, setDiet] = useState<SavedDiet | undefined>(sm?.diet);
  const [adding, setAdding] = useState(false);
  const [dirty, setDirty] = useState(false);
  if (!sm) return null;

  const items = draft.map((orig, i) => {
    const g = parseFloat(grams[i] ?? '');
    return g > 0 && g !== orig.grams ? scaleToGrams(orig, g) : orig;
  });
  const total = items.reduce((a, x) => a + x.kcal, 0);
  const touch = () => setDirty(true);
  const log = () => {
    addMealItems(items, meal, date);
    goBack();
  };
  const save = () => {
    updateSavedMeal(sm.id, items, { name: name.trim() || sm.name, diet: diet ?? null });
    setDraft(items);
    setGrams({});
    setDirty(false);
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={styles.label}>{t('saved.rename')}</Text>
      <TextInput value={name} onChangeText={(v) => { setName(v); touch(); }} style={styles.input} placeholderTextColor={colors.inkSoft} maxLength={60} />
      <View style={styles.chips}>
        {SAVED_DIETS.map((d) => (
          <Pressable key={d} onPress={() => { setDiet(diet === d ? undefined : d); touch(); }} style={[styles.chip, diet === d && styles.chipOn]}>
            <Text style={[styles.chipText, diet === d && { color: colors.onPrimary }]}>{t(`saved.diet.${d}` as Key)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.sub}>{t('saved.editHint')}</Text>
      {draft.map((orig, i) => {
        const item = items[i];
        const food = foodFromMealItem(item);
        const starred = !!food && favorites.includes(food.id);
        return (
          <View key={`${i}-${orig.name}`} style={styles.item}>
            <View style={styles.top}>
              <Text style={[styles.name, { flex: 1 }]} numberOfLines={2}>{item.name}</Text>
              {food && (
                <Pressable hitSlop={10} onPress={() => toggleFavorite(food)} accessibilityLabel={t('saved.keepFood')}>
                  <Ionicons name={starred ? 'star' : 'star-outline'} size={22} color={colors.accent} />
                </Pressable>
              )}
              <Pressable
                hitSlop={10}
                onPress={() => {
                  setDraft(items.filter((_, k) => k !== i)); // keeps the amounts typed so far
                  setGrams({});
                  touch();
                }}
                accessibilityLabel={t('common.remove')}
              >
                <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
              </Pressable>
            </View>
            <View style={styles.top}>
              <TextInput
                value={grams[i] ?? String(Math.round(item.grams))}
                onChangeText={(v) => { setGrams((g) => ({ ...g, [i]: v })); touch(); }}
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
      {adding ? (
        <View style={{ gap: 8 }}>
          <FoodPicker
            initialQuery=""
            onPick={(f) => {
              setDraft([...items, foodToItem(f)]); // keep amounts typed so far, then add the new food at its usual serving
              setGrams({});
              setAdding(false);
              touch();
            }}
          />
          <Button title={t('common.cancel')} variant="ghost" onPress={() => setAdding(false)} />
        </View>
      ) : (
        <Button title={t('saved.addFood')} icon="add" variant="ghost" onPress={() => setAdding(true)} />
      )}
      <Text style={styles.total}>{t('saved.total', { kcal: r0(total) })}</Text>
      <Button title={t('addFood.addToDiary')} icon="checkmark" onPress={log} disabled={items.length === 0} />
      {dirty && items.length > 0 && <Button title={t('saved.saveChanges')} icon="bookmark" variant="ghost" onPress={save} />}
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, fontWeight: '700', color: colors.ink, backgroundColor: colors.card },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  total: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
  item: { gap: 6, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grams: { width: 84, fontSize: 16, fontWeight: '700', borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10, color: colors.ink, backgroundColor: colors.card },
});
