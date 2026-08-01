import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

export type SwitchProps = {
  /** Current on/off state. Controlled — the parent owns the value. */
  value: boolean;
  /** Called with the next value when the caregiver taps the switch. */
  onValueChange: (next: boolean) => void;
  /**
   * Renders the switch inert and visibly non-functional. Used when nothing
   * can act on the change (e.g. OS notification permission is denied) — a
   * switch must never look operable when flipping it would do nothing.
   */
  disabled?: boolean;
  /**
   * Required. A switch carries no visible text of its own, so without this
   * a screen reader announces only "switch, on" with no subject. Describe
   * what is being switched, not the current state — the state comes from
   * `accessibilityState`.
   */
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
};

// Visual track/thumb geometry. The tappable Pressable around it is padded
// out to `spacing.tapMin` (44) so the target stays legal at this size.
// RN boxes are border-box, so the border and the padding both come out of
// the track's inner width — TRAVEL accounts for all four.
const TRACK_W = 52;
const TRACK_H = 32;
const BORDER = 1;
const PAD = 2;
const THUMB = TRACK_H - (BORDER + PAD) * 2; // 26
const TRAVEL = TRACK_W - (BORDER + PAD) * 2 - THUMB; // 20

/**
 * Cappy's on/off switch.
 *
 * Built on Pressable + Reanimated rather than React Native's built-in
 * `Switch`, for the same reason Button, Segmented and MedToggleChips are:
 * the platform control does not accept our tokens. On iOS it ignores
 * `thumbColor` except when disabled, its track geometry is fixed below the
 * 44pt minimum target, and it exposes no border, radius or disabled
 * treatment — so a themed on-state and a token-consistent disabled state
 * are both unreachable. Hand-building it keeps the design system coherent
 * in light and dark and costs ~40 lines.
 *
 * Respects the "Reduce Motion" accessibility preference the same way
 * NfcTarget does: the thumb snaps instead of sliding.
 */
export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}) => {
  const theme = useTheme();
  const t = theme.tokens;
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const next = value ? 1 : 0;
    progress.value = reduceMotion
      ? next
      : withTiming(next, {
          duration: theme.motion.fast,
          easing: Easing.bezier(0.2, 0, 0, 1),
        });
  }, [value, reduceMotion, progress, theme.motion.fast]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.tapTarget,
        {
          minWidth: theme.spacing.tapMin,
          minHeight: theme.spacing.tapMin,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[
          styles.track,
          {
            backgroundColor: value ? t.brand : t.borderStrong,
            borderColor: value ? t.brand : t.border,
            borderRadius: theme.radii.pill,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: t.fgOnBrand, borderRadius: theme.radii.pill },
            theme.shadows.shadow1,
            thumbStyle,
          ]}
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tapTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderWidth: BORDER,
    padding: PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
});
