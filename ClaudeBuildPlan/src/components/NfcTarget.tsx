import React, { useEffect } from 'react';
import { Image, StyleSheet, View, ViewStyle, AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

export type NfcTargetProps = {
  size?: number;
  pulsing?: boolean;
  style?: ViewStyle;
};

/**
 * Pulsing NFC tap target. Two concentric rings expand and fade,
 * matching the .cap-nfc CSS animation. The capybara mark sits
 * centered.
 *
 * Respects "Reduce Motion" accessibility preference.
 */
export const NfcTarget: React.FC<NfcTargetProps> = ({ size = 132, pulsing = true, style }) => {
  const theme = useTheme();
  const t = theme.tokens;
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);

  useEffect(() => {
    if (!pulsing || reduceMotion) {
      ring1.value = 0;
      ring2.value = 0;
      return;
    }
    const cfg = { duration: 2400, easing: Easing.bezier(0.2, 0, 0, 1) };
    ring1.value = withRepeat(withTiming(1, cfg), -1, false);
    ring2.value = withDelay(1200, withRepeat(withTiming(1, cfg), -1, false));
  }, [pulsing, reduceMotion, ring1, ring2]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ring1.value * 0.45 }],
    opacity: 0.7 * (1 - ring1.value),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ring2.value * 0.45 }],
    opacity: 0.7 * (1 - ring2.value),
  }));

  const markSize = Math.round(size * 0.7);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="NFC tap area"
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.accent2Tint,
          borderColor: t.nfcRing,
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { borderColor: t.nfcRing, borderRadius: size / 2, width: size, height: size },
          ring1Style,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { borderColor: t.nfcRing, borderRadius: size / 2, width: size, height: size },
          ring2Style,
        ]}
      />
      <Image
        source={require('@/assets/cappy-mark.png')}
        style={{
          width: markSize,
          height: markSize,
          borderRadius: markSize / 2,
        }}
        resizeMode="cover"
        accessibilityLabel=""
        accessible={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'visible',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
});
