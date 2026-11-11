import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useColors } from '../theme';

export type Point = { x: number; y: number };

/** Minimal two-series line chart: raw dots + smoothed trend line. x is a day index. */
export function LineChart({
  raw,
  trend,
  width,
  height = 150,
  unit = 'kg',
}: {
  raw: Point[];
  trend: Point[];
  width: number;
  height?: number;
  unit?: string;
}) {
  const colors = useColors();
  if (!raw.length) return null;
  const pad = 8;
  const xs = raw.map((p) => p.x);
  const ys = [...raw, ...trend].map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);
  const span = Math.max(rawMax - rawMin, 1); // at least 1 unit tall so tiny changes don't look dramatic
  const minY = rawMin - (span - (rawMax - rawMin)) / 2;
  const sx = (x: number) => (maxX === minX ? width / 2 : pad + ((x - minX) / (maxX - minX)) * (width - pad * 2));
  const sy = (y: number) => height - pad - ((y - minY) / span) * (height - pad * 2);
  const pts = (list: Point[]) => list.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke={colors.line} strokeWidth={1} />
        {trend.length > 1 && <Polyline points={pts(trend)} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinejoin="round" />}
        {raw.map((p, i) => (
          <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={colors.accent} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, color: colors.inkSoft }}>
          low {Math.round(rawMin * 10) / 10} {unit}
        </Text>
        <Text style={{ fontSize: 11, color: colors.inkSoft }}>
          high {Math.round(rawMax * 10) / 10} {unit}
        </Text>
      </View>
    </View>
  );
}
