import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MOTION } from '../config/app';
import { useColors, useThemedStyles, type Colors } from '../theme';
import { Dots } from './Dots';
import { Sticker } from './Sticker';
import { Text } from './Text';

/** Three dots that hop one after another. Use it wherever something is being worked out (AI answers, saving). */
export function Loading({ label, size = 12 }: { label?: string; size?: number }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  useEffect(() => {
    if (!MOTION.enabled) return;
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 140 + 200),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <View style={styles.row}>
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: i === 1 ? colors.ink : colors.primary,
              transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 1.2] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
            }}
          />
        ))}
      </View>
      {label ? <Text style={[styles.label, { color: colors.inkSoft }]}>{label}</Text> : null}
    </View>
  );
}

/** A full-screen loading page: the Kabe name pulses above the hopping dots. */
export function LoadingScreen({ label }: { label?: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!MOTION.enabled) return;
    const a = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [pulse]);
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <Dots />
      <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
        <Sticker name="mascot" size={150} />
      </Animated.View>
      <Sticker name="wordmark" size={110} />
      <Loading label={label} />
    </View>
  );
}

const makeStyles = (_colors: Colors) => StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  row: { flexDirection: 'row', gap: 8, height: 30, alignItems: 'flex-end' },
  label: { fontSize: 13, fontWeight: '600' },
  screen: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 18, zIndex: 50 },
  brand: { fontSize: 44, fontWeight: '900', letterSpacing: -1.5 },
});
