import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Alert } from '../../src/lib/alert';
import { PressScale } from '../../src/components/Motion';
import { SplitBuilder } from '../../src/components/SplitBuilder';
import { Text } from '../../src/components/Text';
import { Screen } from '../../src/components/Screen';
import { Button, Card } from '../../src/components/ui';
import { useT } from '../../src/i18n/useT';
import { toDateKey } from '../../src/lib/nutrition';
import { readiness, trainingStreakBefore } from '../../src/lib/recovery';
import { exerciseHistory, fmtDuration, records, workoutSetCount, workoutVolume } from '../../src/lib/workout';
import { useTracker } from '../../src/store/tracker';
import { useKabe } from '../../src/store/kabe';
import { useColors, useThemedStyles, type Colors } from '../../src/theme';
import { Sticker } from '../../src/components/Sticker';

export default function Workouts() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { workouts, routines, activeWorkout, startWorkout, deleteWorkout, deleteRoutine } = useKabe();
  const { t, tn } = useT();
  const [open, setOpen] = useState<string | null>(null);
  const [chart, setChart] = useState<string | null>(null);
  const [builder, setBuilder] = useState<'new' | string | null>(null);
  const tracker = useTracker();
  const today = toDateKey(new Date());
  const todaysCheckin = tracker.checkins[today];
  const readinessScore = todaysCheckin
    ? readiness(todaysCheckin, trainingStreakBefore(today, workouts, tracker.activities, tracker.restDays)).score
    : null;
  const stepsToday = tracker.steps[today] ?? 0;
  const prs = useMemo(() => records(workouts).slice(0, 5), [workouts]);

  const begin = (r?: (typeof routines)[number]) => {
    startWorkout(r);
    router.push('/workout');
  };

  return (
    <Screen title={t('tab.train')} subtitle={t('train.subtitle')} headerRight={<Sticker name="dumbbell" size={64} tilt={12} bob style={{ marginTop: 4 }} />}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <PressScale style={{ flex: 1, alignSelf: 'stretch' }} onPress={() => router.push('/recovery')}>
          <Card style={{ gap: 4, padding: 14, flexGrow: 1 }}>
            <Ionicons name="moon-outline" size={22} color={colors.primary} />
            <Text style={styles.h2}>{t('train.recovery')}</Text>
            <Text style={styles.sub}>{readinessScore !== null ? t('train.readiness', { n: readinessScore }) : t('train.checkinCta')}</Text>
          </Card>
        </PressScale>
        <PressScale style={{ flex: 1, alignSelf: 'stretch' }} onPress={() => router.push('/activity')}>
          <Card style={{ gap: 4, padding: 14, flexGrow: 1 }}>
            <Ionicons name="walk-outline" size={22} color={colors.primary} />
            <Text style={styles.h2}>{t('train.activity')}</Text>
            <Text style={styles.sub}>{stepsToday ? t('train.steps', { n: stepsToday.toLocaleString() }) : t('train.activityCta')}</Text>
          </Card>
        </PressScale>
      </View>

      {activeWorkout ? (
        <Card style={{ gap: 10, backgroundColor: colors.primarySoft }}>
          <Text style={styles.h2}>{t('train.inProgress')}</Text>
          <Text style={styles.sub}>
            {activeWorkout.name} · {tn('train.setsDone', workoutSetCount(activeWorkout))}
          </Text>
          <Button title={t('train.resume')} icon="play" onPress={() => router.push('/workout')} />
        </Card>
      ) : (
        <Button title={t('train.startEmpty')} icon="barbell" onPress={() => begin()} />
      )}

      {builder === 'new' && <SplitBuilder onDone={() => setBuilder(null)} />}
      {builder && builder !== 'new' && routines.find((r) => r.id === builder) && <SplitBuilder routine={routines.find((r) => r.id === builder)} onDone={() => setBuilder(null)} />}
      {!builder && <Button title={t('split.new')} icon="add-circle-outline" variant="ghost" onPress={() => setBuilder('new')} />}

      {routines.length > 0 && (
        <Card style={{ gap: 4 }}>
          <Text style={styles.h2}>{t('train.routines')}</Text>
          {routines.map((r) => (
            <Pressable
              key={r.id}
              style={styles.line}
              disabled={!!activeWorkout}
              onPress={() => begin(r)}
              onLongPress={() =>
                Alert.alert(t('train.deleteRoutine'), r.name, [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('common.delete'), style: 'destructive', onPress: () => deleteRoutine(r.id) },
                ])
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.sub}>{r.exercises.map((e) => e.name).join(' · ')}</Text>
              </View>
              <Pressable onPress={() => setBuilder(r.id)} hitSlop={8} accessibilityLabel={t('split.edit')} style={{ marginRight: 10 }}><Ionicons name="create-outline" size={22} color={colors.inkSoft} /></Pressable>
              <Ionicons name="play-circle" size={28} color={activeWorkout ? colors.line : colors.primary} />
            </Pressable>
          ))}
          <Text style={styles.sub}>{t('train.routineHint')}</Text>
        </Card>
      )}

      {prs.length > 0 && (
        <Card style={{ gap: 6 }}>
          <Text style={styles.h2}>{t('train.records')}</Text>
          {prs.map((p) => (
            <View key={p.exerciseId}>
              <Pressable style={styles.prRow} onPress={() => setChart(chart === p.exerciseId ? null : p.exerciseId)}>
                <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.sub}>{p.weight} kg × {p.reps}</Text>
                <Text style={styles.pr}>~{Math.round(p.e1rm)} kg</Text>
              </Pressable>
              {chart === p.exerciseId && <ProgressBars points={exerciseHistory(p.exerciseId, workouts).slice(-12)} color={colors.primary} />}
            </View>
          ))}
          <Text style={styles.sub}>{t('train.recordsNote')}</Text>
        </Card>
      )}

      <Card style={{ gap: 4 }}>
        <Text style={styles.h2}>{t('train.history')}</Text>
        {workouts.length === 0 && <Text style={styles.sub}>{t('train.none')}</Text>}
        {workouts.slice(0, 20).map((w) => (
          <View key={w.id}>
            <Pressable
              style={styles.line}
              onPress={() => setOpen(open === w.id ? null : w.id)}
              onLongPress={() =>
                Alert.alert(t('train.deleteWorkout'), `${w.name} · ${w.date}`, [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('common.delete'), style: 'destructive', onPress: () => deleteWorkout(w.id) },
                ])
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{w.name}</Text>
                <Text style={styles.sub}>
                  {w.date} · {fmtDuration(w.durationSec)} · {tn('train.sets', workoutSetCount(w))} · {Math.round(workoutVolume(w)).toLocaleString()} kg
                </Text>
              </View>
              <Ionicons name={open === w.id ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
            </Pressable>
            {open === w.id &&
              w.exercises.map((ex) => (
                <Text key={ex.exerciseId} style={styles.detail}>
                  {ex.name}: {ex.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}
                </Text>
              ))}
          </View>
        ))}
        {workouts.length > 0 && <Text style={styles.sub}>{t('train.histHint')}</Text>}
      </Card>
    </Screen>
  );
}

function ProgressBars({ points, color }: { points: { date: string; e1rm: number }[]; color: string }) {
  const max = Math.max(1, ...points.map((p) => p.e1rm));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 70, paddingVertical: 6 }}>
      {points.map((p) => (
        <View key={p.date + p.e1rm} style={{ flex: 1, height: Math.max(6, (p.e1rm / max) * 58), backgroundColor: color, borderRadius: 4 }} />
      ))}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  sub: { fontSize: 12, color: colors.inkSoft },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  pr: { fontSize: 15, fontWeight: '800', color: colors.primary, minWidth: 64, textAlign: 'right' },
  detail: { fontSize: 13, color: colors.ink, paddingLeft: 8, paddingBottom: 6 },
});
