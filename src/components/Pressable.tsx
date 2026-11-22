import React from 'react';
import { Pressable as RNPressable, PressableProps, StyleSheet } from 'react-native';
import { OnSurface } from './Surface';
import { useColors } from '../theme';

/**
 * The usual Pressable. When it has a light fill of its own (a card, chip or button colour), what is inside counts as being on a
 * surface, so on a dark page the text and icons in it keep their dark colours (see Surface.tsx).
 */
export const Pressable = React.forwardRef<React.ComponentRef<typeof RNPressable>, PressableProps>(function Pressable({ style, children, ...rest }, ref) {
  const c = useColors();
  if (c.inkOnBg === c.ink) {
    // a light page (the usual themes): nothing to do, so no extra work
    return (
      <RNPressable ref={ref} style={style} {...rest}>
        {children}
      </RNPressable>
    );
  }
  const flat = typeof style === 'function' ? undefined : (StyleSheet.flatten(style as never) as { backgroundColor?: unknown } | undefined);
  const fills: unknown[] = [c.card, c.chip, c.primarySoft, c.primary];
  const light = !!flat && fills.includes(flat.backgroundColor);
  const wrapped = light ? (typeof children === 'function' ? (s: Parameters<typeof children>[0]) => <OnSurface>{children(s)}</OnSurface> : <OnSurface>{children}</OnSurface>) : children;
  return (
    <RNPressable ref={ref} style={style} {...rest}>
      {wrapped}
    </RNPressable>
  );
});
