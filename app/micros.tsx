import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Loading } from '../src/components/Loading';
import { Text } from '../src/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '../src/components/ui';
import type { Key } from '../src/i18n';
import { useT } from '../src/i18n/useT';
import { MICROS, MicroRow, intakeOf, missingFoods, shareOf } from '../src/lib/micro';
import { loadMicroCache, loadMicroMisses, recentlyMissed, saveMicroCache, saveMicroMisses } from '../src/lib/microCache';
import { r0, toDateKey } from '../src/lib/nutrition';
import { lookupMicros } from '../src/lib/vision';
import { supplementIntake } from '../src/lib/supplements';
import { useKabe } from '../src/store/kabe';
import { useTracker } from '../src/store/tracker';
import { radius, useColors, useThemedStyles, type Colors } from '../src/theme';
import { Dots } from '../src/components/Dots';
import { goBack } from '../src/lib/nav';

type Period = 'today' | 'week';
const BATCH = 8; // foods looked up per visit (keeps within the free AI limits)

const keyBack = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateKey(d);
};

export default function Micros() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const k = useKabe();
  const tk = useTracker();
  const ai = !!k.geminiKey && k.aiConsent;
  const [period, setPeriod] = useState<Period>('today');
  const [cache, setCache] = useState<Record<string, MicroRow>>({});
  const [loaded, setLoaded] = useState(false);
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [gaveUp, setGaveUp] = useState(false);
  const [tried, setTried] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([loadMicroCache(), loadMicroMisses()]).then(([c, m]) => {
      if (live) {
        setCache(c);
        setMisses(m);
        setLoaded(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const days = period === 'today' ? [keyBack(0)] : Array.from({ length: 7 }, (_, i) => keyBack(i));
  const logged = useMemo(
    () => k.entries.filter((e) => days.includes(e.date)).map((e) => ({ name: e.name, grams: e.grams, kcal: e.kcal, date: e.date })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [k.entries, period],
  );
  // every supplement dose ticked off in the period adds what one dose contains
  const supp = useMemo(
    () => supplementIntake(tk.supplements, tk.supplementLog, days),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tk.supplements, tk.supplementLog, period],
  );
  const suppDays = days.filter((d) => (tk.supplementLog[d] ?? []).some((id) => tk.supplements.some((x) => x.id === id)));
  const loggedDays = new Set([...logged.filter((e) => e.kcal > 0).map((e) => e.date), ...suppDays]).size;
  const food = useMemo(() => intakeOf(logged, cache), [logged, cache]);
  const coverage = food.coverage;
  const total = Object.fromEntries(MICROS.map((m) => [m.id, food.total[m.id] + supp.total[m.id]])) as typeof food.total;
  const perDay = (v: number) => (period === 'week' ? v / Math.max(1, loggedDays) : v);
  const missing = useMemo(() => missingFoods(logged, cache).filter((m) => !tried.includes(m) && !recentlyMissed(misses, m)), [logged, cache, tried, misses]);
  const busy = ai && loaded && !done && missing.length > 0;

  // look up the vitamins and minerals of foods we have not seen yet (a few per visit, once each, remembered)
  useEffect(() => {
    if (!busy) return;
    let live = true;
    (async () => {
      const batch = missing.slice(0, BATCH);
      const next = { ...cache };
      const nextMiss = { ...misses };
      let failed = false;
      for (const name of batch) {
        try {
          const row = await lookupMicros(k.geminiKey, name);
          if (row) next[name] = row;
          else {
            nextMiss[name] = Date.now(); // no usable numbers: do not ask again for a week
            failed = true;
          }
        } catch {
          failed = true;
          break; // offline or out of free requests: stop here instead of repeating the failure for every food
        }
        await saveMicroCache(next);
        if (!live) return;
        setCache({ ...next });
      }
      await saveMicroMisses(nextMiss);
      if (live) setMisses(nextMiss);
      if (live) {
        setTried((t) => [...t, ...batch]);
        setGaveUp(failed);
        setDone(true);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const retry = () => {
    setMisses({});
    void saveMicroMisses({});
    setTried([]);
    setGaveUp(false);
    setDone(false);
  };

  const tone = (level: 'low' | 'ok' | 'plenty') => (level === 'low' ? colors.warn : colors.good);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Dots />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={styles.title}>{t('micro.title')}</Text>
        <Pressable onPress={() => goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 60 }}>
        <View style={styles.chips}>
          {(['today', 'week'] as Period[]).map((p) => (
            <Pressable key={p} onPress={() => { setPeriod(p); setDone(false); }} style={[styles.chip, period === p && styles.chipOn]}>
              <Text style={[styles.chipText, period === p && { color: colors.onPrimary }]}>{t(`micro.${p}` as Key)}</Text>
            </Pressable>
          ))}
        </View>

        {!ai && (
          <Card style={{ gap: 8 }}>
            <Text style={styles.body}>{t('micro.needAi')}</Text>
            {!!k.geminiKey && <Button title={t('photo.continue')} variant="ghost" onPress={() => k.setAiConsent(true)} />}
          </Card>
        )}

        {logged.length === 0 && supp.doses === 0 ? (
          <Card>
            <Text style={styles.body}>{t('micro.empty')}</Text>
          </Card>
        ) : (
          <>
            {busy && (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Loading />
                <Text style={styles.body}>{t('micro.working', { n: Math.min(BATCH, missing.length) })}</Text>
              </Card>
            )}
            <Card style={{ gap: 12 }}>
              {MICROS.map((m) => {
                const amount = perDay(total[m.id]);
                const s = shareOf(amount, m);
                return (
                  <View key={m.id} style={{ gap: 4 }}>
                    <View style={styles.between}>
                      <Text style={styles.name}>{t(`micro.n.${m.id}` as Key)}</Text>
                      <Text style={styles.sub}>
                        {t('micro.of', { v: String(Math.round(amount * 10) / 10), dv: String(m.dv), unit: m.unit })}
                      </Text>
                    </View>
                    <View style={styles.track}>
                      <View style={{ width: `${Math.min(100, s.pct)}%`, height: '100%', backgroundColor: tone(s.level) }} />
                    </View>
                  </View>
                );
              })}
            </Card>
            {supp.doses > 0 && <Text style={styles.sub}>{t('micro.fromSupp', { n: supp.doses })}</Text>}
            {coverage > 0 && coverage < 0.98 && <Text style={styles.sub}>{t('micro.cover', { pct: r0(coverage * 100) })}</Text>}
            {gaveUp && !busy && ai && (
              <Pressable onPress={retry}>
                <Text style={styles.link}>{t('lookup.retry')}</Text>
              </Pressable>
            )}
            <Text style={styles.sub}>{period === 'week' ? t('micro.weekNote') : ''}</Text>
          </>
        )}
        <Text style={styles.sub}>{t('micro.estimate')}</Text>
        <Text style={styles.sub}>{t('micro.disc')}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
