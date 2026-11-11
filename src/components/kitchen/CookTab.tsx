import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Loading } from '../Loading';
import { coachLanguageName } from '../../i18n';
import type { Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { DIETS, MEAL_KINDS, MealKind, Suggestion, Suggestions, mealsLeftFor, missing, missingNames, perMealShare } from '../../lib/kitchenAi';
import { suggestMeals } from '../../lib/kitchenNet';
import { sumMacros, toDateKey } from '../../lib/nutrition';
import { useKabe } from '../../store/kabe';
import { useKitchen } from '../../store/kitchen';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../../theme';
import { NutrientGrid } from '../NutrientGrid';
import { Text, TextInput } from '../Text';
import { Button, Card } from '../ui';
import { DishDetail } from './DishDetail';
import { EquipmentPicker } from './EquipmentPicker';

const TIMES: (number | null)[] = [null, 15, 30, 45];

/** Meal ideas from your pantry. The list only appears after you press Enter (or Suggest); a dish's recipe is written when you open it. */
export function CookTab() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const params = useLocalSearchParams<{ fit?: string }>();
  const { geminiKey, aiConsent, setAiConsent, entries, goals, language } = useKabe();
  const kit = useKitchen();
  const [wish, setWish] = useState('');
  const [meal, setMeal] = useState<MealKind | 'any'>('any');
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [fit, setFit] = useState(params.fit === '1');
  const [result, setResult] = useState<Suggestions | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Suggestion | null>(null);
  const [draftEq, setDraftEq] = useState(kit.equipment);

  const today = toDateKey(new Date());
  const eaten = useMemo(() => sumMacros(entries.filter((e) => e.date === today)), [entries, today]);
  const left = { kcal: Math.max(0, goals.kcal - eaten.kcal), protein: Math.max(0, goals.protein - eaten.protein) };
  const ready = !!geminiKey && aiConsent;

  const run = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setFailed(false);
    try {
      setResult(await suggestMeals(geminiKey, { pantry: kit.pantry, equipment: kit.equipment, diet: kit.diet, meal, maxMinutes, remaining: fit ? perMealShare(left, mealsLeftFor(meal, new Date().getHours())) : null, wish, language: coachLanguageName(language) }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (open) return <DishDetail dish={open} onBack={() => setOpen(null)} />;

  if (!kit.equipmentSet) {
    return (
      <Card style={{ gap: 12 }}>
        <Text style={styles.h2}>{t('k2.setupTitle')}</Text>
        <Text style={styles.sub}>{t('k2.setupBody')}</Text>
        <EquipmentPicker value={draftEq} onChange={setDraftEq} />
        <Button title={t('k2.setupSave')} icon="checkmark" onPress={() => kit.setEquipment(draftEq)} />
      </Card>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {!ready && (
        <Card style={{ gap: 8 }}>
          <Text style={styles.sub}>{t('photo.consentBody')}</Text>
          {!!geminiKey && <Button title={t('photo.continue')} onPress={() => setAiConsent(true)} />}
        </Card>
      )}
      <Card style={{ gap: 10 }}>
        <TextInput value={wish} onChangeText={setWish} placeholder={t('k2.wishPh')} placeholderTextColor={colors.inkSoft} style={styles.input} returnKeyType="search" onSubmitEditing={run} blurOnSubmit />
        <View style={styles.chips}>
          {(['any', ...MEAL_KINDS] as const).map((m) => (
            <Pressable key={m} onPress={() => setMeal(m)} style={[styles.chip, meal === m && styles.chipOn]}>
              <Text style={[styles.chipText, meal === m && { color: colors.onPrimary }]}>{m === 'any' ? t('k2.anyMeal') : t(`meal.${m}` as Key)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chips}>
          {TIMES.map((n) => (
            <Pressable key={String(n)} onPress={() => setMaxMinutes(n)} style={[styles.chip, maxMinutes === n && styles.chipOn]}>
              <Text style={[styles.chipText, maxMinutes === n && { color: colors.onPrimary }]}>{n === null ? t('k2.anyTime') : t('k2.upTo', { n })}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chips}>
          {DIETS.map((d) => (
            <Pressable key={d} onPress={() => kit.setDiet(d)} style={[styles.chip, kit.diet === d && styles.chipOn]}>
              <Text style={[styles.chipText, kit.diet === d && { color: colors.onPrimary }]}>{t(`diet.${d}` as Key)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.fitRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{t('k2.fit')}</Text>
            <Text style={styles.sub}>{t('k2.fitLeft', { kcal: Math.round(left.kcal), p: Math.round(left.protein) })}</Text>
          </View>
          <Switch value={fit} onValueChange={setFit} trackColor={{ true: colors.primary }} />
        </View>
        <Button title={t('k2.suggest')} icon="sparkles" onPress={run} disabled={busy || !ready} />
      </Card>

      {busy && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Loading />
          <Text style={styles.body}>{t('k2.thinking')}</Text>
        </Card>
      )}
      {failed && !busy && (
        <Card>
          <Text style={styles.body}>{t('k2.again')}</Text>
        </Card>
      )}

      {result && !busy && (
        <>
          <Text style={styles.h2}>{t('k2.results')}</Text>
          {result.options.length === 0 && (
            <Card>
              <Text style={styles.body}>{t('k2.none')}</Text>
            </Card>
          )}
          {result.options.map((o) => {
            const gaps = missingNames(o);
            return (
              <Pressable key={o.id} onPress={() => setOpen(o)}>
                <Card style={{ gap: 8 }}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.dish, { flex: 1 }]}>{o.name}</Text>
                    <Text style={styles.sub}>{t('k2.minutes', { n: o.minutes })}</Text>
                  </View>
                  {o.why ? <Text style={styles.sub}>{o.why}</Text> : null}
                  <NutrientGrid values={o.nutrition} compact />
                  <View style={styles.chips}>
                    {o.uses.map((u, n) => (
                      <View key={n} style={[styles.tag, u.have ? styles.tagHave : u.optional ? styles.tagOpt : styles.tagNeed]}>
                        <Text style={styles.tagText}>{u.name}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.sub, { fontWeight: '700' }]}>{missing(o) === 0 ? t('k2.allHave') : t('k2.needList', { list: gaps.join(', ') })}</Text>
                  <View style={styles.tapRow}>
                    <Text style={styles.sub}>{t('k2.tapRecipe')}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.inkSoft} />
                  </View>
                </Card>
              </Pressable>
            );
          })}

          {result.buy.length > 0 && (
            <Card style={{ gap: 10 }}>
              <Text style={styles.h2}>{t('k2.buyTitle')}</Text>
              {result.buy.map((b) => {
                const on = kit.shopping.some((s) => s.name.toLowerCase() === b.item.toLowerCase());
                return (
                  <View key={b.item} style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{b.item}</Text>
                      {b.unlocks.length > 0 && <Text style={styles.sub}>{t('k2.buyUnlocks', { list: b.unlocks.join(', ') })}</Text>}
                    </View>
                    <Pressable onPress={() => kit.addShopping(b.item)} disabled={on} hitSlop={8}>
                      <Text style={[styles.link, on && { color: colors.inkSoft }]}>{on ? t('k2.addedBuy') : t('k2.addBuy')}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          )}
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '800', color: colors.ink },
  dish: { fontSize: 17, fontWeight: '800', color: colors.ink },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  link: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: BORDER, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  fitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tag: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: radius.pill, borderWidth: 1.5 },
  tagHave: { backgroundColor: '#DDF3E6', borderColor: '#1B6B3A' },
  tagNeed: { backgroundColor: '#FFE9D6', borderColor: '#B34A00' },
  tagOpt: { backgroundColor: colors.card, borderColor: colors.line, borderStyle: 'dashed' },
  tagText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  tapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
});
