import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export type SegmentedProps<T extends string> = {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const theme = useTheme();
  const t = theme.tokens;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        {
          backgroundColor: t.bgInset,
          borderColor: t.border,
          borderRadius: theme.radii.md,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: active ? t.bgCard : 'transparent',
                borderRadius: theme.radii.sm,
                paddingHorizontal: theme.spacing.base,
              },
              active && theme.shadows.shadow1,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={{
                color: active ? t.brand : t.fg2,
                fontFamily: theme.fonts.sansSemibold,
                fontSize: theme.fontSize.sm,
                fontWeight: '600',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  segment: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
