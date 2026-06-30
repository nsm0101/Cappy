import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export type CardProps = {
  children: React.ReactNode;
  inset?: boolean;
  padLg?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Card: React.FC<CardProps> = ({ children, inset = false, padLg = false, style }) => {
  const theme = useTheme();
  const t = theme.tokens;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: inset ? t.bgInset : t.bgCard,
          borderColor: t.border,
          borderRadius: theme.radii.base,
          padding: padLg ? theme.spacing.xl : theme.spacing.lg,
          borderWidth: inset ? 0 : 1,
        },
        !inset && theme.shadows.shadow1,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {},
});
