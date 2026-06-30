import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export type BadgeVariant = 'default' | 'brand' | 'blue';

export type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', style }) => {
  const theme = useTheme();
  const t = theme.tokens;

  let bg: string, fg: string, border: string;
  switch (variant) {
    case 'brand':
      bg = t.brandTint;
      fg = t.brand;
      border = 'transparent';
      break;
    case 'blue':
      bg = t.accent2Tint;
      fg = t.accent2;
      border = 'transparent';
      break;
    case 'default':
    default:
      bg = t.bgInset;
      fg = t.fg2;
      border = t.border;
      break;
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: border,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: fg,
          fontFamily: theme.fonts.sansSemibold,
          fontSize: theme.fontSize.xs,
          fontWeight: '600',
          lineHeight: 14,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
