import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from './Text';
import Svg, { Circle } from 'react-native-svg';
import { BORDER, SHADOW_OFFSET, radius, useColors, useThemedStyles, type Colors } from '../theme';
import { MOTION } from '../config/app';
import { HardShadow, splitStyle } from './HardShadow';
import { Enter, PressScale, useAnimatedNumber } from './Motion';
import { Sticker, type StickerName } from './Sticker';

/** A tappable row that opens another screen: icon, title, one line of help, chevron. */
export function LinkRow({ icon, title, sub, onPress, sticker }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; onPress: () => void; sticker?: StickerName }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <PressScale onPress={onPress}>
      <Card style={styles.linkRow}>
        {sticker ? <Sticker name={sticker} size={38} tilt={-6} /> : <Ionicons name={icon} size={26} color={colors.primary} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.linkTitle}>{title}</Text>
          {sub ? <Text style={styles.linkSub}>{sub}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
      </Card>
    </PressScale>
  );
}

export function Card({ children, style, index }: { children: React.ReactNode; style?: ViewStyle; index?: number }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const { outer, inner } = splitStyle(style);
  return (
    <HardShadow offset={SHADOW_OFFSET} color={colors.shadowInk} radius={radius.lg} outerStyle={outer}>
      <Enter index={index} style={{ flexGrow: 1 }}>
        <View style={[styles.card, { flexGrow: 1 }, inner]}>{children}</View>
      </Enter>
    </HardShadow>
  );
}

export function ProgressRing({
  size = 180,
  stroke = 14,
  progress,
  color,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number; // 0..1+
  color?: string;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useAnimatedNumber(Math.max(0, Math.min(1, progress)), MOTION.ringMs);
  const over = progress > 1;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.primarySoft} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.danger : (color ?? colors.primary)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function MacroBar({
  label,
  value,
  goal,
  color,
  unit = 'g',
  part,
  watch,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  unit?: string;
  /** a share of `value` drawn in another colour (for example the saturated part of fat) */
  part?: { value: number; color: string };
  /** a nutrient to keep under: a small mark appears beside its name once the goal is passed */
  watch?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const pct = useAnimatedNumber(goal > 0 ? Math.min(1, value / goal) : 0, MOTION.barMs);
  const partPct = part && value > 0 ? Math.min(1, Math.max(0, part.value / value)) : 0; // share of the filled bar
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.rowBetween}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.macroLabel}>{label}</Text>
          {watch && goal > 0 && value > goal * 1.01 ? <Ionicons name="arrow-up" size={12} color={colors.warn} accessibilityLabel="over" /> : null}
        </View>
        <Text style={styles.macroValue}>
          {Math.round(value)}
          <Text style={{ color: colors.inkSoft }}>
            {' '}
            / {Math.round(goal)}
            {unit}
          </Text>
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color, flexDirection: 'row' }]}>
          {part && partPct > 0 ? <View style={{ width: `${partPct * 100}%`, height: '100%', backgroundColor: part.color }} /> : null}
        </View>
      </View>
    </View>
  );
}

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const primary = variant === 'primary';
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={{ flexGrow: 1 }}>
      {({ pressed }) => (
        <HardShadow offset={SHADOW_OFFSET} color={colors.shadowInk} radius={radius.md} pressed={pressed} outerStyle={disabled ? { opacity: 0.4, flexGrow: 1 } : { flexGrow: 1 }}>
          <View style={[styles.btn, { flexGrow: 1 }, primary ? styles.btnPrimary : styles.btnGhost, variant === 'danger' && { borderColor: colors.danger }]}>
            {icon && <Ionicons name={icon} size={18} color={primary ? colors.onPrimary : colors.ink} />}
            <Text style={[styles.btnText, { color: primary ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.ink }]}>{title}</Text>
          </View>
        </HardShadow>
      )}
    </Pressable>
  );
}

export function ComingSoon({
  icon,
  title,
  blurb,
  items,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  blurb: string;
  items: string[];
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <View style={styles.soonIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={styles.soonTitle}>{title}</Text>
      <Text style={styles.soonBlurb}>{blurb}</Text>
      <View style={{ alignSelf: 'stretch', marginTop: 14, gap: 8 }}>
        {items.map((i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Ionicons name="ellipse-outline" size={14} color={colors.inkSoft} />
            <Text style={{ color: colors.ink, fontSize: 14 }}>{i}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.soonTag}>NOT BUILT YET — see ROADMAP.md</Text>
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  linkSub: { fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, borderWidth: BORDER, borderColor: colors.cardBorder },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  macroLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  macroValue: { fontSize: 14, fontWeight: '700', color: colors.ink },
  track: { height: 12, borderRadius: 6, backgroundColor: colors.card, borderWidth: BORDER, borderColor: colors.cardBorder, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    borderWidth: BORDER,
    borderColor: colors.cardBorder,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnGhost: { backgroundColor: colors.primarySoft },
  btnText: { fontSize: 15, fontWeight: '700' },
  soonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  soonTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  soonBlurb: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginTop: 6 },
  soonTag: { marginTop: 18, fontSize: 11, letterSpacing: 1, fontWeight: '700', color: colors.warn },
});
