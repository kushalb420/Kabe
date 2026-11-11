import React from 'react';
import { TextStyle, View } from 'react-native';
import { Text } from './Text';

/**
 * Big text with a transparent-looking fill and a solid outline (the "stroked keyword" in the design).
 * React Native has no text stroke, so the outline is eight black copies pushed outward, with the fill colour on top.
 */
export function OutlineText({ children, style, fill, stroke = '#000000', width = 2 }: { children: string; style: TextStyle; fill: string; stroke?: string; width?: number }) {
  const d = width;
  const offsets: [number, number][] = [[-d, 0], [d, 0], [0, -d], [0, d], [-d, -d], [d, -d], [-d, d], [d, d]];
  return (
    <View accessible accessibilityLabel={children}>
      {/* the eight outline copies are decoration: screen readers skip them and read the text once */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
        {offsets.map(([x, y], i) => (
          <Text key={i} style={[style, { color: stroke, position: 'absolute', left: x, right: -x, top: y }]}>
            {children}
          </Text>
        ))}
      </View>
      <Text style={[style, { color: fill }]}>{children}</Text>
    </View>
  );
}
