import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Alert } from '../src/lib/alert';
import { Text, TextInput } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from '../src/components/LineChart';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { toDateKey } from '../src/lib/nutrition';
import { MEASURE_KEYS, MeasureKey, dayIndex, trendSeries, weeklyChange } from '../src/lib/tracker';
import { navyBodyFat } from '../src/lib/bodyfat';
import { useKabe } from '../src/store/kabe';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

const LABEL: Record<MeasureKey, Key> = { waist: 'body.waist', neck: 'body.neck', chest: 'body.chest', hips: 'body.hips', arm: 'body.arm', thigh: 'body.thigh' };

export default function Body() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useT();
  const { weights, measurements, logWeight, removeWeight, logMeasurement, removeMeasurement } = useTracker();
  const today = toDateKey(new Date());
  const [tab, setTab] = useState<'weight' | 'measure'>('weight');
  const [kg, setKg] = useState('');
  const [vals, setVals] = useState<Record<MeasureKey, string>>({ waist: '', neck: '', chest: '', hips: '', arm: '', thigh: '' });

  const recent = useMemo(() => weights.slice(-60), [weights]);
  const trend = useMemo(() => trendSeries(weights).slice(-60), [weights]);
  const change = weeklyChange(weights, today);
  const latest = weights[weights.length - 1];
  const first = weights[0];

  const saveWeight = () => {
    const v = parseFloat(kg.replace(',', '.'));
    if (!(v >= 20 && v <= 300)) {
      Alert.alert(t('body.checkNumber'), t('body.weightRange'));
      return;
    }
    logWeight(today, Math.round(v * 10) / 10);
    setKg('');
  };

  const saveMeasure = () => {
    const m: { date: string } & Partial<Record<MeasureKey, number>> = { date: today };
    for (const k of MEASURE_KEYS) {
      const v = parseFloat(vals[k].replace(',', '.'));
      if (v >= 10 && v <= 250) m[k] = Math.round(v * 10) / 10;
    }
    if (Object.keys(m).length === 1) {
      Alert.alert(t('body.nothingToSave'), t('body.needOne'));
      return;
    }
    logMeasurement(m);
    setVals({ waist: '', neck: '', chest: '', hips: '', arm: '', thigh: '' });
  };

  const lastTwo = measurements.slice(-2);
  const { profile } = useKabe();
  // The formula follows the sex you choose (Me tab by default). Entering hips never changes it.
  const [bfSex, setBfSex] = useState<'male' | 'female' | null>(null);
  const sexUsed = bfSex ?? profile?.sex ?? 'male';
  const latestOf = (k: MeasureKey) => measurements.slice().reverse().find((m) => m[k] !== undefined)?.[k];
  const fat =
    profile && latestOf('waist') && latestOf('neck')
      ? navyBodyFat({ sex: sexUsed, heightCm: profile.heightCm, waistCm: latestOf('waist')!, neckCm: latestOf('neck')!, hipsCm: latestOf('hips') })
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('body.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.seg}>
        {(['weight', 'measure'] as const).map((id) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.segBtn, tab === id && styles.segOn]}>
            <Text style={[styles.segText, tab === id && { color: colors.onPrimary }]}>{id === 'weight' ? t('body.weight') : t('body.measurements')}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {tab === 'weight' ? (
          <>
            <Card style={{ gap: 10 }}>
              <Text style={styles.h2}>{t('body.todayWeight')}</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TextInput
                  value={kg}
                  onChangeText={setKg}
                  keyboardType="decimal-pad"
                  placeholder={latest ? String(latest.kg) : 'kg'}
                  placeholderTextColor={colors.inkSoft}
                  style={styles.input}
                />
                <Text style={styles.unit}>kg</Text>
                <View style={{ flex: 1 }}>
                  <Button title={t('common.save')} onPress={saveWeight} disabled={!kg.trim()} />
                </View>
              </View>
              <Text style={styles.sub}>{t('body.weighNote')}</Text>
            </Card>

            {weights.length > 0 && (
              <Card style={{ gap: 10 }}>
                <Text style={styles.h2}>{t('body.trend')}</Text>
                <LineChart
                  width={width - 72}
                  raw={recent.map((w) => ({ x: dayIndex(w.date), y: w.kg }))}
                  trend={trend.map((w) => ({ x: dayIndex(w.date), y: w.avg }))}
                />
                <Text style={styles.sub}>{t('body.trendLegend')}</Text>
                <View style={{ flexDirection: 'row' }}>
                  <Stat label={t('body.latest')} value={`${latest.kg} kg`} />
                  <Stat label={t('body.sinceStart')} value={weights.length > 1 ? `${fmt(latest.kg - first.kg)} kg` : '—'} />
                  <Stat label={t('body.perWeek')} value={change === null ? '—' : `${fmt(change)} kg`} />
                </View>
                {change === null && <Text style={styles.sub}>{t('body.weeklyNote')}</Text>}
              </Card>
            )}

            {weights.length > 0 && (
              <Card style={{ gap: 2 }}>
                <Text style={styles.h2}>{t('body.log')}</Text>
                {[...weights].reverse().slice(0, 30).map((w) => (
                  <Pressable
                    key={w.date}
                    style={styles.row}
                    onLongPress={() =>
                      Alert.alert(t('body.deleteWeigh'), `${w.date} · ${w.kg} kg`, [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.delete'), style: 'destructive', onPress: () => removeWeight(w.date) },
                      ])
                    }
                  >
                    <Text style={styles.rowL}>{w.date}</Text>
                    <Text style={styles.rowR}>{w.kg} kg</Text>
                  </Pressable>
                ))}
                <Text style={styles.sub}>{t('body.longPressDelete')}</Text>
              </Card>
            )}
          </>
        ) : (
          <>
            <Card style={{ gap: 10 }}>
              <Text style={styles.h2}>{t('body.todayMeasure')}</Text>
              {MEASURE_KEYS.map((k) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={[styles.rowL, { width: 70 }]}>{t(LABEL[k])}</Text>
                  <TextInput
                    value={vals[k]}
                    onChangeText={(text) => setVals({ ...vals, [k]: text })}
                    keyboardType="decimal-pad"
                    placeholder={String(measurements.slice().reverse().find((m) => m[k] !== undefined)?.[k] ?? 'cm')}
                    placeholderTextColor={colors.inkSoft}
                    style={[styles.input, { flex: 1, minWidth: 0 }]}
                  />
                </View>
              ))}
              <Button title={t('body.saveMeasure')} onPress={saveMeasure} />
              <Text style={styles.sub}>{t('body.measureNote')}</Text>
            </Card>

            <Card style={{ gap: 6 }}>
              <Text style={styles.h2}>{t('body.fatTitle')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['male', 'female'] as const).map((x) => (
                  <Pressable key={x} onPress={() => setBfSex(x)} style={[styles.sexChip, sexUsed === x && { backgroundColor: colors.primary }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: sexUsed === x ? colors.onPrimary : colors.ink }}>{t(x === 'male' ? 'me.male' : 'me.female')}</Text>
                  </Pressable>
                ))}
              </View>
              {fat ? (
                <>
                  <Text style={styles.stat}>{t('body.fatValue', { pct: fat.pct, lo: fat.low, hi: fat.high })}</Text>
                  <Text style={styles.rowL}>{t(`body.fat.${fat.category}` as Key)}</Text>
                </>
              ) : (
                <Text style={styles.sub}>{t('body.fatNeed')}</Text>
              )}
              <Text style={styles.sub}>{t('body.fatNote')}</Text>
            </Card>

            {lastTwo.length > 0 && (
              <Card style={{ gap: 6 }}>
                <Text style={styles.h2}>{t('body.latestOn', { date: lastTwo[lastTwo.length - 1].date })}</Text>
                {MEASURE_KEYS.map((k) => {
                  const cur = lastTwo[lastTwo.length - 1][k];
                  if (cur === undefined) return null;
                  const prevEntry = measurements.slice(0, -1).reverse().find((m) => m[k] !== undefined);
                  const diff = prevEntry ? cur - (prevEntry[k] as number) : null;
                  return (
                    <View key={k} style={styles.row}>
                      <Text style={styles.rowL}>{t(LABEL[k])}</Text>
                      <Text style={styles.rowR}>
                        {cur} cm{diff !== null ? `  (${fmt(diff)})` : ''}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            )}

            {measurements.length > 0 && (
              <Card style={{ gap: 2 }}>
                <Text style={styles.h2}>{t('body.history')}</Text>
                {[...measurements].reverse().slice(0, 20).map((m) => (
                  <Pressable
                    key={m.date}
                    style={styles.row}
                    onLongPress={() =>
                      Alert.alert(t('body.deleteMeasure'), m.date, [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.delete'), style: 'destructive', onPress: () => removeMeasurement(m.date) },
                      ])
                    }
                  >
                    <Text style={styles.rowL}>{m.date}</Text>
                    <Text style={styles.rowS}>{MEASURE_KEYS.filter((k) => m[k] !== undefined).map((k) => `${t(LABEL[k])} ${m[k]}`).join(' · ')}</Text>
                  </Pressable>
                ))}
                <Text style={styles.sub}>{t('body.historyHint')}</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const fmt = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}`;

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.stat}>{value}</Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  sexChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  seg: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 4 },
  segBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  segOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft },
  input: { width: 110, borderWidth: 2, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontSize: 18, fontWeight: '700', color: colors.ink, backgroundColor: colors.card },
  unit: { fontSize: 16, color: colors.inkSoft, fontWeight: '600' },
  stat: { fontSize: 17, fontWeight: '800', color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowL: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  rowR: { fontSize: 14, color: colors.ink, fontWeight: '700' },
  rowS: { fontSize: 12, color: colors.inkSoft, flexShrink: 1, textAlign: 'right' },
});
