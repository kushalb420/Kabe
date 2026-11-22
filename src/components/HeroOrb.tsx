import React, { useEffect, useId, useMemo, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { MOTION } from '../config/app';
import { SHADOW_OFFSET, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { isDarkColors } from '../palette';
import type { HeroMetric } from './HeroTank';
import { HardShadow } from './HardShadow';
import { CountUp } from './Motion';
import { Pressable } from './Pressable';
import { OnSurface } from './Surface';
import { Text } from './Text';

const AnimatedG = Animated.createAnimatedComponent(G);
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const spark = (x: number, y: number, r: number) => `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`;

/** What the finger and the phone's sensor are each asking for, so one value drives the tilt of the water. */
class Gesture {
  dragged = false;
  touch = 0;
  sensor = 0;
  markDragged() {
    this.dragged = true;
  }
  takeDragged() {
    const d = this.dragged;
    this.dragged = false;
    return d;
  }
  setTouch(v: number) {
    this.touch = v;
  }
  setSensor(v: number) {
    this.sensor = v;
  }
  total() {
    return clamp(this.touch + this.sensor, -36, 36);
  }
}
const BUBBLES = [
  { x: 0.28, size: 3.5, delay: 0, ms: 4200 },
  { x: 0.46, size: 5, delay: 900, ms: 5200 },
  { x: 0.62, size: 3, delay: 1800, ms: 3800 },
  { x: 0.74, size: 4.5, delay: 600, ms: 4800 },
  { x: 0.38, size: 2.5, delay: 2600, ms: 3500 },
];

/**
 * Today's hero as a glass orb: a round vessel of water that fills as you eat. Tilt the phone and the water follows it (or drag a
 * finger across the orb); tap it, or tap a name underneath, to switch between calories and the macros. Bubbles rise, the surface
 * rolls, and past a limit the water turns a warning colour. The water is one drawing (not stacked views), so it cannot upset the
 * layout around it.
 */
export function HeroOrb({ metrics }: { metrics: HeroMetric[] }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dark = isDarkColors(colors);
  const clipId = `orb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [i, setI] = useState(0);
  const [width, setWidth] = useState(0);
  const m = metrics[i % metrics.length];
  const p = m.goal > 0 ? clamp(m.value / m.goal, 0, 1) : 0;
  const over = m.value > m.goal;
  const left = Math.round(Math.abs(m.goal - m.value));
  const S = Math.round(Math.min(Math.max(width - 24, 200), 260)); // the orb's width
  const WAVE = Math.round(S * 0.9);
  const fill = over && m.key !== 'protein' ? colors.waterOver : colors.water;
  const C = S / 2;

  const [gesture] = useState(() => new Gesture()); // a drag across the orb is not a tap
  const [rise] = useState(() => new Animated.Value(0));
  const [drift] = useState(() => new Animated.Value(0));
  const [drift2] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  const [twinkle] = useState(() => new Animated.Value(0));
  const [tilt] = useState(() => new Animated.Value(0)); // one value: the water's lean in degrees
  const bubbles = useMemo(() => BUBBLES.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    const a = MOTION.enabled ? Animated.spring(rise, { toValue: p, friction: 8, tension: 36, useNativeDriver: false }) : Animated.timing(rise, { toValue: p, duration: 0, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [p, rise]);

  useEffect(() => {
    if (!MOTION.enabled) return;
    const loops = [
      Animated.loop(Animated.timing(drift, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: false })),
      Animated.loop(Animated.timing(drift2, { toValue: 1, duration: 6400, easing: Easing.linear, useNativeDriver: false })),
      Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(twinkle, { toValue: 1, duration: 1600, useNativeDriver: true }), Animated.timing(twinkle, { toValue: 0, duration: 1600, useNativeDriver: true })])),
      ...bubbles.map((b, k) => Animated.loop(Animated.sequence([Animated.timing(b, { toValue: 1, delay: BUBBLES[k].delay, duration: BUBBLES[k].ms, easing: Easing.out(Easing.quad), useNativeDriver: false }), Animated.timing(b, { toValue: 0, duration: 0, useNativeDriver: false })]))),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [drift, drift2, bob, twinkle, bubbles]);

  // the phone's tilt (a phone only): the water leans the way the phone does and settles back
  useEffect(() => {
    if (Platform.OS === 'web' || !MOTION.enabled) return;
    let alive = true;
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const { Accelerometer } = await import('expo-sensors');
        if (!alive || !(await Accelerometer.isAvailableAsync())) return;
        Accelerometer.setUpdateInterval(70);
        let smooth = 0;
        sub = Accelerometer.addListener(({ x }) => {
          smooth = smooth * 0.82 + clamp(x, -1, 1) * 45 * 0.18;
          gesture.setSensor(clamp(smooth, -32, 32));
          if (!gesture.dragged && gesture.touch === 0) tilt.setValue(gesture.total());
        });
      } catch {
        /* no motion sensor: dragging still works */
      }
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [tilt, gesture]);

  // a finger dragged across the orb tilts the water too (this is how it works in a browser)
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_e, g) => {
          gesture.markDragged();
          gesture.setTouch(clamp(g.dx / 4, -32, 32));
          tilt.setValue(gesture.total());
        },
        onPanResponderRelease: () => {
          gesture.setTouch(0);
          Animated.spring(tilt, { toValue: gesture.total(), friction: 3, tension: 60, useNativeDriver: false }).start();
        },
        onPanResponderTerminate: () => {
          gesture.setTouch(0);
          Animated.spring(tilt, { toValue: gesture.total(), friction: 3, tension: 60, useNativeDriver: false }).start();
        },
      }),
    [tilt, gesture],
  );

  const flipTo = (n: number) => {
    setI(n % metrics.length);
    if (MOTION.enabled) Animated.sequence([Animated.timing(pop, { toValue: 0.97, duration: 90, useNativeDriver: true }), Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true })]).start();
  };
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const wave = (amp: number) => `M0 ${amp + 4} Q${WAVE / 8} 4 ${WAVE / 4} ${amp + 4} T${WAVE / 2} ${amp + 4} T${(WAVE * 3) / 4} ${amp + 4} T${WAVE} ${amp + 4} V46 H0 Z`;
  const border = dark ? colors.inkOnBg : colors.ink;
  // where the water's surface sits inside the orb (its top edge is 0, its bottom edge is S)
  const level = rise.interpolate({ inputRange: [0, 1], outputRange: [S + 6, 4] });
  const frontX = drift.interpolate({ inputRange: [0, 1], outputRange: [-WAVE * 2, -WAVE] });
  const backX = drift2.interpolate({ inputRange: [0, 1], outputRange: [-WAVE, -WAVE * 2] });
  const lean = tilt.interpolate({ inputRange: [-45, 45], outputRange: [-45, 45] });

  return (
    <View onLayout={onLayout} style={{ alignSelf: 'stretch', alignItems: 'center', gap: 14 }}>
      {width > 0 && (
        <View style={{ height: S + SHADOW_OFFSET + 14, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          {...pan.panHandlers}
          style={{ transform: [{ scale: pop }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-3, 3] }) }] }}
        >
          {/* sparkles that twinkle around the orb */}
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -2, right: -4, opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }}>
            <Svg width={22} height={22}><Path d={spark(11, 11, 9)} fill={colors.inkOnBg} /></Svg>
          </Animated.View>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: -6, opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }}>
            <Svg width={16} height={16}><Path d={spark(8, 8, 6)} fill={colors.primaryOnBg} /></Svg>
          </Animated.View>

          <Pressable onPress={() => { if (gesture.takeDragged()) return; flipTo(i + 1); }} accessibilityRole="button" accessibilityLabel={`${m.label}: ${left} ${over ? m.overLabel : m.leftLabel}`}>
            <HardShadow offset={SHADOW_OFFSET} color={colors.shadowInk} radius={S / 2}>
              <View style={{ width: S, height: S }}>
                {/* the whole orb is one drawing: glass, water, bubbles and ring */}
                <Svg width={S} height={S}>
                  <Defs>
                    <ClipPath id={clipId}>
                      <Circle cx={C} cy={C} r={C - 3} />
                    </ClipPath>
                  </Defs>
                  <Circle cx={C} cy={C} r={C - 2} fill={colors.card} />
                  <G clipPath={`url(#${clipId})`}>
                    <AnimatedG rotation={lean} origin={`${C}, ${C}`}>
                      <AnimatedG translateY={level}>
                        <AnimatedG translateX={backX} opacity={0.45}>
                          {[0, 1, 2, 3].map((k) => <Path key={k} d={wave(11)} fill={fill} transform={`translate(${k * WAVE} -8)`} />)}
                        </AnimatedG>
                        <AnimatedG translateX={frontX}>
                          {[0, 1, 2, 3].map((k) => <Path key={k} d={wave(9)} fill={fill} transform={`translate(${k * WAVE} 0)`} />)}
                        </AnimatedG>
                        <Rect x={-S} y={40} width={S * 3} height={S * 2} fill={fill} />
                        {BUBBLES.map((b, k) => (
                          <AnimatedG
                            key={k}
                            translateY={bubbles[k].interpolate({ inputRange: [0, 1], outputRange: [S * 0.8, S * 0.12] })}
                            opacity={bubbles[k].interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] })}
                          >
                            <Circle cx={b.x * S} cy={0} r={b.size} fill="rgba(255,255,255,0.45)" stroke="rgba(255,255,255,0.95)" strokeWidth={1.2} />
                          </AnimatedG>
                        ))}
                      </AnimatedG>
                    </AnimatedG>
                  </G>
                  <Circle cx={C} cy={C} r={C - 9} fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={1.5} />
                  <Path d={`M ${S * 0.2} ${S * 0.38} A ${S * 0.34} ${S * 0.34} 0 0 1 ${S * 0.42} ${S * 0.13}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={6} strokeLinecap="round" />
                  <Circle cx={C} cy={C} r={C - 2} fill="none" stroke={border} strokeWidth={4} />
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
