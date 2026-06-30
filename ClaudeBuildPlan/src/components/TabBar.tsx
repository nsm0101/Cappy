import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export type TabItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
};

export type TabBarProps = {
  items: TabItem[];
};

/**
 * Used as a custom tabBar for React Navigation, or standalone.
 * Mirrors the .cap-tabbar pattern from the design system —
 * blurred background, brand color on active, safe-area padding.
 */
export const TabBar: React.FC<TabBarProps> = ({ items }) => {
  const theme = useTheme();
  const t = theme.tokens;

  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: t.bgCard }}>
      <View
        style={[
          styles.bar,
          {
            borderTopColor: t.border,
            backgroundColor: t.bgCard,
            paddingHorizontal: theme.spacing.base,
          },
        ]}
      >
        {items.map((item) => {
          const iconName = item.active ? (item.iconActive ?? item.icon) : item.icon;
          const color = item.active ? t.brand : t.fgMuted;
          return (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: item.active }}
              accessibilityLabel={item.label}
              android_ripple={{ color: t.bgInset, borderless: true }}
              style={styles.tab}
            >
              <Ionicons name={iconName} size={22} color={color} />
              <Text
                style={{
                  color,
                  fontSize: 11,
                  fontFamily: theme.fonts.sansSemibold,
                  marginTop: 3,
                }}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 64,
    borderTopWidth: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tab: {
    minWidth: 56,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
