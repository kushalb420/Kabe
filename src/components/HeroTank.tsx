import React, { useEffect, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { MOTION } from '../config/app';
import { SHADOW_OFFSET, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { HardShadow } from './HardShadow';
import { CountUp, useAnimatedNumber } from './Motion';
import { Text } from './Text';

export type HeroMetric = { key: string; label: string; value: number; goal: number; unit: string; leftLabel: string; overLabel: string };

const WATER = '#C6E6F8'; // pastel light blue
const WATER_OVER = '#F5B5C0'; // pastel pink when a target is passed
const H = 176; // the TV screen
const PAD = 10; // room for the calorie ring around the screen
const WAVE_W = 240;
const wavePath = `M0 10 Q${WAVE_W / 8} 0 ${WAVE_W / 4} 10 T${WAVE_W / 2} 10 T${(WAVE_W * 3) / 4} 10 T${WAVE_W} 10 V60 H0 Z`;
const star = (x: number, y: number, r: number) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;

/**
 * Today's hero: a little old-fashioned TV. The screen is a glass that fills as you eat (with a moving wave), the ring around the screen shows today's calories, and tapping the TV (or its knobs) flips the
 * screen between calories and each macro. All motion uses the native driver, so it stays smooth on low-end phones.
 */
export function HeroTank({ metrics }: { metrics: HeroMetric[] }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [i, setI] = useState(0);
  const [w, setW] = useState(0);
  const m = metrics[i % metrics.length];
  const p = m.goal > 0 ? Math.max(0, Math.min(1, m.value / m.goal)) : 0;
  const over = m.value > m.goal;
  const rise = useState(() => new Animated.Value(0))[0];
  const drift = useState(() => new Animated.Value(0))[0];
  const pop = useState(() => new Animated.Value(1))[0];
  const bob = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const a = MOTION.enabled ? Animated.spring(rise, { toValue: p, friction: 8, tension: 40, useNativeDriver: true }) : Animated.timing(rise, { toValue: p, duration: 0, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [p, rise]);
  useEffect(() => {
    if (!MOTION.enabled) return;
    const loop = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }));
    const wiggle = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]));
    loop.start();
    wiggle.start();
    return () => {
      loop.stop();
      wiggle.stop();
    };
  }, [drift, bob]);

  const flip = () => {
    setI((x) => (x + 1) % metrics.length);
    if (MOTION.enabled) Animated.sequence([Animated.timing(pop, { toValue: 0.96, duration: 90, useNativeDriver: true }), Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true })]).start();
  };
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  // the ring around the screen always shows today's calories, whichever number the screen is showing
  const kc = metrics.find((x) => x.key === 'kcal') ?? metrics[0];
  const ringP = useAnimatedNumber(kc.goal > 0 ? Math.max(0, Math.min(1, kc.value / kc.goal)) : 0, MOTION.ringMs);
  const [cw, setCw] = useState(0);
  const RING = 6;
  const rw = Math.max(0, cw - RING);
  const rh = H + 2 * PAD - RING;
  const rr = 26;
  const perim = 2 * (rw + rh - 4 * rr) + 2 * Math.PI * rr;
  const fillColor = over && m.key !== 'protein' ? WATER_OVER : WATER; // more protein is fine: only the keep-under numbers turn pink // soft pastel water: dark text stays readable on top of it
  const left = Math.round(Math.abs(m.goal - m.value));

  return (
    <Pressable style={{ alignSelf: 'stretch' }} onPress={flip} accessibilityRole="button" accessibilityLabel={`${m.label}: ${left} ${over ? m.overLabel : m.leftLabel}`}>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        {/* antennas */}
        <Animated.View style={{ height: 38, alignItems: 'center', transform: [{ rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) }] }}>
          <Svg width={120} height={38}>
            <Line x1={60} y1={38} x2={28} y2={8} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
            <Line x1={60} y1={38} x2={92} y2={8} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
            <Circle cx={28} cy={8} r={4.5} fill={colors.primary} stroke={colors.ink} strokeWidth={2} />
            <Circle cx={92} cy={8} r={4.5} fill={colors.primary} stroke={colors.ink} strokeWidth={2} />
            <Path d={star(108, 14, 6)} fill={colors.ink} opacity={0.85} />
            <Path d={star(10, 22, 4)} fill={colors.ink} opacity={0.6} />
          </Svg>
        </Animated.View>
        {/* the TV body */}
        <HardShadow offset={SHADOW_OFFSET} color={colors.shadowInk} radius={30}>
          <View style={[styles.body, { backgroundColor: colors.primarySoft, borderColor: colors.ink }]}>
            <View style={{ padding: PAD }} onLayout={(e) => setCw(e.nativeEvent.layout.width)}>
              {cw > 0 && (
                <Svg width={cw} height={H + 2 * PAD} style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Rect x={RING / 2} y={RING / 2} width={rw} height={rh} rx={rr} ry={rr} fill="none" stroke={colors.line} strokeWidth={RING} />
                  <Rect x={RING / 2} y={RING / 2} width={rw} height={rh} rx={rr} ry={rr} fill="none" stroke={kc.value > kc.goal ? colors.danger : colors.primary} strokeWidth={RING} strokeLinecap="round" strokeDasharray={`${perim * ringP} ${perim}`} />
                </Svg>
              )}
              <View onLayout={onLayout} style={[styles.screen, { borderColor: colors.ink, backgroundColor: colors.card }]}>
                {w > 0 && (
                  <Animated.View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H + 40, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [H - 6, 14] }) }] }}
                  >
                    <Animated.View style={{ width: WAVE_W * 3, height: 60, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-WAVE_W, 0] }) }] }}>
                      <Svg width={WAVE_W * 3} height={60}>
                        {[0, 1, 2].map((k) => (
                          <Path key={k} d={wavePath} fill={fillColor} transform={`translate(${k * WAVE_W} 0)`} />
                        ))}
                      </Svg>
                    </Animated.View>
                    <View style={{ flex: 1, backgroundColor: fillColor, marginTop: -2 }} />
                  </Animated.View>
                )}
                {/* scanlines, like an old tube */}
                {w > 0 && (
                  <Svg width={w} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
                    {Array.from({ length: Math.floor(H / 5) }, (_, k) => (
                      <Line key={k} x1={0} y1={k * 5 + 2} x2={w} y2={k * 5 + 2} stroke="#000" strokeWidth={1} opacity={0.06} />
                    ))}
                  </Svg>
                )}
                <View style={styles.center} pointerEvents="none">
                  <Text style={[styles.label, { color: colors.ink }]}>{m.label}</Text>
                  <CountUp value={left} style={{ fontSize: 48, fontWeight: '900', color: colors.ink }} />
                  <Text style={[styles.label, { color: colors.inkSoft }]}>{m.unit} {over ? m.overLabel : m.leftLabel}</Text>
                </View>
              </View>
            </View>
            {/* knobs and speaker */}
            <View style={styles.controls}>
              <View style={styles.knobs}>
                {[0, 1].map((k) => (
                  <View key={k} style={[styles.knob, { borderColor: colors.ink, backgroundColor: colors.card }]}>
                    <View style={[styles.notch, { backgroundColor: colors.ink, transform: [{ rotate: `${(i + k) % 2 ? 50 : -35}deg` }] }]} />
                  </View>
                ))}
              </View>
              <View style={styles.dots}>
                {metrics.map((x, k) => (
                  <View key={x.key} style={[styles.dot, { backgroundColor: k === i % metrics.length ? colors.ink : colors.line }]} />
                ))}
              </View>
              <View style={{ gap: 3 }}>
                {[0, 1, 2].map((k) => (
                  <View key={k} style={{ width: 26, height: 2.5, borderRadius: 2, backgroundColor: colors.ink, opacity: 0.55 }} />
                ))}
              </View>
            </View>
          </View>
        </HardShadow>
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (_colors: Colors) => StyleSheet.create({
  body: { borderRadius: 30, borderWidth: 3, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6 },
  screen: { height: H, borderRadius: 20, borderWidth: 2, overflow: 'hidden', width: '100%' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6 },
  knobs: { flexDirection: 'row', gap: 10 },
  knob: { width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  notch: { width: 2.5, height: 12, borderRadius: 2 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
});
