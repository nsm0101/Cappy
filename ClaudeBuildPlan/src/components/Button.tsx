import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme';

export type ButtonVariant = 'primary' | 'blue' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const theme = useTheme();
  const t = theme.tokens;

  const { container, textStyle, indicatorColor } = React.useMemo(() => {
    let bg: string, fg: string, border: string;
    switch (variant) {
      case 'blue':
        bg = t.accent2;
        fg = t.accent2Fg;
        border = t.accent2;
        break;
      case 'secondary':
        bg = t.bgCard;
        fg = t.fg1;
        border = t.borderStrong;
        break;
      case 'ghost':
        bg = 'transparent';
        fg = t.fg2;
        border = 'transparent';
        break;
      case 'primary':
      default:
        bg = t.brand;
        fg = t.fgOnBrand;
        border = t.brand;
        break;
    }
    return {
      container: {
        backgroundColor: bg,
        borderColor: border,
      } as ViewStyle,
      textStyle: { color: fg } as TextStyle,
      indicatorColor: fg,
    };
  }, [variant, t]);

  const isLg = size === 'lg';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      android_ripple={{ color: t.bgInset }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: isLg ? 56 : theme.spacing.tapMin,
          paddingHorizontal: isLg ? theme.spacing.xl : theme.spacing.lg,
          borderRadius: isLg ? theme.radii.base : theme.radii.md,
          borderWidth: 1,
        },
        block && styles.block,
        container,
        pressed && !disabled && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <>
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <Text
            style={[
              styles.label,
              {
                fontSize: isLg ? theme.fontSize.lg : theme.fontSize.base,
                fontFamily: theme.fonts.sansSemibold,
              },
              textStyle,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  block: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ translateY: 1 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
