import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CountUp } from '../../src/components/Motion';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { HeroTank } from '../../src/components/HeroTank';
import { Button, Card, LinkRow, MacroBar } from '../../src/components/ui';
import { NUTRITION } from '../../src/config/app';
import { useT } from '../../src/i18n/useT';
import { CardId, sanitizeLayout, visibleOrder } from '../../src/lib/dashboard';
import { sumMacros, sumOptional, toDateKey } from '../../src/lib/nutrition';
import { useGamify } from '../../src/store/gamify';
import { useKabe } from '../../src/store/kabe';
import { useTracker } from '../../src/store/tracker';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../../src/theme';
import { Sticker } from '../../src/components/Sticker';
import { progressOn } from '../../src/lib/supplements';
import { useCloud } from '../../src/store/cloud';

export default function Home() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { entries, goals, dashboard, userName } = useKabe();
  const { t, tn } = useT();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('today.greet.morning') : hour < 18 ? t('today.greet.afternoon') : t('today.greet.evening');
  const today = toDateKey(new Date());
  const todays = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const total = useMemo(() => sumMacros(todays), [todays]);
  const sugar = sumOptional(todays, 'sugar').total;
  const satFat = sumOptional(todays, 'satFat').total;
  const sugarGoal = (goals.kcal * NUTRITION.freeSugarMaxPctKcal) / 100 / NUTRITION.kcalPerGramSugar;
  const satFatGoal = (goals.kcal * NUTRITION.satFatMaxPctKcal) / 100 / NUTRITION.kcalPerGramFat;
  const tracker = useTracker();
  const cloud = useCloud();
  const game = useGamify();
  const waterMl = tracker.water[today] ?? 0;
  const supp = progressOn(tracker.supplements, tracker.supplementLog, today);
  const habitTotal = tracker.habits.length + supp.total;
  const habitDone =
    (tracker.habitLog[today] ?? []).filter((id) => tracker.habits.some((h) => h.id === id)).length +
    supp.done;

  /** Every card below the calorie ring, by id; the order and visibility come from the person's layout (Settings → Customise Today). */
  const cards: Record<CardId, React.ReactNode> = {
    macros: (
      <Card>
        <Sticker name="broccoli" size={44} tilt={10} style={{ position: 'absolute', top: -14, right: -6, zIndex: 2 }} />
        <Text style={styles.h2}>{t('today.macros')}</Text>
        <MacroBar label={t('macro.sugar')} value={sugar} goal={sugarGoal} color={colors.accent} watch />
        <MacroBar label={t('macro.protein')} value={total.protein} goal={goals.protein} color={colors.protein} />
        <MacroBar label={t('macro.carbs')} value={total.carbs} goal={goals.carbs} color={colors.carbs} watch />
        <MacroBar label={t('macro.fiber')} value={total.fiber} goal={goals.fiber} color={colors.fiber} />
        <MacroBar label={t('macro.fat')} value={total.fat} goal={goals.fat} color={colors.fat} part={{ value: satFat, color: colors.satFat }} watch />
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: colors.satFat }]} />
          <Text style={styles.small}>
            {t('macro.satFat')}: {Math.round(satFat * 10) / 10} g{satFat > satFatGoal * 1.01 ? ' ↑' : ''}
          </Text>
          <Text style={[styles.small, { marginLeft: 'auto' }]}>≤ {Math.round(satFatGoal)} g</Text>
        </View>
      </Card>
    ),
    meals: <LinkRow icon="restaurant-outline" sticker="rice" title={t('today.mealsCard')} sub={t('today.mealsCardSub')} onPress={() => router.push('/diary')} />,
    water: (
      <Pressable onPress={() => router.push('/daily')}>
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.h2}>{t('today.waterHabits')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <MacroBar label={t('macro.water')} value={waterMl} goal={tracker.waterGoal} color="#3B9AE1" unit=" ml" />
            </View>
            <Pressable style={styles.waterBtn} onPress={() => tracker.addWater(today, 250)} accessibilityLabel={t('today.addWater')}>
              <Text style={styles.waterBtnText}>+250 ml</Text>
            </Pressable>
          </View>
          <Text style={styles.small}>{habitTotal > 0 ? t('today.habitsDone', { done: habitDone, total: habitTotal }) : t('today.habitsEmpty')}</Text>
        </Card>
      </Pressable>
    ),
    activity: <LinkRow icon="walk-outline" sticker="dumbbell" title={t('train.activity')} sub={tracker.steps[today] ? t('train.steps', { n: tracker.steps[today].toLocaleString() }) : t('train.activityCta')} onPress={() => router.push('/activity')} />,
    logFood: <Button title={t('today.logFood')} icon="add-circle" onPress={() => router.push({ pathname: '/add-food', params: { date: today } })} />,
  };

  const streak = (
    <Pressable onPress={() => router.push('/achievements')} style={styles.streak} accessibilityRole="button" accessibilityLabel={tn('today.streak', game.streaks.log.current)}>
      <Text style={styles.streakEmoji}>🔥</Text>
      <Text style={styles.streakNum}>{game.streaks.log.current}</Text>
    </Pressable>
  );

  return (
    <Screen title={userName ? `${greeting}, ${userName}` : greeting} subtitle={t('today.subtitle')} headerRight={streak} eyebrow={<Sticker name="wordmark" size={78} />}>
      {cloud.user?.email && (cloud.status === 'conflict' || cloud.status === 'error') ? (
        <LinkRow
          icon="sync-outline"
          title={t(cloud.status === 'conflict' ? 'sync.conflictTitle' : 'sync.errorTitle')}
          sub={t(cloud.status === 'conflict' ? 'sync.conflictSub' : 'sync.errorSub')}
          onPress={() => router.push('/cloud')}
        />
      ) : null}
      <View style={{ gap: 6 }}>
        <HeroTank
          metrics={[
            { key: 'kcal', label: t('macro.kcal'), value: total.kcal, goal: goals.kcal, unit: 'kcal', leftLabel: t('today.left'), overLabel: t('today.over') },
            { key: 'protein', label: t('macro.protein'), value: total.protein, goal: goals.protein, unit: 'g', leftLabel: t('today.left'), overLabel: t('today.over') },
            { key: 'carbs', label: t('macro.carbs'), value: total.carbs, goal: goals.carbs, unit: 'g', leftLabel: t('today.left'), overLabel: t('today.over') },
            { key: 'fat', label: t('macro.fat'), value: total.fat, goal: goals.fat, unit: 'g', leftLabel: t('today.left'), overLabel: t('today.over') },
          ]}
        />
        <View style={styles.statsRow}>
          <Stat label={t('today.eaten')} value={total.kcal} />
          <Stat label={t('today.goal')} value={goals.kcal} />
        </View>
      </View>

      {visibleOrder(sanitizeLayout(dashboard)).map((id) => (
        <React.Fragment key={id}>{cards[id]}</React.Fragment>
      ))}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <CountUp value={value} style={styles.statVal} />
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  big: { fontSize: 40, fontWeight: '800', color: colors.ink },
  small: { fontSize: 13, color: colors.inkSoft, fontWeight: '500' },
  statsRow: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 18 },
  statVal: { fontSize: 20, fontWeight: '700', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.cardBorder },
  waterBtn: { backgroundColor: colors.primarySoft, borderWidth: BORDER, borderColor: colors.cardBorder, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, marginTop: 6 },
  waterBtnText: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.cardBorder, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 },
  streakEmoji: { fontSize: 18 },
  streakNum: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
