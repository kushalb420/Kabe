import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { useColors } from '../theme';

const LOGOS = {
  black: { src: require('../../assets/brand/kabe-black.png'), ratio: 1619 / 335 },
  white: { src: require('../../assets/brand/kabe-white.png'), ratio: 1450 / 302 },
};

const isDark = (hex: string): boolean => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128;
};

/** The official KABE logo picture (black on light backgrounds, white on dark ones). Used on the welcome and sign-in page only. */
export function BrandLogo({ width = 156, style }: { width?: number; style?: StyleProp<ImageStyle> }) {
  const colors = useColors();
  const logo = isDark(colors.bg) ? LOGOS.white : LOGOS.black;
  return <Image source={logo.src} style={[{ width, height: Math.round(width / logo.ratio) }, style]} resizeMode="contain" accessibilityRole="header" accessibilityLabel="Kabe" />;
}
