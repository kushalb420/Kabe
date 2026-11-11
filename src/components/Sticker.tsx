import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';
import { MOTION } from '../config/app';

const IMAGES = {
  mascot: require('../../assets/stickers/mascot.png'),
  wordmark: require('../../assets/stickers/wordmark.png'),
  broccoli: require('../../assets/stickers/broccoli.png'),
  check: require('../../assets/stickers/check.png'),
  dumbbell: require('../../assets/stickers/dumbbell.png'),
  egg: require('../../assets/stickers/egg.png'),
  rice: require('../../assets/stickers/rice.png'),
  salmon: require('../../assets/stickers/salmon.png'),
  sparkles: require('../../assets/stickers/sparkles.png'),
} as const;

export type StickerName = keyof typeof IMAGES;

/** Width / height of each sticker file, so a sticker keeps its shape at any size. */
const RATIO: Record<StickerName, number> = { mascot: 360 / 312, wordmark: 420 / 146, broccoli: 260 / 246, check: 256 / 260, dumbbell: 260 / 138, egg: 260 / 245, rice: 260 / 189, salmon: 260 / 114, sparkles: 300 / 289 };

/**
 * One of the Kabe stickers (from the brand pack). `size` is the width in px. `tilt` rotates it a little, like a sticker
 * stuck on by hand. `bob` makes it float gently (use on one or two stickers per screen, not everywhere).
 */
export function Sticker({ name, size = 56, tilt = 0, bob = false, style }: { name: StickerName; size?: number; tilt?: number; bob?: boolean; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!bob || !MOTION.enabled) return;
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [bob, v]);
  const img: StyleProp<ImageStyle> = { width: size, height: size / RATIO[name] };
  return (
    <View pointerEvents="none" style={style}>
      <Animated.View style={{ transform: [{ rotate: `${tilt}deg` }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}>
        <Image source={IMAGES[name]} style={img} resizeMode="contain" accessible={false} />
      </Animated.View>
    </View>
  );
}
