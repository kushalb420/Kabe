import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Loading } from '../Loading';
import { coachLanguageName } from '../../i18n';
import type { Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import { Detail, Suggestion, Turn, missingNames, suggestionToFood } from '../../lib/kitchenAi';
import { askCook, recipeDetails } from '../../lib/kitchenNet';
import { toDateKey } from '../../lib/nutrition';
import { useKabe } from '../../store/kabe';
import { SavedRecipe, useKitchen } from '../../store/kitchen';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../../theme';
import { NutrientGrid } from '../NutrientGrid';
import { Text, TextInput } from '../Text';
import { Button, Card } from '../ui';

/**
 * One dish in detail. The recipe is only written when you open the dish (so the list stays fast), and a small chat lets you
 * ask how to cook it or what to use instead.
 */
export function DishDetail({ dish, saved, onBack }: { dish: Suggestion; saved?: SavedRecipe; onBack: () => void }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { geminiKey, language, addEntry } = useKabe();
  const kit = useKitchen();
  const [detail, setDetail] = useState<Detail | null>(saved?.detail ?? null);
  const [busy, setBusy] = useState(!saved?.detail);
  const [failed, setFailed] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [asking, setAsking] = useState(false);
  const [logged, setLogged] = useState(false);
  const lang = coachLanguageName(language);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  useEffect(() => {
    if (detail || !geminiKey) return;
    let live = true;
    recipeDetails(geminiKey, dish, kit.pantry, kit.equipment, lang)
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setFailed(!d);
      })
      .catch(() => live && setFailed(true))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
    // the recipe is written once per opened dish
  }, [dish.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const gaps = missingNames(dish);
  const isSaved = kit.savedRecipes.some((r) => r.name.toLowerCase() === dish.name.toLowerCase());

  const send = async () => {
    const question = q.trim();
    if (!question || asking) return;
    setQ('');
    setAsking(true);
    const history = turns;
    setTurns((l) => [...l, { role: 'user', text: question }]);
    try {
      const answer = await askCook(geminiKey, dish, detail, history, question, lang);
      if (alive.current) setTurns((l) => [...l, { role: 'coach', text: answer ?? t('k2.again') }]);
    } catch {
      if (alive.current) setTurns((l) => [...l, { role: 'coach', text: t('k2.again') }]);
    } finally {
      if (alive.current) setAsking(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <Pressable onPress={onBack} style={styles.back} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={colors.ink} />
        <Text style={styles.backText}>{t('k2.back')}</Text>
      </Pressable>

      <Card style={{ gap: 10 }}>
        <Text style={styles.title}>{dish.name}</Text>
        <Text style={styles.sub}>
          {t(`meal.${dish.meal}` as Key)} · {t('k2.minutes', { n: dish.minutes })} · {dish.servingG} g
        </Text>
        <NutrientGrid values={dish.nutrition} />
        <Button
          title={logged ? t('k2.savedOk') : t('k2.log')}
          icon={logged ? 'checkmark' : 'add-circle'}
          disabled={logged}
          onPress={() => {
            addEntry(suggestionToFood(dish), dish.servingG, dish.meal, toDateKey(new Date()));
            setLogged(true);
          }}
        />
        <Button title={isSaved ? t('k2.savedOk') : t('k2.save')} icon={isSaved ? 'bookmark' : 'bookmark-outline'} variant="ghost" disabled={isSaved} onPress={() => kit.saveRecipe(dish, detail)} />
        {gaps.length > 0 && <Button title={t('k2.addMissing')} icon="cart-outline" variant="ghost" onPress={() => gaps.forEach((g) => kit.addShopping(g, dish.name))} />}
      </Card>

      {busy ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Loading />
          <Text style={styles.body}>{t('k2.writing')}</Text>
        </Card>
      ) : failed || !detail ? (
        <Card>
          <Text style={styles.body}>{t('k2.again')}</Text>
        </Card>
      ) : (
        <>
          <Card style={{ gap: 6 }}>
            <Text style={styles.h2}>{t('k2.ingredients')}</Text>
            {detail.ingredients.map((i, n) => (
              <View key={n} style={styles.line}>
                <Text style={[styles.body, { flex: 1 }]}>{i.name}</Text>
                <Text style={styles.sub}>{i.amount}</Text>
              </View>
            ))}
          </Card>
          <Card style={{ gap: 8 }}>
            <Text style={styles.h2}>{t('k2.steps')}</Text>
            {detail.steps.map((s, n) => (
              <View key={n} style={styles.step}>
                <Text style={styles.num}>{n + 1}</Text>
                <Text style={[styles.body, { flex: 1 }]}>{s}</Text>
              </View>
            ))}
          </Card>
          {detail.tips.length > 0 && (
            <Card style={{ gap: 6 }}>
              <Text style={styles.h2}>{t('k2.tips')}</Text>
              {detail.tips.map((s, n) => (
                <Text key={n} style={styles.body}>
                  • {s}
                </Text>
              ))}
            </Card>
          )}
          {detail.swaps.length > 0 && gaps.length > 0 && (
            <Card style={{ gap: 6 }}>
              <Text style={styles.h2}>{t('k2.swaps')}</Text>
              {detail.swaps.map((s, n) => (
                <Text key={n} style={styles.body}>
                  • {s}
                </Text>
              ))}
            </Card>
          )}
        </>
      )}

      <Card style={{ gap: 10 }}>
        <Text style={styles.h2}>{t('k2.chatTitle')}</Text>
        {turns.map((m, n) => (
          <View key={n} style={[styles.bubble, m.role === 'user' ? styles.mine : styles.theirs]}>
            <Text style={m.role === 'user' ? styles.mineText : styles.body}>{m.text}</Text>
          </View>
        ))}
        {asking && <Loading />}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput value={q} onChangeText={setQ} placeholder={t('k2.chatPh')} placeholderTextColor={colors.inkSoft} style={[styles.input, { flex: 1, minWidth: 0 }]} onSubmitEditing={send} returnKeyType="send" />
          <Pressable onPress={send} disabled={asking || !q.trim()} style={[styles.send, (asking || !q.trim()) && { opacity: 0.4 }]} accessibilityLabel={t('k2.ask')}>
            <Ionicons name="send" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  sub: { fontSize: 12, color: colors.inkSoft },
  line: { flexDirection: 'row', gap: 10, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  num: { width: 26, height: 26, borderRadius: 13, textAlign: 'center', textAlignVertical: 'center', lineHeight: 24, fontSize: 13, fontWeight: '800', color: colors.onPrimary, backgroundColor: colors.primary, overflow: 'hidden' },
  input: { borderWidth: BORDER, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  send: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '90%', borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.bg, borderWidth: BORDER, borderColor: colors.line },
  mineText: { color: colors.onPrimary, fontSize: 14, lineHeight: 20 },
});
