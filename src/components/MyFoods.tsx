import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Alert } from '../lib/alert';
import type { Food } from '../data/foods';
import { useT } from '../i18n/useT';
import { searchMine } from '../lib/myFoods';
import { macrosFor, r0, r1 } from '../lib/nutrition';
import { MealType, useKabe } from '../store/kabe';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { Text, TextInput } from './Text';
import { Button, Card } from './ui';
import { SavedMealCard } from './SavedMealCard';
import { goBack } from '../lib/nav';

/**
 * Search only what you have logged before, your favourites and your saved meals (there is no built-in food list; new foods
 * come from describing a meal or taking a photo). Pick one, choose the amount, add it.
 */
export function MyFoods({ meal, date }: { meal: MealType; date: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { historyFoods, customFoods, favorites, allFoods, savedMeals, addEntry, toggleFavorite, deleteSavedMeal } = useKabe();
  const [openMeal, setOpenMeal] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');

  // favourites may be foods saved earlier (not necessarily in the history any more)
  const favoriteFoods = useMemo(() => {
    const pool = new Map([...allFoods, ...historyFoods].map((f) => [f.id, f]));
    return favorites.map((id) => pool.get(id)).filter((f): f is Food => !!f);
  }, [favorites, allFoods, historyFoods]);

  // foods saved from a label come first, then everything logged before (one of each)
  const mine = useMemo(() => {
    const seen = new Set(customFoods.map((f) => f.id));
    return [...customFoods, ...historyFoods.filter((f) => !seen.has(f.id))];
  }, [customFoods, historyFoods]);
  const matches = useMemo(() => searchMine(mine, query), [mine, query]);
  const q = query.trim();

  const pick = (f: Food) => {
    setSelected(f);
    setGrams(String(f.servingG));
  };
  const g = parseFloat(grams);
  const preview = selected && g > 0 ? macrosFor(selected, g) : null;
  const add = () => {
    if (!selected || !(g > 0)) return;
    addEntry(selected, g, meal, date);
    goBack();
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.inkSoft} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('mine.search')} placeholderTextColor={colors.inkSoft} style={styles.search} />
      </View>

      {selected && (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>
              {selected.name}
            </Text>
            <Pressable hitSlop={10} onPress={() => toggleFavorite(selected)}>
              <Ionicons name={favorites.includes(selected.id) ? 'star' : 'star-outline'} size={24} color={colors.accent} />
            </Pressable>
          </View>
          <View style={styles.gramsRow}>
            <TextInput value={grams} onChangeText={setGrams} keyboardType="decimal-pad" style={styles.gramsInput} selectTextOnFocus />
            <Text style={styles.sub}>g</Text>
            <Text style={[styles.sub, { flex: 1 }]}>({selected.servingLabel})</Text>
          </View>
          {preview && (
            <Text style={styles.preview}>
              {r0(preview.kcal)} kcal · {t('macro.protein')} {r1(preview.protein)} g · {t('macro.carbs')} {r1(preview.carbs)} g · {t('macro.fat')} {r1(preview.fat)} g
            </Text>
          )}
          <Button title={t('addFood.addToDiary')} icon="checkmark" onPress={add} disabled={!preview} />
          <Button title={t('common.cancel')} variant="ghost" onPress={() => setSelected(null)} />
        </Card>
      )}

      {!q && savedMeals.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={styles.heading}>{t('addFood.savedMeals')}</Text>
          {savedMeals.map((sm) => (
            <View key={sm.id} style={{ gap: 8 }}>
            <Pressable
              style={styles.savedRow}
              onPress={() => setOpenMeal(openMeal === sm.id ? null : sm.id)}
              onLongPress={() =>
                Alert.alert(t('addFood.deleteSaved'), sm.name, [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('common.delete'), style: 'destructive', onPress: () => deleteSavedMeal(sm.id) },
                ])
              }
            >
              <Ionicons name={openMeal === sm.id ? 'chevron-down' : 'bookmark'} size={16} color={colors.primary} />
              <Text style={styles.savedName} numberOfLines={1}>
                {sm.name}
              </Text>
              <Text style={styles.sub}>{r0(sm.items.reduce((a, i) => a + i.kcal, 0))} kcal</Text>
            </Pressable>
            {openMeal === sm.id && <SavedMealCard key={sm.id} id={sm.id} meal={meal} date={date} />}
            </View>
          ))}
          <Text style={styles.sub}>{t('addFood.savedHint')}</Text>
        </View>
      )}

      {!q && favoriteFoods.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={styles.heading}>{t('addFood.favourites')}</Text>
          <View style={styles.chips}>
            {favoriteFoods.map((f) => (
              <Pressable key={f.id} style={styles.chip} onPress={() => pick(f)}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {f.name.split(',')[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: 4 }}>
        <Text style={styles.heading}>{q ? t('mine.results') : t('mine.history')}</Text>
        {matches.length === 0 ? (
          <Text style={styles.sub}>{mine.length === 0 ? t('mine.empty') : t('mine.noMatch')}</Text>
        ) : (
          matches.slice(0, 60).map((f) => (
            <Pressable key={f.id} onPress={() => pick(f)} style={[styles.item, selected?.id === f.id && { backgroundColor: colors.primarySoft }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text style={styles.sub}>
                  {r0(f.kcal)} kcal · {t('macro.protein')} {r1(f.protein)} · {t('macro.carbs')} {r1(f.carbs)} · {t('macro.fat')} {r1(f.fat)} / 100 g
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: BORDER, borderColor: colors.line },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.ink },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 12, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.5, textTransform: 'uppercase' },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  gramsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gramsInput: { width: 90, fontSize: 22, fontWeight: '700', borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, color: colors.ink, backgroundColor: colors.card },
  preview: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { maxWidth: 180, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.primarySoft, borderWidth: BORDER, borderColor: colors.cardBorder },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.sm, padding: 12, borderWidth: BORDER, borderColor: colors.line },
  savedName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: radius.sm },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
