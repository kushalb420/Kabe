import React, { useId } from 'react';
import Svg, { Circle, Defs, G, Image as SvgImage, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { GLYPHS } from '../lib/glyphData';
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

type Anchor = 'start' | 'middle' | 'end';

/**
 * Text drawn as shapes (the letters of the app's own fonts), so the saved picture looks exactly like the card on screen. The phone's
 * picture maker cannot use fonts the app loads while running, and swapped them for another font. Characters that are not in the
 * built-in set (for example Hindi) fall back to ordinary text.
 */
function Glyphs({ x, y, size, text, font, fill, anchor = 'start', spacing = 0 }: { x: number; y: number; size: number; text: string; font: 'value' | 'label' | 'brand'; fill: string; anchor?: Anchor; spacing?: number }) {
  const f = GLYPHS[font];
  const chars = Array.from(text);
  if (chars.some((c) => !f.glyphs[c])) {
    return (
      <SvgText x={x} y={y} fontSize={size} fontWeight="700" letterSpacing={spacing} textAnchor={anchor} fill={fill} fontFamily={FONT}>{text}</SvgText>
    );
  }
  const k = size / f.upm;
  let width = 0;
  const placed = chars.map((c) => {
    const g = f.glyphs[c];
    const at = width;
    width += g.adv * k + spacing;
    return { c, g, at };
  });
  width -= spacing; // no space after the last letter
  const start = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  return (
    <G transform={`translate(${start} ${y})`}>
      {placed.map((q, i) => (q.g.d ? <Path key={i} transform={`translate(${q.at} 0) scale(${k} ${-k})`} d={q.g.d} fill={fill} /> : null))}
    </G>
  );
}

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
      <Glyphs x={STORY_W / 2} y={y} size={14} anchor="middle" fill={look.soft} font="label" text={name} />
      <Glyphs x={STORY_W / 2} y={y + 36} size={32} anchor="middle" fill={look.ink} font="value" text={value} />
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
      <SvgText x={M} y={84} fontSize={16} fontWeight="900" letterSpacing={5} fill={look.ink} fontFamily={FONT}>KABE</SvgText>
      <SvgText x={STORY_W - M} y={84} fontSize={16} fontWeight="700" letterSpacing={1} textAnchor="end" fill={look.soft} fontFamily={FONT}>{`${p.kind} · ${p.date}`}</SvgText>

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
