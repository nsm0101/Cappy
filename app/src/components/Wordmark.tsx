import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export type WordmarkProps = {
  size?: number;
  style?: ViewStyle;
  color?: string;
};

/**
 * The "Cappy!" wordmark lockup — capybara mark + playful Baloo 2 text.
 * Use sparingly: launch screen, sign-in header, settings.
 */
export const Wordmark: React.FC<WordmarkProps> = ({ size = 32, style, color }) => {
  const theme = useTheme();
  const markSize = Math.round(size * 1.25);
  const c = color ?? theme.tokens.brand;

  return (
    <View
      accessibilityRole="header"
      accessibilityLabel="Cappy"
      style={[styles.row, style]}
    >
      <Image
        source={require('@/assets/cappy-mark.png')}
        style={{
          width: markSize,
          height: markSize,
          borderRadius: markSize / 2,
          marginRight: 12,
        }}
        accessibilityLabel=""
        accessible={false}
      />
      <Text
        style={{
          fontFamily: theme.fonts.brand,
          fontSize: size,
          color: c,
          fontWeight: '600',
          letterSpacing: -0.005 * size,
        }}
      >
        Cappy!
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
