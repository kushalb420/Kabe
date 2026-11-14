import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useT } from '../i18n/useT';
import type { Fix } from '../lib/gps';
import { projectRoute } from '../lib/routeCard';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { Text } from './Text';

type Props = { route: Fix[]; kindLabel: string; distance: string; pace: string; paceLabel: string; time: string };

/**
 * The route poster: your distance, pace and time over the shape of the route you walked, ready to screenshot or share.
 * It uses the colours of the chosen theme, so it always matches the app.
 */
export function RouteCard({ route, kindLabel, distance, pace, paceLabel, time }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [w, setW] = useState(300);
  const H = 190;
  const p = projectRoute(route, w, H, 16);
  const stat = (label: string, value: string) => (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
  return (
    <View style={styles.card}>
      <Text style={styles.kind}>{kindLabel}</Text>
      <View style={{ flexDirection: 'row' }}>
        {stat(t('track.distance'), distance)}
        {stat(paceLabel, pace)}
        {stat(t('route.time'), time)}
      </View>
      <View style={{ height: H }} onLayout={(e) => setW(Math.max(120, Math.floor(e.nativeEvent.layout.width)))}>
        {p ? (
          <Svg width={w} height={H}>
            <Path d={p.path} stroke={colors.ink} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.15} />
            <Path d={p.path} stroke={colors.accent} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Circle cx={p.start.x} cy={p.start.y} r={6} fill={colors.card} stroke={colors.ink} strokeWidth={2.5} />
            <Circle cx={p.end.x} cy={p.end.y} r={6} fill={colors.ink} stroke={colors.card} strokeWidth={2.5} />
          </Svg>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={styles.empty}>{t('route.noRoute')}</Text>
          </View>
        )}
      </View>
      <Text style={styles.brand}>KABE</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  card: { backgroundColor: colors.bg, borderWidth: BORDER, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: 16, gap: 12 },
  kind: { fontSize: 13, fontWeight: '800', color: colors.inkSoft, textAlign: 'center', letterSpacing: 1.2, textTransform: 'uppercase' },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  value: { fontSize: 26, fontWeight: '800', color: colors.ink },
  empty: { fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  brand: { fontSize: 15, fontWeight: '900', color: colors.ink, textAlign: 'center', letterSpacing: 4 },
});
