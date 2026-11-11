import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from '../src/components/BarChart';
import { Button, Card, ProgressRing } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { toDateKey } from '../src/lib/nutrition';
import { Checkin, isRestDay, musclesTrained, readiness, recommend, restDaysThisWeek, sleepStats, trainingStreakBefore } from '../src/lib/recovery';
import { addDays } from '../src/lib/tracker';
import { useKabe } from '../src/store/kabe';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

const DEFAULT: Checkin = { sleepH: 7.5, sleepQ: 3, soreness: 2, fatigue: 2, stress: 2 };
const levelColors = (c: Colors) => ({ push: c.primary, moderate: c.fiber, light: c.accent, rest: c.danger }) as const;

function Scale({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} style={[styles.dot, value === n && styles.dotOn]}>
            <Text style={[styles.dotText, value === n && { color: colors.onPrimary }]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.tiny}>1 = {low}</Text>
        <Text style={styles.tiny}>5 = {high}</Text>
      </View>
    </View>
  );
}

export default function Recovery() {
  const colors = useColors();
  const tk = useTracker();
  // wait for saved data so today's check-in is already loaded when the form state is created
  if (!tk.ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <RecoveryScreen />;
}

function RecoveryScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const k = useKabe();
  const tk = useTracker();
  const { t, tn } = useT();
  const today = toDateKey(new Date());
  const saved = tk.checkins[today];
  const [c, setC] = useState<Checkin>(saved ?? DEFAULT);
  const [editing, setEditing] = useState(!saved);
  const dayName = (key: string) => t(`day.${new Date(key + 'T00:00:00').getDay()}` as Key);

  const streak = useMemo(() => trainingStreakBefore(today, k.workouts, tk.activities, tk.restDays), [k.workouts, tk.activities, tk.restDays, today]);
  const yesterdayMuscles = useMemo(
    () => musclesTrained(addDays(today, -1), k.workouts, (id) => k.allExercises.find((e) => e.id === id)?.muscle),
    [k.workouts, k.allExercises, today],
  );
  const r = saved ? readiness(saved, streak) : null;
  const rec = saved && r ? recommend(r.score, saved, { streak, musclesYesterday: yesterdayMuscles }) : null;
  const stats = sleepStats(tk.checkins, today, tk.sleepGoal);
  const restWeek = restDaysThisWeek(today, k.workouts, tk.activities, tk.restDays);
  const manualRest = tk.restDays.includes(today);
  const series = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return { label: dayName(d), value: tk.checkins[d]?.sleepH ?? 0 };
  });

  const tipText = (code: NonNullable<typeof rec>['codes'][number]) =>
    t(`recov.tip.${code.id}` as Key, {
      h: code.hours ?? 0,
      n: code.days ?? 0,
      muscles: (code.muscles ?? []).map((m) => t(`muscle.${m}` as Key)).join(', ').toLowerCase(),
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('train.recovery')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {saved && r && rec && !editing && (
          <Card style={{ gap: 10, alignItems: 'center' }}>
            <Text style={[styles.h2, { alignSelf: 'flex-start' }]}>{t('recov.readiness')}</Text>
            <ProgressRing size={150} stroke={14} progress={r.score / 100} color={levelColors(colors)[rec.level]}>
              <Text style={styles.big}>{r.score}</Text>
              <Text style={styles.sub}>{t('recov.outOf')}</Text>
            </ProgressRing>
            <Text style={[styles.headline, { color: levelColors(colors)[rec.level] === colors.accent ? colors.warn : levelColors(colors)[rec.level] }]}>{t(`recov.head.${rec.level}` as Key)}</Text>
            {rec.codes.map((code, i) => (
              <Text key={i} style={styles.body}>• {tipText(code)}</Text>
            ))}
            <Text style={styles.sub}>
              {t('recov.parts', { a: Math.round(r.parts.sleep), b: Math.round(r.parts.soreness), c: Math.round(r.parts.fatigue), d: Math.round(r.parts.stress) })}
              {r.loadPenalty ? t('recov.penalty', { p: r.loadPenalty, n: streak }) : ''}
            </Text>
            <Text style={styles.note}>{t('recov.note')}</Text>
            <Button title={t('recov.editToday')} variant="ghost" onPress={() => setEditing(true)} />
          </Card>
        )}

        {editing && (
          <Card style={{ gap: 12 }}>
            <Text style={styles.h2}>{t('recov.morning')}</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>{t('recov.hoursSlept')}</Text>
              <View style={styles.stepper}>
                <Pressable hitSlop={8} onPress={() => setC({ ...c, sleepH: Math.max(0, c.sleepH - 0.5) })}>
                  <Ionicons name="remove-circle-outline" size={28} color={colors.primary} />
                </Pressable>
                <Text style={styles.big2}>{t('recov.h', { n: c.sleepH })}</Text>
                <Pressable hitSlop={8} onPress={() => setC({ ...c, sleepH: Math.min(14, c.sleepH + 0.5) })}>
                  <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
                </Pressable>
              </View>
            </View>
            <Scale label={t('recov.q.rested')} value={c.sleepQ} onChange={(v) => setC({ ...c, sleepQ: v })} low={t('recov.lo.rested')} high={t('recov.hi.rested')} />
            <Scale label={t('recov.q.sore')} value={c.soreness} onChange={(v) => setC({ ...c, soreness: v })} low={t('recov.lo.sore')} high={t('recov.hi.sore')} />
            <Scale label={t('recov.q.tired')} value={c.fatigue} onChange={(v) => setC({ ...c, fatigue: v })} low={t('recov.lo.tired')} high={t('recov.hi.tired')} />
            <Scale label={t('recov.q.stress')} value={c.stress} onChange={(v) => setC({ ...c, stress: v })} low={t('recov.lo.stress')} high={t('recov.hi.stress')} />
            <Button
              title={t('recov.saveCheckin')}
              icon="checkmark"
              onPress={() => {
                tk.saveCheckin(today, c);
                setEditing(false);
              }}
            />
          </Card>
        )}

        <Card style={{ gap: 6 }}>
          <Text style={styles.h2}>{t('recov.restDays')}</Text>
          <Text style={styles.body}>
            {tn('recov.restCount', restWeek)} · {streak > 0 ? tn('recov.trainRun', streak) : t('recov.noRun')}
          </Text>
          <Text style={styles.sub}>{t('recov.restNote')}</Text>
          <Button
            title={manualRest ? t('recov.marked') : isRestDay(today, k.workouts, tk.activities, tk.restDays) ? t('recov.markToday') : t('recov.takeToday')}
            variant="ghost"
            onPress={() => tk.toggleRestDay(today)}
          />
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('recov.sleepWeek')}</Text>
          <BarChart data={series} goal={tk.sleepGoal} height={110} format={(v) => String(v)} />
          <Text style={styles.body}>
            {stats.avg7 === null
              ? t('recov.noAvg')
              : t('recov.avg', {
                  avg: stats.avg7,
                  nights: tn('recov.nights', stats.daysLogged),
                  extra: stats.debtH > 0 ? t('recov.debt', { h: stats.debtH, goal: tk.sleepGoal }) : t('recov.onGoal'),
                })}
          </Text>
          <View style={styles.rowBetween}>
            <Text style={styles.sub}>{t('recov.sleepGoal')}</Text>
            <View style={styles.stepper}>
              <Pressable hitSlop={8} onPress={() => tk.setSleepGoal(tk.sleepGoal - 0.5)}>
                <Ionicons name="remove-circle-outline" size={24} color={colors.primary} />
              </Pressable>
              <Text style={styles.big2}>{t('recov.h', { n: tk.sleepGoal })}</Text>
              <Pressable hitSlop={8} onPress={() => tk.setSleepGoal(tk.sleepGoal + 0.5)}>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              </Pressable>
            </View>
          </View>
          <Text style={styles.sub}>{t('recov.sleepNote')}</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  big: { fontSize: 38, fontWeight: '800', color: colors.ink },
  big2: { fontSize: 18, fontWeight: '800', color: colors.ink, minWidth: 56, textAlign: 'center' },
  headline: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17, textAlign: 'left' },
  tiny: { fontSize: 11, color: colors.inkSoft },
  note: { fontSize: 11, color: colors.inkSoft, lineHeight: 16, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', gap: 8 },
  dot: { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, alignItems: 'center' },
  dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotText: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
