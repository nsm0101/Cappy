import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: 'bottom' | 'center';
  maxHeight?: number;
  contentStyle?: ViewStyle;
  accessibilityLabel?: string;
};

const TIMING_BASE = 320;

/**
 * Cappy's signature dose-logging UI: a bottom sheet that opens after an
 * NFC tap. Use `variant="center"` for desktop-style confirmations.
 *
 * Scrim taps outside the sheet close it. Always pair with a screen
 * heading inside; the sheet itself does not render a title.
 */
export const Sheet: React.FC<SheetProps> = ({
  visible,
  onClose,
  children,
  variant = 'bottom',
  maxHeight,
  contentStyle,
  accessibilityLabel,
}) => {
  const theme = useTheme();
  const t = theme.tokens;
  const { height: winHeight } = useWindowDimensions();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: TIMING_BASE,
        easing: Easing.bezier(0.2, 0, 0, 1),
      });
      translateY.value = withTiming(0, {
        duration: TIMING_BASE,
        easing: Easing.bezier(0.2, 0, 0, 1),
      });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(16, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const resolvedMaxHeight = maxHeight ?? Math.round(winHeight * 0.92);

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }, scrimStyle]}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { justifyContent: variant === 'center' ? 'center' : 'flex-end' },
          ]}
          onPress={onClose}
          accessibilityLabel="Close sheet"
        >
          {/* Inner pressable prevents tap-through */}
          <Pressable
            onPress={() => undefined}
            accessibilityRole={variant === 'center' ? 'alert' : undefined}
            accessibilityLabel={accessibilityLabel}
          >
            <Animated.View
              style={[
                styles.sheet,
                {
                  backgroundColor: t.bgCard,
                  borderRadius: theme.radii.sheet,
                  borderBottomLeftRadius: variant === 'center' ? theme.radii.sheet : 0,
                  borderBottomRightRadius: variant === 'center' ? theme.radii.sheet : 0,
                  maxHeight: resolvedMaxHeight,
                  marginHorizontal: variant === 'center' ? theme.spacing.lg : 0,
                  alignSelf: variant === 'center' ? 'center' : 'stretch',
                  maxWidth: variant === 'center' ? 420 : 480,
                  width: variant === 'center' ? '90%' : '100%',
                },
                theme.shadows.shadow3,
                sheetStyle,
                contentStyle,
              ]}
            >
              <SafeAreaView edges={['bottom']}>
                {variant === 'bottom' ? (
                  <View
                    style={[
                      styles.grabber,
                      { backgroundColor: t.sheetGrabber, marginTop: 8 },
                    ]}
                  />
                ) : null}
                <ScrollView
                  contentContainerStyle={{
                    padding: theme.spacing.lg,
                    paddingBottom: theme.spacing.xl,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              </SafeAreaView>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    overflow: 'hidden',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 4,
  },
});
