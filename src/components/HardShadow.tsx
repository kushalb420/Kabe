import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

/** Style keys that belong to the outside of a boxed element (where it sits), not to its inside. */
const OUTER_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'top', 'left', 'right', 'bottom', 'zIndex'];

export function splitStyle(style: ViewStyle | undefined): { outer: ViewStyle; inner: ViewStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) (OUTER_KEYS.includes(k) ? outer : inner)[k] = v;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

/**
 * The neo-brutalist "hard shadow": a solid, blur-free copy of the box shifted down and right.
 * It is a real view behind the box (not a CSS shadow), so it looks the same on iOS and Android.
 * `pressed` pushes the box into its shadow, like a physical button.
 */
export function HardShadow({
  offset = 4,
  color,
  radius,
  pressed,
  outerStyle,
  children,
}: {
  offset?: number;
  color: string;
  radius: number;
  pressed?: boolean;
  outerStyle?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <View style={[outerStyle, { marginRight: offset, marginBottom: offset }]}>
      {!pressed && <View pointerEvents="none" style={{ position: 'absolute', top: offset, left: offset, right: -offset, bottom: -offset, backgroundColor: color, borderRadius: radius }} />}
      <View style={{ flexGrow: 1, transform: pressed ? [{ translateX: offset }, { translateY: offset }] : [] }}>{children}</View>
    </View>
  );
}
