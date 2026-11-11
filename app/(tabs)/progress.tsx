import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/Text';
import { InsightsCard } from '../../src/components/InsightsCard';
import { Screen } from '../../src/components/Screen';
import { Card, LinkRow } from '../../src/components/ui';
import type { Key } from '../../src/i18n';
import { useT } from '../../src/i18n/useT';
import { r0, sumMacros, toDateKey } from '../../src/lib/nutrition';
import { useKabe } from '../../src/store/kabe';
import { useTracker } from '../../src/store/tracker';
import { useColors, useThemedStyles, type Colors } from '../../src/theme';
import { Sticker } from '../../src/components/Sticker';

export default function Progress() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { entries, goals } = useKabe();
  const { t } = useT();
  const { weights, steps } = useTracker();
  const stepsToday = steps[toDateKey(new Date())];
  const latestWeight = weights[weights.length - 1];

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = toDateKey(d);
      const total = sumMacros(entries.filter((e) => e.date === key));
      return { key, dow: d.getDay(), ...total };
    });
  }, [entries]);

  const logged = days.filter((d) => d.kcal > 0);
  const avg = logged.length ? logged.reduce((a, d) => a + d.kcal, 0) / logged.length : 0;
  const avgP = logged.length ? logged.reduce((a, d) => a + d.protein, 0) / logged.length : 0;
  const max = Math.max(goals.kcal, ...days.map((d) => d.kcal));

  return (
    <Screen title={t('tab.progress')} subtitle={t('prog.subtitle')} headerRight={<Sticker name="check" size={50} tilt={8} bob style={{ marginTop: 6 }} />}>
      <InsightsCard />
      <Card>
        <Text style={styles.h2}>{t('prog.calories')}</Text>
        <View style={styles.chart}>
          {days.map((d) => (
            <View key={d.key} style={styles.col}>
              <View style={styles.barBox}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${(d.kcal / max) * 100}%`,
                      backgroundColor: d.kcal > goals.kcal ? colors.danger : colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.dayLabel}>{t(`day.${d.dow}` as Key)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.sub}>{t('prog.goal', { n: r0(goals.kcal) })}</Text>
      </Card>

      <Card style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.stat}>{r0(avg)}</Text>
          <Text style={styles.sub}>{t('prog.avgKcal')}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.stat}>{r0(avgP)}g</Text>
          <Text style={styles.sub}>{t('prog.avgProtein')}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.stat}>{logged.length}/7</Text>
          <Text style={styles.sub}>{t('prog.daysLogged')}</Text>
        </View>
      </Card>

      <LinkRow icon="stats-chart-outline" title={t('stats.link')} sub={t('stats.linkSub')} onPress={() => router.push('/stats')} />
      <LinkRow icon="body-outline" title={t('body.title')} sub={latestWeight ? t('prog.bodyLatest', { kg: latestWeight.kg }) : t('prog.bodyEmpty')} onPress={() => router.push('/body')} />
      <LinkRow icon="walk-outline" title={t('train.activity')} sub={stepsToday ? t('train.steps', { n: stepsToday.toLocaleString() }) : t('train.activityCta')} onPress={() => router.push('/activity')} />
      <LinkRow icon="leaf-outline" title={t('micro.link')} sub={t('micro.linkSub')} onPress={() => router.push('/micros')} />
      <LinkRow icon="images-outline" title={t('photos.link')} sub={t('photos.linkSub')} onPress={() => router.push('/photos')} />
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  chart: { flexDirection: 'row', height: 150, alignItems: 'flex-end', gap: 8 },
  col: { flex: 1, alignItems: 'center', height: '100%' },
  barBox: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, minHeight: 2 },
  dayLabel: { marginTop: 6, fontSize: 12, color: colors.inkSoft },
  stat: { fontSize: 22, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 12, color: colors.inkSoft, textAlign: 'center', marginTop: 4 },
});
