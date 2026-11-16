import React from 'react';
import { Platform } from 'react-native';
import { Text } from './Text';
import { useColors } from '../theme';

/** The Kabe name as spaced lettering (the same as on the route card). Used wherever the old wordmark picture was. */
export function Brand({ size = 22, style }: { size?: number; style?: object }) {
  const colors = useColors();
  return (
    <Text style={[{ fontSize: size, lineHeight: Math.round(size * 1.27), fontWeight: '900', ...(Platform.OS === 'web' ? { fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif' } : {}), letterSpacing: size * 0.27, color: colors.ink, includeFontPadding: false }, style]} accessibilityRole="header">
      KABE
    </Text>
  );
}
