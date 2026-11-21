import React, { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';
import { useColors, type Colors } from '../theme';

/**
 * True inside a card, a button or any other light surface. In a theme whose page is dark (Noir), text and icons drawn straight on
 * the page switch to the light "on page" colours, while everything inside a surface keeps its dark colours.
 */
const SurfaceContext = createContext(false);
export const OnSurface = ({ children }: { children: React.ReactNode }) => <SurfaceContext.Provider value>{children}</SurfaceContext.Provider>;
export const useOnSurface = () => useContext(SurfaceContext);

/** The colour to really draw with: on a dark page, the ink and link colours turn light; everywhere else nothing changes. */
export function pageColor(color: unknown, c: Colors, onSurface: boolean): unknown {
  if (onSurface || c.inkOnBg === c.ink) return color;
  if (color === c.ink || color === c.primaryDark) return c.inkOnBg;
  if (color === c.inkSoft) return c.inkSoftOnBg;
  if (color === c.primary) return c.primaryOnBg;
  if (color === c.danger) return c.dangerOnBg;
  if (color === c.warn) return c.warnOnBg;
  return color;
}

export function useRemapStyle() {
  const c = useColors();
  const onSurface = useOnSurface();
  return <S,>(style: S): S => {
    if (onSurface || c.inkOnBg === c.ink) return style;
    const f = StyleSheet.flatten(style as never) as { color?: unknown } | undefined;
    const to = f && pageColor(f.color, c, false);
    return (f && to !== f.color ? [style, { color: to }] : style) as S;
  };
}
