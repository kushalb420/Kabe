import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { WEB_STEPS_ACTIVE_EVENT, WEB_STEPS_EVENT, WEB_STEPS_KEY, requestMotion } from '../src/lib/webSteps';
import { Alert } from '../src/lib/alert';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from '../src/components/BarChart';
import { NumBox } from '../src/components/NumBox';
import { Button, Card, ProgressRing } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { unitLabel } from '../src/i18n/gamifyText';
import { useT } from '../src/i18n/useT';
import { ActivityType, WHO_WEEKLY_MINUTES, formatPace, kcalBurned, paceMinPerKm, personalBests, weekSeries, weekSummary } from '../src/lib/activity';
import { currentWeight } from '../src/lib/coach';
import { toDateKey } from '../src/lib/nutrition';
import { addDays } from '../src/lib/tracker';
import { useKabe } from '../src/store/kabe';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

const TYPES: ActivityType[] = ['walk', 'run', 'cycle', 'cardio', 'other'];
const EFFORT = [3, 5, 8, 10];

export default function ActivityScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const k = useKabe();
  const tk = useTracker();
  const { t, lang } = useT();
  const today = toDateKey(new Date());
  const [offset, setOffset] = useState(0);
  const date = addDays(today, -offset);
  const [type, setType] = useState<ActivityType>('walk');
  const [minutes, setMinutes] = useState('');
  const [km, setKm] = useState('');
  const [effort, setEffort] = useState<number | undefined>();
  const typeName = (x: ActivityType) => t(`act.type.${x}` as Key);
  const dayName = (key: string) => t(`day.${new Date(key + 'T00:00:00').getDay()}` as Key);

  const weightKg = currentWeight(tk.weights, k.profile?.weightKg ?? 60);
  const week = useMemo(() => weekSummary(tk.activities, tk.steps, today, weightKg, tk.stepGoal, k.workouts), [tk.activities, tk.steps, today, weightKg, tk.stepGoal, k.workouts]);
  const series = useMemo(() => weekSeries(tk.activities, tk.steps, today, k.workouts), [tk.activities, tk.steps, today, k.workouts]);
  const bests = useMemo(() => personalBests(tk.activities), [tk.activities]);
  const recent = useMemo(() => [...tk.activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12), [tk.activities]);

  const mins = parseFloat(minutes.replace(',', '.'));
  const dist = parseFloat(km.replace(',', '.'));
  const canAdd = mins > 0 && mins <= 600 && (!km.trim() || (dist > 0 && dist <= 300));
  const steps = tk.steps[date] ?? 0;
  const preview = canAdd ? kcalBurned({ type, minutes: mins, km: dist > 0 ? dist : undefined, effort }, weightKg) : null;

  const add = () => {
    tk.addActivity({ date, type, minutes: mins, km: dist > 0 ? dist : undefined, effort: type === 'cardio' || type === 'other' ? effort : undefined });
    setMinutes('');
    setKm('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('train.activity')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.chips}>
          {[0, 1, 2].map((o) => (
            <Pressable key={o} onPress={() => setOffset(o)} style={[styles.chip, offset === o && styles.chipOn]}>
              <Text style={[styles.chipText, offset === o && { color: colors.onPrimary }]}>{t(`act.d${o}` as Key)}</Text>
            </Pressable>
          ))}
        </View>

        <Button title={t('track.link')} icon="navigate" variant="ghost" onPress={() => router.push('/track')} />

        <Card style={{ gap: 10, alignItems: 'center' }}>
          <Text style={[styles.h2, { alignSelf: 'flex-start' }]}>{t('act.steps')}</Text>
          <ProgressRing size={130} stroke={12} progress={steps / tk.stepGoal}>
            <Text style={styles.big}>{steps.toLocaleString()}</Text>
            <Text style={styles.sub}>{t('act.ofGoal', { n: tk.stepGoal.toLocaleString() })}</Text>
          </ProgressRing>
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <NumBox live label={t('act.stepsForDay')} value={steps} onCommit={(n) => tk.setSteps(date, n)} />
            <NumBox live label={t('act.dailyGoal')} value={tk.stepGoal} onCommit={(n) => n >= 1000 && tk.setStepGoal(n)} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' }}>
            <Switch value={tk.autoSteps} onValueChange={tk.setAutoSteps} trackColor={{ true: colors.primary }} />
            <Text style={[styles.sub, { flex: 1, fontSize: 14, color: colors.ink }]}>{t('steps.auto')}</Text>
          </View>
          {Platform.OS === 'web' ? <WebStepsControl /> : null}
          {Platform.OS !== 'web' && (
            <>
              <Text style={styles.sub}>{t('act.stepNote')}</Text>
              <Text style={styles.sub}>{t('steps.denied')}</Text>
            </>
          )}
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('act.log')}</Text>
          <View style={styles.chips}>
            {TYPES.map((x) => (
              <Pressable key={x} onPress={() => setType(x)} style={[styles.chip, type === x && styles.chipOn]}>
                <Text style={[styles.chipText, type === x && { color: colors.onPrimary }]}>{typeName(x)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={minutes} onChangeText={setMinutes} keyboardType="decimal-pad" placeholder={t('act.minutes')} placeholderTextColor={colors.inkSoft} style={[styles.input, { flex: 1, minWidth: 0 }]} />
            <TextInput value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder={t('act.distance')} placeholderTextColor={colors.inkSoft} style={[styles.input, { flex: 1.4 }]} />
          </View>
          {(type === 'cardio' || type === 'other') && (
            <View style={styles.chips}>
              {EFFORT.map((e) => (
                <Pressable key={e} onPress={() => setEffort(effort === e ? undefined : e)} style={[styles.chip, effort === e && styles.chipOn]}>
                  <Text style={[styles.chipText, effort === e && { color: colors.onPrimary }]}>{t(`act.effort.${e}` as Key)}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {canAdd && (
            <Text style={styles.sub}>{t('act.preview', { pace: dist > 0 ? t('act.pace', { pace: formatPace(paceMinPerKm({ minutes: mins, km: dist })) }) : '', kcal: preview ?? 0 })}</Text>
          )}
          <Button title={t('act.addTo', { when: t(`act.when${offset}` as Key) })} icon="add" disabled={!canAdd} onPress={add} />
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={styles.h2}>{t('act.thisWeek')}</Text>
          <View style={styles.stats}>
            <Stat value={`${week.activeMinutes}`} label={t('act.activeMin')} />
            <Stat value={`${week.km}`} label={unitLabel(lang, 'km')} />
            <Stat value={`${week.sessions}`} label={t('act.sessions')} />
            <Stat value={week.avgSteps ? week.avgSteps.toLocaleString() : '—'} label={t('act.avgSteps')} />
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, (week.activeMinutes / WHO_WEEKLY_MINUTES) * 100)}%` }]} />
          </View>
          <Text style={styles.sub}>
            {week.activeMinutes >= WHO_WEEKLY_MINUTES ? t('act.whoReached', { n: WHO_WEEKLY_MINUTES }) : t('act.whoMore', { left: WHO_WEEKLY_MINUTES - week.activeMinutes, n: WHO_WEEKLY_MINUTES })}
            {week.kcal ? t('act.burned', { kcal: week.kcal }) : ''}
          </Text>
          <Text style={styles.label}>{t('act.activeMinutes')}</Text>
          <BarChart data={series.map((d) => ({ label: dayName(d.date), value: d.minutes }))} goal={WHO_WEEKLY_MINUTES / 7} format={(v) => String(Math.round(v))} />
          <Text style={styles.label}>{t('act.steps')}</Text>
          <BarChart color="#3B9AE1" data={series.map((d) => ({ label: dayName(d.date), value: d.steps }))} goal={tk.stepGoal} format={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
          <Text style={styles.sub}>{t('act.weekNote')}</Text>
        </Card>

        {(bests.longestRunKm || bests.longestWalkKm || bests.longestRideKm) && (
          <Card style={{ gap: 4 }}>
            <Text style={styles.h2}>{t('act.bests')}</Text>
            {bests.longestRunKm ? <Text style={styles.body}>{t('act.bestRun', { n: bests.longestRunKm })}</Text> : null}
            {bests.fastestRunPace ? <Text style={styles.body}>{t('act.bestPace', { pace: formatPace(bests.fastestRunPace) })}</Text> : null}
            {bests.longestWalkKm ? <Text style={styles.body}>{t('act.bestWalk', { n: bests.longestWalkKm })}</Text> : null}
            {bests.longestRideKm ? <Text style={styles.body}>{t('act.bestRide', { n: bests.longestRideKm })}</Text> : null}
          </Card>
        )}

        {recent.length > 0 && (
          <Card style={{ gap: 2 }}>
            <Text style={styles.h2}>{t('act.recent')}</Text>
            {recent.map((a) => (
              <View key={a.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {t('act.sessionLine', { type: typeName(a.type), min: a.minutes })}
                    {a.km ? t('act.sessionKm', { km: a.km }) : ''}
                  </Text>
                  <Text style={styles.sub}>
                    {a.date}
                    {a.km ? ` · ${formatPace(paceMinPerKm(a))}` : ''} · ≈{kcalBurned(a, weightKg)} kcal
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => Alert.alert(t('act.deleteQ'), `${typeName(a.type)} · ${a.date}`, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: () => tk.removeActivity(a.id) }])}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.inkSoft} />
                </Pressable>
              </View>
            ))}
          </Card>
        )}
        <Text style={styles.note}>{t('act.note', { kg: weightKg.toFixed(0) })}</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statV}>{value}</Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 16, fontWeight: '700', color: colors.ink },
  big: { fontSize: 26, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14, color: colors.ink },
  name: { fontSize: 14, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  note: { fontSize: 11, color: colors.inkSoft, lineHeight: 16, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginTop: 4 },
  statV: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
  stats: { flexDirection: 'row' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  input: { borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
});

/** Browser only: asks for motion access (iPhone Safari shows its own question) and says whether steps are being counted. */
function WebStepsControl() {
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [state, setState] = useState<'idle' | 'on' | 'denied' | 'unsupported'>('idle');
  useEffect(() => {
    const w = globalThis as any;
    const on = () => setState('on');
    w.addEventListener(WEB_STEPS_ACTIVE_EVENT, on);
    return () => w.removeEventListener(WEB_STEPS_ACTIVE_EVENT, on);
  }, []);
  const enable = async () => {
    const r = await requestMotion(); // must run straight from the tap
    if (r !== 'granted') return setState(r);
    try {
      (globalThis as any).localStorage?.setItem(WEB_STEPS_KEY, '1');
    } catch {
      /* storage blocked: counting still starts for this visit */
    }
    (globalThis as any).dispatchEvent(new Event(WEB_STEPS_EVENT));
    setTimeout(() => setState((s) => (s === 'idle' ? 'unsupported' : s)), 4000); // no readings arrived: this browser has no motion sensor
  };
  return (
    <View style={{ alignSelf: 'stretch', gap: 8 }}>
      {state !== 'on' && <Button title={t('steps.webBtn')} icon="walk" variant="ghost" onPress={() => void enable()} />}
      <Text style={styles.sub}>{t(state === 'on' ? 'steps.webOn' : state === 'denied' ? 'steps.webDenied' : state === 'unsupported' ? 'steps.webNo' : 'steps.webHint')}</Text>
    </View>
  );
}
