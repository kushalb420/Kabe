import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import { DOTS } from '../config/app';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

/**
 * The dot grid behind the pages (size and strength from DOTS in src/config/app.ts).
 * Every copy needs its own pattern id: on the web, screens stacked on top of each other share one document, and a
 * shared id would point at the (hidden) pattern of the screen underneath, so the dots vanished on every screen opened over Today.
 */
export function Dots() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!DOTS.enabled) return null;
  const id = `kabe-dots-${uid}`;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id={id} width={DOTS.size} height={DOTS.size} patternUnits="userSpaceOnUse">
          <Circle cx={DOTS.size / 2} cy={DOTS.size / 2} r={DOTS.radius} fill={DOTS.color} fillOpacity={DOTS.opacity} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
