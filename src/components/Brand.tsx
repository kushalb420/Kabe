import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { useColors } from '../theme';

const LOGOS = {
  black: { src: require('../../assets/brand/kabe-black.png'), ratio: 720 / 155 },
  white: { src: require('../../assets/brand/kabe-white.png'), ratio: 720 / 141 },
  yellow: { src: require('../../assets/brand/kabe-yellow.png'), ratio: 720 / 133 },
};

/** True when a colour like #RRGGBB is dark. */
export const isDark = (hex: string): boolean => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128;
};

/** The Kabe logo from the brand files: black on light backgrounds, white on dark ones. `size` is roughly the old lettering size. */
export function Brand({ size = 22, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  const colors = useColors();
  const logo = isDark(colors.bg) ? LOGOS.white : LOGOS.black;
  const width = Math.round(size * 4.6);
  return <Image source={logo.src} style={[{ width, height: Math.round(width / logo.ratio) }, style]} resizeMode="contain" accessibilityRole="header" accessibilityLabel="Kabe" />;
}
