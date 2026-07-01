import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export type RowItemProps = {
  title: string;
  subtitle?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export const RowItem: React.FC<RowItemProps> = ({
  title,
  subtitle,
  leftSlot,
  rightSlot,
  onPress,
  showChevron = true,
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const theme = useTheme();
  const t = theme.tokens;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel ?? `${title}${subtitle ? `, ${subtitle}` : ''}`}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: t.bgInset }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: t.bgCard,
          borderColor: t.border,
          borderRadius: theme.radii.base,
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
          minHeight: 64,
        },
        pressed && !disabled && { backgroundColor: t.bgInset },
        disabled && { opacity: 0.6 },
        style,
      ]}
    >
      {leftSlot ? <View style={styles.slot}>{leftSlot}</View> : null}

      <View style={styles.textCol}>
        <Text
          numberOfLines={1}
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.sansSemibold,
            fontSize: theme.fontSize.base,
            fontWeight: '600',
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              color: t.fg3,
              fontFamily: theme.fonts.sans,
              fontSize: theme.fontSize.sm,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightSlot ? <View style={styles.slot}>{rightSlot}</View> : null}

      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={t.fgMuted} />
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  slot: {
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
});
