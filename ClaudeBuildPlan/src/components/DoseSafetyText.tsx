import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { useTheme } from '@/theme';

export type DoseSafetyTextProps = {
  children: React.ReactNode;
  style?: TextStyle;
};

/**
 * Soft, non-clinical guidance text. Always pair with a DosePill.
 * The brief is explicit: Cappy is a coordination tool, not medical advice.
 */
export const DoseSafetyText: React.FC<DoseSafetyTextProps> = ({ children, style }) => {
  const theme = useTheme();

  return (
    <Text
      style={[
        styles.text,
        {
          color: theme.tokens.fg3,
          fontFamily: theme.fonts.sans,
          fontSize: theme.fontSize.xs,
          lineHeight: theme.fontSize.xs * 1.4,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {},
});
