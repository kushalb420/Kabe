import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { MOTION } from '../config/app';
import { SHADOW_OFFSET, radius, useColors } from '../theme';
import { isDarkColors } from '../palette';
import type { HeroMetric } from './HeroTank';
import { HardShadow } from './HardShadow';
import { CountUp } from './Motion';
import { Pressable } from './Pressable';
import { OnSurface } from './Surface';
import { Text } from './Text';

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
  { x: 0.28, size: 7, delay: 0, ms: 4200 },
  { x: 0.46, size: 10, delay: 900, ms: 5200 },
  { x: 0.62, size: 6, delay: 1800, ms: 3800 },
  { x: 0.74, size: 9, delay: 600, ms: 4800 },
  { x: 0.38, size: 5, delay: 2600, ms: 3500 },
];

/**
 * Today's hero as a glass orb: a round vessel of water that fills as you eat. Tilt the phone and the water follows it (or drag a
 * finger across the orb); tap it, or tap a name underneath, to switch between calories and the macros. Bubbles rise, the surface
 * rolls, and past a limit the water turns a warning colour. All motion uses the native driver.
 */
export function HeroOrb({ metrics }: { metrics: HeroMetric[] }) {
  const colors = useColors();
  const dark = isDarkColors(colors);
  const [i, setI] = useState(0);
  const [width, setWidth] = useState(0);
  const m = metrics[i % metrics.length];
  const p = m.goal > 0 ? clamp(m.value / m.goal, 0, 1) : 0;
  const over = m.value > m.goal;
  const left = Math.round(Math.abs(m.goal - m.value));
  const S = Math.round(Math.min(Math.max(width - 24, 200), 276)); // the orb's width
  const WAVE = Math.round(S * 0.9);
  const fill = over && m.key !== 'protein' ? colors.waterOver : colors.water;
  const back = over && m.key !== 'protein' ? colors.waterOver : colors.water;

  const [rise] = useState(() => new Animated.Value(0));
  const [drift] = useState(() => new Animated.Value(0));
  const [drift2] = useState(() => new Animated.Value(0));
  const [gesture] = useState(() => new Gesture()); // a drag across the orb is not a tap
  const [bob] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  const [twinkle] = useState(() => new Animated.Value(0));
  const [tilt] = useState(() => new Animated.Value(0)); // one value: the water's lean in degrees
  const bubbles = useMemo(() => BUBBLES.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    const a = MOTION.enabled ? Animated.spring(rise, { toValue: p, friction: 8, tension: 36, useNativeDriver: true }) : Animated.timing(rise, { toValue: p, duration: 0, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [p, rise]);

  useEffect(() => {
    if (!MOTION.enabled) return;
    const loops = [
      Animated.loop(Animated.timing(drift, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(drift2, { toValue: 1, duration: 6400, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(bob, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })])),
      Animated.loop(Animated.sequence([Animated.timing(twinkle, { toValue: 1, duration: 1600, useNativeDriver: true }), Animated.timing(twinkle, { toValue: 0, duration: 1600, useNativeDriver: true })])),
      ...bubbles.map((b, k) => Animated.loop(Animated.sequence([Animated.timing(b, { toValue: 1, delay: BUBBLES[k].delay, duration: BUBBLES[k].ms, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(b, { toValue: 0, duration: 0, useNativeDriver: true })]))),
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
          Animated.spring(tilt, { toValue: gesture.total(), friction: 3, tension: 60, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          gesture.setTouch(0);
          Animated.spring(tilt, { toValue: gesture.total(), friction: 3, tension: 60, useNativeDriver: true }).start();
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

  return (
    <View onLayout={onLayout} style={{ alignSelf: 'stretch', alignItems: 'center', gap: 14 }}>
      {width > 0 && (
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
              <View style={{ width: S, height: S, borderRadius: S / 2, borderWidth: 4, borderColor: border, backgroundColor: colors.card, overflow: 'hidden' }}>
                {/* the water: a big square, centred on the orb, that leans with the tilt */}
                <Animated.View
                  pointerEvents="none"
                  style={{ position: 'absolute', left: -S / 2 - 4, top: -S / 2 - 4, width: S * 2, height: S * 2, transform: [{ rotate: tilt.interpolate({ inputRange: [-45, 45], outputRange: ['-45deg', '45deg'] }) }] }}
                >
                  <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: S * 2, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [S * 1.5 + 6, S * 0.5 + 2] }) }] }}>
                    {/* the back wave, slower and fainter, for depth */}
                    <Animated.View style={{ position: 'absolute', top: -10, left: S / 2 - WAVE, width: WAVE * 3, opacity: 0.45, transform: [{ translateX: drift2.interpolate({ inputRange: [0, 1], outputRange: [0, -WAVE] }) }] }}>
                      <Svg width={WAVE * 3} height={46}>{[0, 1, 2].map((k) => <Path key={k} d={wave(11)} fill={back} transform={`translate(${k * WAVE} 0)`} />)}</Svg>
                    </Animated.View>
                    <Animated.View style={{ position: 'absolute', top: -2, left: S / 2 - WAVE * 2, width: WAVE * 3, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, WAVE] }) }] }}>
                      <Svg width={WAVE * 3} height={46}>{[0, 1, 2].map((k) => <Path key={k} d={wave(9)} fill={fill} transform={`translate(${k * WAVE} 0)`} />)}</Svg>
                    </Animated.View>
                    <View style={{ position: 'absolute', top: 40, left: 0, right: 0, height: S * 2, backgroundColor: fill }} />
                    {BUBBLES.map((b, k) => (
                      <Animated.View
                        key={k}
                        style={{ position: 'absolute', left: S / 2 + b.x * S, top: S * 0.78, width: b.size, height: b.size, borderRadius: b.size, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.35)', opacity: bubbles[k].interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }), transform: [{ translateY: bubbles[k].interpolate({ inputRange: [0, 1], outputRange: [0, -S * 0.7] }) }] }}
                      />
                    ))}
                  </Animated.View>
                </Animated.View>

                {/* the glass: a soft highlight and a thin inner ring */}
                <Svg width={S - 8} height={S - 8} style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Circle cx={(S - 8) / 2} cy={(S - 8) / 2} r={(S - 8) / 2 - 7} fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={1.5} />
                  <Path d={`M ${S * 0.2} ${S * 0.38} A ${S * 0.34} ${S * 0.34} 0 0 1 ${S * 0.42} ${S * 0.13}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={6} strokeLinecap="round" />
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

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  names: { flexDirection: 'row', gap: 18, flexWrap: 'wrap', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '700', paddingBottom: 3, borderBottomWidth: 2, borderRadius: radius.sm },
});
