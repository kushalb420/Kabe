import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Loading } from '../src/components/Loading';
import { Text } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from '../src/components/BarChart';
import { LineChart } from '../src/components/LineChart';
import { Button, Card } from '../src/components/ui';
import { coachLanguageName, type Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { r0, toDateKey } from '../src/lib/nutrition';
import { PERIODS, Period, bucketSize, bucketize, countsPerBucket, daysOf, summarize } from '../src/lib/stats';
import { dayIndex, trendSeries } from '../src/lib/tracker';
import { analyzeCoach } from '../src/lib/coach';
import { writeWeekly } from '../src/lib/vision';
import { buildFacts, highlights, nextStep } from '../src/lib/weekly';
import { useKabe } from '../src/store/kabe';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

export default function Stats() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const k = useKabe();
  const { entries, goals, workouts } = k;
  const tk = useTracker();
  const { weights, activities } = tk;
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<Period>(7);
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState<{ headline: string; summary: string; tip: string } | null>(null);
  const [aiError, setAiError] = useState('');
  const ai = !!k.geminiKey && k.aiConsent;

  const days = useMemo(() => daysOf(entries, toDateKey(new Date()), period), [entries, period]);
  const buckets = useMemo(() => bucketize(days, bucketSize(period)), [days, period]);
  const sum = useMemo(() => summarize(days, goals), [days, goals]);

  const endKey = toDateKey(new Date());
  const startKey = days[0].key;
  const labelOf = (d: Date) => (period === 7 ? t(`day.${d.getDay()}` as Key) : `${d.getDate()}/${d.getMonth() + 1}`);
  const rawW = useMemo(() => weights.filter((w) => w.date >= startKey && w.date <= endKey), [weights, startKey, endKey]);
  const trendW = useMemo(() => trendSeries(weights).filter((w) => w.date >= startKey && w.date <= endKey), [weights, startKey, endKey]);
  const wk = useMemo(() => countsPerBucket(workouts.map((w) => ({ date: w.date, value: 1 })), endKey, period), [workouts, endKey, period]);
  const act = useMemo(() => countsPerBucket(activities.map((a) => ({ date: a.date, value: a.minutes })), endKey, period), [activities, endKey, period]);
  const hasWk = wk.some((c) => c.value > 0);
  const hasAct = act.some((c) => c.value > 0);
  const hasWeight = rawW.length >= 2;
  const hasOther = hasWk || hasAct || hasWeight;
  const facts = useMemo(
    () => buildFacts({ today: endKey, goals, entries, workoutDates: workouts.map((w) => w.date), activities: tk.activities, checkins: tk.checkins, weights: tk.weights }),
    [endKey, goals, entries, workouts, tk.activities, tk.checkins, tk.weights],
  );
  const inv = useMemo(
    () => (k.profile ? analyzeCoach({ profile: k.profile, goals, entries, weights: tk.weights, goalWeight: tk.goalWeight, today: endKey }) : null),
    [k.profile, goals, entries, tk.weights, tk.goalWeight, endKey],
  );
  const slopeText = inv?.slope ? `${inv.slope.kgPerWeek > 0 ? '+' : ''}${Math.round(inv.slope.kgPerWeek * 100) / 100}` : '';
  const list = highlights(facts);
  const step = nextStep(facts);
  const askAi = async () => {
    setBusy(true);
    setAiError('');
    setAiText(null);
    try {
      const out = await writeWeekly(k.geminiKey, facts, coachLanguageName(k.language) ?? 'English');
      if (out) setAiText(out);
      else setAiError(t('week.aiRejected'));
    } catch (e) {
      setAiError(`${t('photo.errAnalyze')}${e instanceof Error && e.message ? ` (${e.message})` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  const data = buckets.map((b) => ({
    label: period === 7 ? t(`day.${b.start.getDay()}` as Key) : `${b.start.getDate()}/${b.start.getMonth() + 1}`,
    value: b.loggedDays > 0 ? b.kcal : 0,
  }));
  const rows: { key: 'protein' | 'carbs' | 'fat'; color: string }[] = [
    { key: 'protein', color: colors.protein },
    { key: 'carbs', color: colors.carbs },
    { key: 'fat', color: colors.fat },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('stats.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }}>
        <View style={styles.chips}>
          {PERIODS.map((p) => (
            <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.chip, period === p && styles.chipOn]}>
              <Text style={[styles.chipText, period === p && { color: colors.onPrimary }]}>{t(`stats.p${p}` as Key)}</Text>
            </Pressable>
          ))}
        </View>

        {sum.loggedDays === 0 && !hasOther && (
          <Card>
            <Text style={styles.body}>{t('stats.noData')}</Text>
          </Card>
        )}

        {sum.loggedDays > 0 && (
          <>
            <Card style={{ gap: 8 }}>
              <Text style={styles.h2}>{t('stats.calories')}</Text>
              <BarChart data={data} goal={goals.kcal} height={130} format={(v) => String(Math.round(v))} />
              <Text style={styles.sub}>{period === 7 ? t('stats.bars1') : t('stats.barsN', { n: bucketSize(period) })}</Text>
              <Text style={styles.sub}>{t('prog.goal', { n: r0(goals.kcal) })}</Text>
            </Card>

            <Card style={{ flexDirection: 'row' }}>
              <Stat value={String(r0(sum.avg.kcal))} label={t('prog.avgKcal')} />
              <Stat value={`${sum.loggedDays}/${sum.totalDays}`} label={t('prog.daysLogged')} />
              <Stat value={String(sum.daysOver)} label={t('stats.over')} />
              <Stat value={String(sum.daysProteinMet)} label={t('stats.proteinMet')} />
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={styles.h2}>{t('stats.macros')}</Text>
              {rows.map((r) => {
                const goal = goals[r.key];
                const v = sum.avg[r.key];
                return (
                  <View key={r.key} style={{ gap: 4 }}>
                    <View style={styles.between}>
                      <Text style={styles.name}>{t(`macro.${r.key}` as Key)}</Text>
                      <Text style={styles.sub}>{t('stats.of', { v: r0(v), goal: r0(goal) })}</Text>
                    </View>
                    <View style={styles.track}>
                      <View style={{ width: `${Math.min(100, goal > 0 ? (v / goal) * 100 : 0)}%`, height: '100%', backgroundColor: r.color }} />
                    </View>
                  </View>
                );
              })}
            </Card>

          </>
        )}

        {hasWeight && (
          <Card style={{ gap: 8 }}>
            <Text style={styles.h2}>{t('stats.weight')}</Text>
            <LineChart width={width - 72} raw={rawW.map((w) => ({ x: dayIndex(w.date), y: w.kg }))} trend={trendW.map((w) => ({ x: dayIndex(w.date), y: w.avg }))} />
            <Text style={styles.sub}>{t('stats.weightChange', { kg: String(Math.round((rawW[rawW.length - 1].kg - rawW[0].kg) * 10) / 10) })}</Text>
          </Card>
        )}

        {hasWk && (
          <Card style={{ gap: 8 }}>
            <Text style={styles.h2}>{t('stats.workouts')}</Text>
            <BarChart data={wk.map((c) => ({ label: labelOf(c.start), value: c.value }))} height={110} format={(v) => String(Math.round(v))} />
            <Text style={styles.sub}>{period === 7 ? t('stats.perDay') : t('stats.perWeek')}</Text>
          </Card>
        )}

        {hasAct && (
          <Card style={{ gap: 8 }}>
            <Text style={styles.h2}>{t('stats.activeMin')}</Text>
            <BarChart data={act.map((c) => ({ label: labelOf(c.start), value: c.value }))} goal={period === 7 ? undefined : 150} height={110} format={(v) => String(Math.round(v))} />
            <Text style={styles.sub}>{period === 7 ? t('stats.perDay') : t('stats.perWeekWho')}</Text>
          </Card>
        )}
        {period === 7 && sum.loggedDays > 0 && (
          <>
            <Card style={{ gap: 8 }}>
              <Text style={styles.h2}>{t('week.stood')}</Text>
              {list.map((h) => (
                <View key={h.id} style={{ flexDirection: 'row', gap: 8 }}>
                  <Ionicons name={h.good ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={h.good ? colors.good : colors.inkSoft} style={{ marginTop: 1 }} />
                  <Text style={[styles.body, { flex: 1 }]}>{t(`week.h.${h.id}` as Key, h.params)}</Text>
                </View>
              ))}
              <Text style={[styles.sub, { marginTop: 4 }]}>{t(`week.step.${step}` as Key)}</Text>
            </Card>

            {inv && (
              <Card style={{ gap: 6 }}>
                <Text style={styles.h2}>{t('week.invTitle')}</Text>
                <Text style={styles.body}>{t(`coach.status.${inv.status}` as Key, { s: slopeText })}</Text>
                {inv.tooFast && <Text style={[styles.body, { color: colors.warn }]}>{t('coach.tooFast')}</Text>}
                {inv.forecast.ok ? <Text style={styles.sub}>{t('coach.forecast', { kg: tk.goalWeight ?? '', date: inv.forecast.date, weeks: inv.forecast.weeks })}</Text> : null}
              </Card>
            )}

            <Card style={{ gap: 8 }}>
              {aiText ? (
                <>
                  <Text style={styles.h2}>{aiText.headline}</Text>
                  <Text style={styles.body}>{aiText.summary}</Text>
                  <Text style={styles.body}>{aiText.tip}</Text>
                </>
              ) : null}
              <Button title={busy ? t('week.aiBusy') : t('week.ai')} icon="sparkles-outline" variant="ghost" disabled={!ai || busy} onPress={askAi} />
              {busy && <Loading />}
              {!ai && <Text style={styles.sub}>{t('week.aiNeed')}</Text>}
              {aiError ? <Text style={[styles.sub, { color: colors.danger }]}>{aiError}</Text> : null}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.stat}>{value}</Text>
      <Text style={[styles.sub, { textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  stat: { fontSize: 20, fontWeight: '800', color: colors.ink },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
