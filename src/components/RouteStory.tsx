import React from 'react';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Fix } from '../lib/gps';
import { projectRoute } from '../lib/routeCard';
import { useColors } from '../theme';

export type StoryProps = {
  route: Fix[];
  kind: string; // "RUN"
  date: string; // "14 Nov"
  km: string; // "6.09"
  distanceLabel: string; // "DISTANCE · KM"
  paceLabel: string;
  pace: string;
  timeLabel: string;
  time: string;
  footer: string; // "MOVED WITH KABE"
  width?: number; // on-screen width; the picture itself is always 360 x 640 units (9:16)
};

export const STORY_W = 360;
export const STORY_H = 640;

const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';

/**
 * The shareable route card, drawn as one 9:16 picture in the colours of the chosen theme. The same drawing is shown in the app
 * and turned into the PNG that is shared (ask the Svg ref for toDataURL).
 */
export const RouteStory = React.forwardRef<Svg, StoryProps>(function RouteStory(p, ref) {
  const c = useColors();
  const w = p.width ?? STORY_W;
  const proj = projectRoute(p.route, 300, 240, 32);
  const dots: { x: number; y: number }[] = [];
  for (let x = 20; x < STORY_W; x += 40) for (let y = 20; y < STORY_H; y += 40) dots.push({ x, y });
  const kmSize = p.km.length > 5 ? 84 : 104;
  const pillW = 26 + p.kind.length * 11;
  const chip = (x: number, label: string, value: string) => (
    <G key={label}>
      <Rect x={x + 6} y={551} width={146} height={64} rx={16} fill={c.ink} />
      <Rect x={x} y={545} width={146} height={64} rx={16} fill={c.card} stroke={c.ink} strokeWidth={3} />
      <SvgText x={x + 16} y={567} fontSize={11} fontWeight="700" letterSpacing={2} fill={c.inkSoft} fontFamily={FONT}>{label}</SvgText>
      <SvgText x={x + 16} y={597} fontSize={25} fontWeight="900" fill={c.ink} fontFamily={FONT}>{value}</SvgText>
    </G>
  );
  return (
    <Svg ref={ref} width={w} height={(w * STORY_H) / STORY_W} viewBox={`0 0 ${STORY_W} ${STORY_H}`}>
      <Rect x={0} y={0} width={STORY_W} height={STORY_H} fill={c.bg} />
      {dots.map((d) => <Circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={2} fill={c.ink} opacity={0.1} />)}

      <SvgText x={30} y={58} fontSize={20} fontWeight="900" letterSpacing={5} fill={c.ink} fontFamily={FONT}>KABE</SvgText>
      <SvgText x={330} y={56} fontSize={13} fontWeight="700" textAnchor="end" fill={c.inkSoft} fontFamily={FONT}>{p.date}</SvgText>

      <Rect x={36} y={98} width={pillW} height={30} rx={15} fill={c.ink} />
      <Rect x={30} y={92} width={pillW} height={30} rx={15} fill={c.accent} stroke={c.ink} strokeWidth={3} />
      <SvgText x={30 + pillW / 2} y={112} fontSize={13} fontWeight="900" letterSpacing={2} textAnchor="middle" fill={c.ink} fontFamily={FONT}>{p.kind}</SvgText>

      <SvgText x={28} y={220} fontSize={kmSize} fontWeight="900" letterSpacing={-3} fill={c.ink} fontFamily={FONT}>{p.km}</SvgText>
      <SvgText x={32} y={250} fontSize={13} fontWeight="800" letterSpacing={4} fill={c.inkSoft} fontFamily={FONT}>{p.distanceLabel}</SvgText>

      <Rect x={36} y={283} width={300} height={240} rx={24} fill={c.ink} />
      <Rect x={30} y={277} width={300} height={240} rx={24} fill={c.card} stroke={c.ink} strokeWidth={3} />
      {proj ? (
        <G x={30} y={277}>
          <Path d={proj.path} stroke={c.ink} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d={proj.path} stroke={c.accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Circle cx={proj.start.x} cy={proj.start.y} r={8} fill={c.card} stroke={c.ink} strokeWidth={3.5} />
          <Circle cx={proj.end.x} cy={proj.end.y} r={9} fill={c.ink} stroke={c.card} strokeWidth={3} />
        </G>
      ) : null}

      {chip(30, p.paceLabel.toUpperCase(), p.pace)}
      {chip(184, p.timeLabel.toUpperCase(), p.time)}

      <SvgText x={180} y={634} fontSize={11} fontWeight="700" letterSpacing={3} textAnchor="middle" fill={c.inkSoft} fontFamily={FONT}>{p.footer}</SvgText>
    </Svg>
  );
});
