import { useIsFocused } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { MOTION } from '../config/app';
import { SHADOW_OFFSET, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { isDarkColors } from '../palette';
import type { HeroMetric } from './HeroTank';
import { HardShadow } from './HardShadow';
import { CountUp } from './Motion';
import { Pressable } from './Pressable';
import { OnSurface } from './Surface';
import { Text } from './Text';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const spark = (x: number, y: number, r: number) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;
const BUBBLES = [
  { x: 0.3, size: 7, delay: 0, ms: 4200 },
  { x: 0.5, size: 10, delay: 1100, ms: 5200 },
  { x: 0.68, size: 6, delay: 2200, ms: 3800 },
];

/**
 * Today's hero as a glass orb: a round vessel of water that fills as you eat, with a rolling surface and rising bubbles. Tap it,
 * or a name underneath, to switch between calories and the macros; past a limit the water turns a warning colour.
 *
 * Every movement here runs on the phone's own animation thread (only sliding and fading, nothing re-drawn each frame, no motion
 * sensor), and it only moves while Today is in front, so it stays smooth.
 */
export function HeroOrb({ metrics }: { metrics: HeroMetric[] }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dark = isDarkColors(colors);
  const [i, setI] = useState(0);
  const [width, setWidth] = useState(0);
  const m = metrics[i % metrics.length];
  const p = m.goal > 0 ? clamp(m.value / m.goal, 0, 1) : 0;
  const over = m.value > m.goal;
  const left = Math.round(Math.abs(m.goal - m.value));
  const S = Math.round(clamp(width - 24, 200, 260)); // the orb's width
  const INNER = S - 8; // inside the ring
  const WAVE = Math.round(S * 0.9);
  const fill = over && m.key !== 'protein' ? colors.waterOver : colors.water;

  const [rise] = useState(() => new Animated.Value(0));
  const [drift] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  const bubbles = useMemo(() => BUBBLES.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    const a = MOTION.enabled ? Animated.spring(rise, { toValue: p, friction: 8, tension: 36, useNativeDriver: true }) : Animated.timing(rise, { toValue: p, duration: 0, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [p, rise]);

  const focused = useIsFocused(); // the tabs all stay mounted: only animate while this screen is the one in front
  useEffect(() => {
    if (!MOTION.enabled || !focused) return;
    const loops = [
      Animated.loop(Animated.timing(drift, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })])),
      ...bubbles.map((b, k) => Animated.loop(Animated.sequence([Animated.timing(b, { toValue: 1, delay: BUBBLES[k].delay, duration: BUBBLES[k].ms, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(b, { toValue: 0, duration: 0, useNativeDriver: true })]))),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [drift, bob, bubbles, focused]);

  const flipTo = (n: number) => {
    setI(n % metrics.length);
    if (MOTION.enabled) Animated.sequence([Animated.timing(pop, { toValue: 0.97, duration: 90, useNativeDriver: true }), Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true })]).start();
  };
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const wave = (amp: number) => `M0 ${amp + 4} Q${WAVE / 8} 4 ${WAVE / 4} ${amp + 4} T${WAVE / 2} ${amp + 4} T${(WAVE * 3) / 4} ${amp + 4} T${WAVE} ${amp + 4} V32 H0 Z`;
  const waves = (amp: number) => (
    <Svg width={WAVE * 3} height={32}>
      {[0, 1, 2].map((k) => (
        <Path key={k} d={wave(amp)} fill={fill} transform={`translate(${k * WAVE} 0)`} />
      ))}
    </Svg>
  );
  const border = dark ? colors.inkOnBg : colors.ink;
  const C = S / 2;

  return (
    <View onLayout={onLayout} style={{ alignSelf: 'stretch', alignItems: 'center', gap: 14 }}>
      {width > 0 && (
        <View style={{ height: S + SHADOW_OFFSET + 14, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ scale: pop }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-3, 3] }) }] }}>
            <View pointerEvents="none" style={{ position: 'absolute', top: -2, right: -4 }}>
              <Svg width={22} height={22}><Path d={spark(11, 11, 9)} fill={colors.inkOnBg} /></Svg>
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: -6 }}>
              <Svg width={16} height={16}><Path d={spark(8, 8, 6)} fill={colors.primaryOnBg} /></Svg>
            </View>

            <Pressable onPress={() => flipTo(i + 1)} accessibilityRole="button" accessibilityLabel={`${m.label}: ${left} ${over ? m.overLabel : m.leftLabel}`}>
              <HardShadow offset={SHADOW_OFFSET} color={colors.shadowInk} radius={S / 2}>
                <View style={{ width: S, height: S }}>
                  {/* the glass: a round window that the water slides inside */}
                  <View style={{ position: 'absolute', left: 4, top: 4, width: INNER, height: INNER, borderRadius: INNER / 2, overflow: 'hidden', backgroundColor: colors.card }}>
                    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: INNER, height: INNER + 40, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [INNER + 2, 0] }) }] }}>
                      {/* the back wave runs the other way on the same clock */}
                      <Animated.View style={{ position: 'absolute', left: 0, top: -7, width: WAVE * 3, opacity: 0.45, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-WAVE, -WAVE * 2] }) }] }}>
                        {waves(11)}
                      </Animated.View>
                      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: WAVE * 3, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-WAVE, 0] }) }] }}>
                        {waves(9)}
                      </Animated.View>
                      <View style={{ position: 'absolute', left: 0, right: 0, top: 30, bottom: 0, backgroundColor: fill }} />
                      {BUBBLES.map((b, k) => (
                        <Animated.View
                          key={k}
                          style={{ position: 'absolute', left: b.x * INNER, top: INNER * 0.8, width: b.size, height: b.size, borderRadius: b.size, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)', backgroundColor: 'rgba(255,255,255,0.45)', opacity: bubbles[k].interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }), transform: [{ translateY: bubbles[k].interpolate({ inputRange: [0, 1], outputRange: [0, -INNER * 0.66] }) }] }}
                        />
                      ))}
                    </Animated.View>
                  </View>

                  {/* the highlight and the ring, drawn once on top */}
                  <Svg width={S} height={S} style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Circle cx={C} cy={C} r={C - 9} fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={1.5} />
                    <Path d={`M ${S * 0.2} ${S * 0.38} A ${S * 0.34} ${S * 0.34} 0 0 1 ${S * 0.42} ${S * 0.13}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={6} strokeLinecap="round" />
                    <Circle cx={C} cy={C} r={C - 3} fill="none" stroke={border} strokeWidth={5} />
                  </Svg>

                  <OnSurface>
                    <View style={styles.center} pointerEvents="none">
                      <Text style={[styles.label, { color: colors.ink }]}>{m.label}</Text>
                      <CountUp value={left} style={{ fontSize: Math.round(S * 0.22), fontWeight: '900', color: colors.ink }} />
                      <Text style={[styles.label, { color: colors.inkSoft }]}>{m.unit} {over ? m.overLabel : m.leftLabel}</Text>
                    </View>
                  </OnSurface>
                </View>
              </HardShadow>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* the names underneath: tap one to jump to it */}
      <View style={styles.names}>
        {metrics.map((x, k) => (
          <Pressable key={x.key} onPress={() => flipTo(k)} accessibilityRole="button" accessibilityState={{ selected: k === i % metrics.length }} hitSlop={6}>
            <Text style={[styles.name, { color: k === i % metrics.length ? colors.inkOnBg : colors.inkSoftOnBg, borderBottomColor: k === i % metrics.length ? colors.primaryOnBg : 'transparent' }]}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (_colors: Colors) => StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  names: { flexDirection: 'row', gap: 18, flexWrap: 'wrap', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '700', paddingBottom: 3, borderBottomWidth: 2, borderRadius: radius.sm },
});
