import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useT } from '../i18n/useT';
import { BORDER, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { Text } from './Text';
import { Card } from './ui';

const FOODS = ['🍛', '🥗', '🍎', '🥛', '🍚', '🥘'];
const STEPS = ['calc.s1', 'calc.s2', 'calc.s3', 'calc.s4'] as const;

/** One bouncing food: tap it and it jumps. */
function Bouncy({ glyph, delay }: { glyph: string; delay: number }) {
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: -10, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y, delay]);
  const jump = () =>
    Animated.sequence([
      Animated.timing(y, { toValue: -34, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, useNativeDriver: true }),
    ]).start();
  return (
    <Pressable onPress={jump} hitSlop={6}>
      <Animated.Text style={{ fontSize: 34, transform: [{ translateY: y }] }}>{glyph}</Animated.Text>
    </Pressable>
  );
}

/** Shown while a meal is being worked out. Nothing can be edited until the full calculation is ready. */
export function Calculating({ photoUri }: { photoUri?: string | null }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1700);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(slide, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [slide]);

  return (
    <Card style={{ gap: 16, alignItems: 'center' }}>
      <Text style={styles.title}>{t('calc.title')}</Text>
      <View style={styles.row}>
        {FOODS.map((g, i) => (
          <Bouncy key={g} glyph={g} delay={i * 120} />
        ))}
      </View>
      <Text style={styles.hint}>{t('calc.tap')}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 280] }) }] }]} />
      </View>
      <View style={{ alignSelf: 'stretch', gap: 6 }}>
        {STEPS.map((k, i) => (
          <View key={k} style={styles.stepRow}>
            <Ionicons name={i < step ? 'checkmark-circle' : i === step ? 'ellipse' : 'ellipse-outline'} size={18} color={i <= step ? colors.ink : colors.inkSoft} />
            <Text style={[styles.step, i === step && { fontWeight: '800', color: colors.ink }]}>{t(k)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>{t('calc.sub')}</Text>
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, minHeight: 56, alignItems: 'flex-end' },
  hint: { fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
  track: { alignSelf: 'stretch', height: 14, borderRadius: 7, borderWidth: BORDER, borderColor: colors.cardBorder, backgroundColor: colors.card, overflow: 'hidden' },
  bar: { width: 110, height: '100%', borderRadius: radius.sm, backgroundColor: colors.primary },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { fontSize: 14, color: colors.inkSoft },
});
