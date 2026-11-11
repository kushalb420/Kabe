import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Vibration, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import { lastSets, suggestNext, SetLog, workoutVolume, workoutSetCount, fmtDuration } from '../src/lib/workout';
import { useKabe } from '../src/store/kabe';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { nowMs } from '../src/lib/clock';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';
import { Sticker } from '../src/components/Sticker';

const REST_DEFAULT = 90;

function NumField({ value, onChange, placeholder, done }: { value: number; onChange: (n: number) => void; placeholder: string; done: boolean }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        const n = parseFloat(t.replace(',', '.'));
        onChange(isFinite(n) && n >= 0 ? n : 0);
      }}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.inkSoft}
      selectTextOnFocus
      editable={!done}
      style={[styles.num, done && { backgroundColor: colors.primarySoft }]}
    />
  );
}

export default function WorkoutScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { activeWorkout: w, workouts, updateActive, finishWorkout, discardWorkout, saveRoutine } = useKabe();
  const insets = useSafeAreaInsets();
  const { t, tn } = useT();
  const [now, setNow] = useState(nowMs);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(REST_DEFAULT);
  const [routineName, setRoutineName] = useState('');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(nowMs()), 500);
    return () => clearInterval(timer);
  }, []);

  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0;
  // when the rest time is over: buzz and hide the rest bar (one timer for the exact moment, set from the timer callback)
  useEffect(() => {
    if (!restEnd) return;
    const id = setTimeout(() => {
      Vibration.vibrate([0, 300, 150, 300]);
      setRestEnd(null);
    }, Math.max(0, restEnd - nowMs()));
    return () => clearTimeout(id);
  }, [restEnd]);

  if (!w) {
    // Briefly true while the screen is closing after Finish/Discard; render nothing to avoid a flash.
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  const setSet = (exIdx: number, setId: string, patch: Partial<SetLog>) =>
    updateActive((cur) => ({
      ...cur,
      exercises: cur.exercises.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) },
      ),
    }));

  const toggleDone = (exIdx: number, s: SetLog) => {
    if (!s.done && !(s.reps > 0)) {
      Alert.alert(t('wo.addRepsTitle'), t('wo.addRepsBody'));
      return;
    }
    setSet(exIdx, s.id, { done: !s.done });
    if (!s.done) {
      setRestTotal(REST_DEFAULT);
      setRestEnd(Date.now() + REST_DEFAULT * 1000);
    }
  };

  const addSet = (exIdx: number) =>
    updateActive((cur) => ({
      ...cur,
      exercises: cur.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { id: `${Date.now()}-${ex.sets.length}`, weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false }] };
      }),
    }));

  const removeSet = (exIdx: number, setId: string) =>
    updateActive((cur) => ({
      ...cur,
      exercises: cur.exercises.map((ex, i) => (i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((s) => s.id !== setId) })),
    }));

  const removeExercise = (exIdx: number) =>
    updateActive((cur) => ({ ...cur, exercises: cur.exercises.filter((_, i) => i !== exIdx) }));

  const elapsed = Math.floor((now - w.startedAt) / 1000);
  const doneSets = workoutSetCount(w);

  const leave = () => (router.canGoBack() ? goBack() : router.replace('/workouts')); // opened directly (no screen behind)? go to the Workouts tab

  const finish = () => {
    if (doneSets === 0) {
      Alert.alert(t('wo.noSetsTitle'), t('wo.noSetsBody'));
      return;
    }
    setFinishing(true);
  };

  const confirmFinish = (asRoutine: boolean) => {
    if (asRoutine && routineName.trim()) saveRoutine(routineName.trim(), w);
    finishWorkout();
    leave();
  };

  if (finishing) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={[styles.title, { flex: 1 }]}>{t('wo.niceWork')}</Text>
          <Sticker name="sparkles" size={64} bob />
          <Sticker name="check" size={48} tilt={8} />
        </View>
        <Card style={{ gap: 6 }}>
          <Text style={styles.big}>{t('wo.lifted', { sets: tn('train.sets', doneSets), kg: Math.round(workoutVolume(w)).toLocaleString() })}</Text>
          <Text style={styles.sub}>{t('wo.time', { time: fmtDuration(elapsed) })}</Text>
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={styles.h2}>{t('wo.saveRoutineQ')}</Text>
          <TextInput value={routineName} onChangeText={setRoutineName} placeholder={t('wo.routinePlaceholder')} placeholderTextColor={colors.inkSoft} style={styles.nameInput} />
          <Button title={t('wo.saveBoth')} variant="ghost" disabled={!routineName.trim()} onPress={() => confirmFinish(true)} />
        </Card>
        <Button title={t('wo.save')} icon="checkmark" onPress={() => confirmFinish(false)} />
        <Button title={t('wo.keepEditing')} variant="ghost" onPress={() => setFinishing(false)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => leave()} hitSlop={12}>
          <Ionicons name="chevron-down" size={28} color={colors.ink} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headTitle}>{w.name}</Text>
          <Text style={styles.sub}>{fmtDuration(elapsed)} · {tn('train.setsDone', doneSets)}</Text>
        </View>
        <Pressable onPress={finish} hitSlop={12}>
          <Text style={styles.finish}>{t('wo.finish')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: restEnd ? 150 : 60 }} keyboardShouldPersistTaps="handled">
        {w.exercises.length === 0 && <Text style={styles.sub}>{t('wo.addFirst')}</Text>}

        {w.exercises.map((ex, exIdx) => {
          const prev = lastSets(ex.exerciseId, workouts);
          const sug = suggestNext(prev);
          return (
            <Card key={`${ex.exerciseId}-${exIdx}`} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.h2, { flex: 1 }]}>{ex.name}</Text>
                <Pressable
                  hitSlop={10}
                  onPress={() => Alert.alert(t('wo.removeExQ'), ex.name, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.remove'), style: 'destructive', onPress: () => removeExercise(exIdx) }])}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.inkSoft} />
                </Pressable>
              </View>
              {prev.length > 0 && (
                <Text style={styles.hint}>
                  {t('wo.lastTime', { sets: prev.map((s) => `${s.weight}×${s.reps}`).join(', ') })}
                  {sug ? `\n${t('wo.suggestion', { weight: sug.weight, reps: sug.reps, reason: t(`wo.why.${sug.why.key}` as Key, { reps: sug.why.reps ?? 0, step: sug.why.step ?? 0 }) })}` : ''}
                </Text>
              )}
              <View style={styles.row}>
                <Text style={[styles.col, { width: 28 }]}>{t('wo.colSet')}</Text>
                <Text style={[styles.col, { flex: 1 }]}>{t('wo.colKg')}</Text>
                <Text style={[styles.col, { flex: 1 }]}>{t('wo.colReps')}</Text>
                <View style={{ width: 80 }} />
              </View>
              {ex.sets.map((s, i) => (
                <View key={s.id} style={styles.row}>
                  <Text style={[styles.setNo, { width: 28 }]}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <NumField value={s.weight} placeholder="0" done={s.done} onChange={(n) => setSet(exIdx, s.id, { weight: n })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <NumField value={s.reps} placeholder="0" done={s.done} onChange={(n) => setSet(exIdx, s.id, { reps: Math.round(n) })} />
                  </View>
                  <View style={{ width: 80, flexDirection: 'row', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
                    <Pressable hitSlop={8} onPress={() => removeSet(exIdx, s.id)} disabled={s.done}>
                      <Ionicons name="close" size={18} color={s.done ? colors.line : colors.inkSoft} />
                    </Pressable>
                    <Pressable onPress={() => toggleDone(exIdx, s)} style={[styles.check, s.done && styles.checkOn]}>
                      <Ionicons name="checkmark" size={20} color={s.done ? colors.onPrimary : colors.inkSoft} />
                    </Pressable>
                  </View>
                </View>
              ))}
              <Pressable onPress={() => addSet(exIdx)} style={styles.addSet}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('wo.addSet')}</Text>
              </Pressable>
            </Card>
          );
        })}

        <Button title={t('wo.addExercise')} icon="add-circle" onPress={() => router.push('/pick-exercise')} />
        <Button
          title={t('wo.discard')}
          variant="ghost"
          onPress={() =>
            Alert.alert(t('wo.discardQ'), t('wo.discardBody'), [
              { text: t('wo.keepGoing'), style: 'cancel' },
              { text: t('wo.discardBtn'), style: 'destructive', onPress: () => { discardWorkout(); leave(); } },
            ])
          }
        />
      </ScrollView>

      {restEnd && (
        <View style={[styles.rest, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.restLabel}>{t('wo.rest')}</Text>
          <Text style={styles.restTime}>{fmtDuration(restLeft)}</Text>
          <View style={styles.restTrack}>
            <View style={[styles.restFill, { width: `${Math.min(100, (restLeft / restTotal) * 100)}%` }]} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={styles.restBtn} onPress={() => { setRestEnd((restEnd ?? Date.now()) - 15000); }}>
              <Text style={styles.restBtnText}>−15s</Text>
            </Pressable>
            <Pressable style={styles.restBtn} onPress={() => { setRestEnd((restEnd ?? Date.now()) + 15000); setRestTotal((total) => total + 15); }}>
              <Text style={styles.restBtnText}>+15s</Text>
            </Pressable>
            <Pressable style={[styles.restBtn, { backgroundColor: colors.card }]} onPress={() => setRestEnd(null)}>
              <Text style={[styles.restBtnText, { color: colors.primaryDark }]}>{t('wo.skip')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 18, gap: 16 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  big: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkSoft },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  headTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  finish: { fontSize: 16, fontWeight: '800', color: colors.primary },
  hint: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  col: { fontSize: 11, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
  setNo: { fontSize: 15, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
  num: { backgroundColor: colors.bg, borderRadius: radius.sm, paddingVertical: 8, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.ink },
  check: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary },
  addSet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  nameInput: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16, color: colors.ink },
  rest: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.primaryDark, padding: 16, gap: 8, alignItems: 'center', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  restLabel: { color: '#BFE3D3', fontWeight: '700', letterSpacing: 1, fontSize: 12 },
  restTime: { color: '#fff', fontSize: 40, fontWeight: '800' },
  restTrack: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  restFill: { height: 6, backgroundColor: colors.card },
  restBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)' },
  restBtnText: { color: '#fff', fontWeight: '700' },
});
