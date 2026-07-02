import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { Card } from './Card';

const AUTO_DISMISS_MS = 2500;

export type SuccessOverlayReminder = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  label: string;
};

export type SuccessOverlayProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  /** Optional reminder toggle row rendered under the subtitle. Omit to hide the row entirely. */
  reminder?: SuccessOverlayReminder;
  /** Fires exactly once — on auto-dismiss timeout or on tap. */
  onDone: () => void;
};

/**
 * Full-screen success confirmation shown after a dose is logged. Auto-
 * dismisses after 2.5s; tapping anywhere dismisses immediately. Respects
 * Reduce Motion (no entrance animation when enabled — see NfcTarget for
 * the same pattern).
 */
export const SuccessOverlay: React.FC<SuccessOverlayProps> = ({
  visible,
  title = 'Dose logged',
  subtitle,
  reminder,
  onDone,
}) => {
  const theme = useTheme();
  const t = theme.tokens;
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const donePendingRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.94);

  const fireDone = React.useCallback(() => {
    if (donePendingRef.current) return;
    donePendingRef.current = true;
    onDoneRef.current();
  }, []);

  useEffect(() => {
    if (!visible) return;
    donePendingRef.current = false;
    if (reduceMotion) {
      opacity.value = 1;
      scale.value = 1;
    } else {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.2, 0, 0, 1) });
      scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.2, 0, 0, 1) });
    }

    const timer = setTimeout(fireDone, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, reduceMotion, fireDone, opacity, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={fireDone}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={fireDone}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg, opacity: 0.92 }]} />
        <View style={styles.center} pointerEvents="box-none">
          <Animated.View style={cardStyle}>
            <Card style={styles.card}>
              <Ionicons name="checkmark-circle" size={48} color={t.brand} />
              <Text
                style={{
                  color: t.fg1,
                  fontFamily: theme.fonts.display,
                  fontSize: theme.fontSize.xxl,
                  fontWeight: '800',
                  marginTop: theme.spacing.md,
                  textAlign: 'center',
                }}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={{
                    color: t.fg2,
                    fontSize: theme.fontSize.sm,
                    marginTop: 4,
                    textAlign: 'center',
                  }}
                >
                  {subtitle}
                </Text>
              ) : null}
              {reminder ? (
                <View
                  style={[
                    styles.reminderRow,
                    { borderTopColor: t.border, marginTop: theme.spacing.md, paddingTop: theme.spacing.md },
                  ]}
                >
                  <Text
                    style={{
                      color: t.fg2,
                      fontSize: theme.fontSize.sm,
                      flex: 1,
                      marginRight: theme.spacing.sm,
                    }}
                  >
                    {reminder.label}
                  </Text>
                  <Switch
                    value={reminder.enabled}
                    onValueChange={reminder.onToggle}
                    accessibilityRole="switch"
                    accessibilityLabel={reminder.label}
                    trackColor={{ true: t.brand }}
                  />
                </View>
              ) : null}
            </Card>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    alignItems: 'center',
    minWidth: 260,
    maxWidth: 340,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderTopWidth: 1,
  },
});
