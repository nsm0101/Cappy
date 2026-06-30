import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  initials?: string;
  source?: ImageSourcePropType;
  tint?: string;
  size?: AvatarSize;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

const SIZE_MAP: Record<AvatarSize, { box: number; font: number }> = {
  sm: { box: 32, font: 14 },
  md: { box: 44, font: 16 },
  lg: { box: 64, font: 24 },
};

export const Avatar: React.FC<AvatarProps> = ({
  initials,
  source,
  tint,
  size = 'md',
  style,
  accessibilityLabel,
}) => {
  const theme = useTheme();
  const { box, font } = SIZE_MAP[size];
  const bg = tint ?? theme.tokens.brand;
  const label = (initials ?? '').slice(0, 2).toUpperCase();

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `Avatar ${label}`}
      style={[
        styles.box,
        {
          width: box,
          height: box,
          borderRadius: box / 2,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          style={[styles.image, { width: box, height: box, borderRadius: box / 2 }]}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            color: '#FFFFFF',
            fontFamily: theme.fonts.displaySemibold,
            fontSize: font,
            fontWeight: '700',
          }}
        >
          {label}
        </Text>
      )}
      {/* Inset ring for subtle depth, matches the CSS box-shadow inset */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: box / 2,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.25)',
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
  },
});
