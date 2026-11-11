import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, TextStyle, ViewStyle } from 'react-native';
import { MOTION } from '../config/app';
import { Text } from './Text';

/** Inside a screen, each card that appears takes the next place in line, so they slide in one after another. */
const StaggerContext = createContext<{ next: () => number } | null>(null);
export function StaggerProvider({ children }: { children: React.ReactNode }) {
  const counter = useRef(0);
  const [api] = useState(() => ({ next: () => counter.current++ }));
  return <StaggerContext.Provider value={api}>{children}</StaggerContext.Provider>;
}
export function useStaggerIndex(explicit?: number): number {
  const ctx = useContext(StaggerContext);
  const [i] = useState(() => (explicit !== undefined ? explicit : ctx ? ctx.next() : 0));
  return i;
}

/** Slides and fades its children in when they first appear. `index` staggers neighbours (see MOTION in src/config/app.ts). */
export function Enter({ children, index, style }: { children: React.ReactNode; index?: number; style?: ViewStyle }) {
  const place = useStaggerIndex(index);
  const [v] = useState(() => new Animated.Value(MOTION.enabled ? 0 : 1));
  useEffect(() => {
    if (!MOTION.enabled) return;
    const a = Animated.timing(v, { toValue: 1, duration: MOTION.enterMs, delay: Math.min(place, 8) * MOTION.staggerMs, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v, place]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [MOTION.enterRise, 0] }) }] }]}>{children}</Animated.View>
  );
}

/** A number that eases to its new value instead of jumping. */
export function useAnimatedNumber(target: number, ms: number = MOTION.countMs): number {
  const [shown, setShown] = useState(MOTION.enabled ? 0 : target);
  const [v] = useState(() => new Animated.Value(MOTION.enabled ? 0 : target));
  useEffect(() => {
    if (!MOTION.enabled) return;
    const id = v.addListener(({ value }) => setShown(value));
    const a = Animated.timing(v, { toValue: target, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => {
      a.stop();
      v.removeListener(id);
    };
  }, [v, target, ms]);
  return MOTION.enabled ? shown : target;
}

/** Text that counts up to a whole number. */
export function CountUp({ value, style, format }: { value: number; style?: TextStyle | TextStyle[]; format?: (n: number) => string }) {
  const n = useAnimatedNumber(value);
  return <Text style={style}>{format ? format(n) : String(Math.round(n))}</Text>;
}

/** A tappable area that squeezes a little while pressed and springs back (cards, rows, tiles). */
export function PressScale({ children, onPress, style, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; style?: ViewStyle; accessibilityLabel?: string }) {
  const [s] = useState(() => new Animated.Value(1));
  const to = (v: number) => {
    if (MOTION.enabled) Animated.spring(s, { toValue: v, friction: 6, tension: 220, useNativeDriver: true }).start();
  };
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.97)} onPressOut={() => to(1)} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={style}>
      <Animated.View style={{ transform: [{ scale: s }], flexGrow: 1 }}>{children}</Animated.View>
    </Pressable>
  );
}
