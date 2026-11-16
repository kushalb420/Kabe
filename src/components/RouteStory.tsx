import React, { useId } from 'react';
import Svg, { Circle, Defs, Image as SvgImage, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { projectRoute, type Route } from '../lib/routeCard';
import { useColors } from '../theme';

/** What is behind the route: the colours of the chosen theme, plain black, plain off-white, or the person's own photo. */
export type StoryBg = 'theme' | 'black' | 'cream' | 'photo';

export type StoryProps = {
  route: Route;
  kind: string; // "RUN"
  date: string; // "14 Nov"
  km: string; // "6.09"
  distanceLabel: string; // "DISTANCE · KM"
  paceLabel: string;
  pace: string;
  timeLabel: string;
  time: string;
  footer: string; // "MOVED WITH KABE"
  emptyText?: string; // shown when there is no route to draw
  width?: number; // on-screen width; the picture itself is always 360 x 640 units (9:16)
  bg?: StoryBg;
  photo?: string | null; // the person's picture as a data address (used when bg is 'photo')
};

export const STORY_W = 360;
export const STORY_H = 640;

const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const M = 55;
const LABEL_FONT = 'DMSans_500Medium, DM Sans, Helvetica Neue, Arial, sans-serif'; // the app's own fonts
const VALUE_FONT = 'SpaceGrotesk_700Bold, Space Grotesk, Helvetica Neue, Arial, sans-serif'; // the margin on both sides

/**
 * The shareable route card, drawn as one 9:16 picture. Like a running-app stats card: the route drawn big and clean, the numbers
 * stacked underneath, lots of room around everything. The same drawing is shown in the app and turned into the PNG that is shared.
 */
export const RouteStory = React.forwardRef<Svg, StoryProps>(function RouteStory(p, ref) {
  const c = useColors();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const w = p.width ?? STORY_W;
  const photo = p.bg === 'photo' && p.photo ? p.photo : null;
  const mode: StoryBg = p.bg === 'photo' && !photo ? 'theme' : p.bg ?? 'theme';
  const look =
    mode === 'black' || mode === 'photo'
      ? { bg: '#0E0E0E', ink: '#FFFFFF', soft: 'rgba(255,255,255,0.68)', dot: '#FFFFFF', dotOp: mode === 'photo' ? 0 : 0.09, casing: 'rgba(0,0,0,0.55)' }
      : mode === 'cream'
        ? { bg: '#F4F0E6', ink: '#1B1B1B', soft: '#6F6A5E', dot: '#1B1B1B', dotOp: 0.09, casing: 'rgba(27,27,27,0.14)' }
        : { bg: c.bg, ink: c.ink, soft: c.inkSoft, dot: c.ink, dotOp: 0.1, casing: 'rgba(0,0,0,0.14)' };
  const ROUTE_Y = 92;
  const proj = projectRoute(p.route, STORY_W - 2 * M, 250, 20);
  const dots: { x: number; y: number }[] = [];
  if (look.dotOp > 0) for (let x = 20; x < STORY_W; x += 40) for (let y = 20; y < STORY_H; y += 40) dots.push({ x, y });
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
  const [distName, distUnit = 'km'] = p.distanceLabel.split(' · ');
  // each number is centred under its small name, in the app's own fonts
  const stat = (y: number, name: string, value: string) => (
    <>
      <SvgText x={STORY_W / 2} y={y} fontSize={14} textAnchor="middle" fill={look.soft} fontFamily={LABEL_FONT}>{name}</SvgText>
      <SvgText x={STORY_W / 2} y={y + 36} fontSize={32} textAnchor="middle" fill={look.ink} fontFamily={VALUE_FONT}>{value}</SvgText>
    </>
  );
  return (
    <Svg ref={ref} width={w} height={(w * STORY_H) / STORY_W} viewBox={`0 0 ${STORY_W} ${STORY_H}`}>
      <Defs>
        <LinearGradient id={`shade-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity={0.45} />
          <Stop offset="0.45" stopColor="#000000" stopOpacity={0.25} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.72} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={STORY_W} height={STORY_H} fill={look.bg} />
      {photo && <SvgImage x={0} y={0} width={STORY_W} height={STORY_H} href={{ uri: photo }} preserveAspectRatio="xMidYMid slice" />}
      {photo && <Rect x={0} y={0} width={STORY_W} height={STORY_H} fill={`url(#shade-${uid})`} />}
      {dots.map((d) => <Circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={2} fill={look.dot} opacity={look.dotOp} />)}

      {/* top: the name on the left, the day on the right */}
      <SvgText x={M} y={72} fontSize={19} fontWeight="900" letterSpacing={5} fill={look.ink} fontFamily={FONT}>KABE</SvgText>
      <SvgText x={STORY_W - M} y={72} fontSize={12} fontWeight="700" letterSpacing={1} textAnchor="end" fill={look.soft} fontFamily={FONT}>{`${p.kind} · ${p.date}`}</SvgText>

      {/* the route, big and bare */}
      {proj ? (
        <>
          <Path transform={`translate(${M} ${ROUTE_Y})`} d={proj.path} stroke={look.casing} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path transform={`translate(${M} ${ROUTE_Y})`} d={proj.path} stroke={c.accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Circle cx={M + proj.start.x} cy={ROUTE_Y + proj.start.y} r={7} fill={look.bg === '#0E0E0E' ? '#FFFFFF' : look.bg} stroke={look.ink} strokeWidth={3} />
          <Circle cx={M + proj.end.x} cy={ROUTE_Y + proj.end.y} r={8} fill={look.ink} stroke={look.bg === '#0E0E0E' ? '#0E0E0E' : look.bg} strokeWidth={3} />
        </>
      ) : p.emptyText ? (
        <SvgText x={STORY_W / 2} y={215} fontSize={13} fontWeight="700" textAnchor="middle" fill={look.soft} fontFamily={FONT}>{p.emptyText}</SvgText>
      ) : null}

      {/* the numbers, stacked and centred */}
      {stat(364, cap(distName), `${p.km} ${distUnit.toLowerCase()}`)}
      {stat(424, p.paceLabel, p.pace)}
      {stat(484, p.timeLabel, p.time)}

      <SvgText x={STORY_W / 2} y={618} fontSize={9} fontWeight="700" letterSpacing={3} textAnchor="middle" fill={look.soft} fontFamily={FONT}>{p.footer}</SvgText>
    </Svg>
  );
});
