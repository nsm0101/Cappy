import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { medVisualForGeneric, type MedicationKind } from '@/lib';

export type MedToggleItem = {
  kind: MedicationKind;
  /** Brand label to show under the medication name (e.g. "Tylenol"). */
  brandName: string;
  enabled: boolean;
};

export type MedToggleChipsProps = {
  items: MedToggleItem[];
  /** Toggle a single medication on/off. At least one stays enabled. */
  onToggle: (kind: MedicationKind) => void;
  accessibilityLabel?: string;
};

/**
 * Independent on/off chips — one per medication — replacing the old
 * 3-way acetaminophen/ibuprofen/both segmented control. Each chip carries
 * the medication's stable identity color, letter badge and icon so the two
 * meds are obviously different at a glance.
 */
export const MedToggleChips: React.FC<MedToggleChipsProps> = ({
  items,
  onToggle,
  accessibilityLabel,
}) => {
  const theme = useTheme();
  const t = theme.tokens;

  return (
    <View
      style={styles.row}
      accessible={false}
      accessibilityLabel={accessibilityLabel ?? 'Medications'}
    >
      {items.map((item) => {
        const v = medVisualForGeneric(item.kind);
        const on = item.enabled;
        return (
          <Pressable
            key={item.kind}
            onPress={() => onToggle(item.kind)}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${v.label}${item.brandName ? `, ${item.brandName}` : ''}`}
            accessibilityHint={on ? 'Hide from schedule' : 'Show on schedule'}
            style={({ pressed }) => [
              styles.chip,
              {
                borderRadius: theme.radii.md,
                borderColor: on ? v.color : t.border,
                backgroundColor: on ? `${v.color}14` : t.bgInset,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.badge,
                { backgroundColor: on ? v.color : t.fgMuted },
              ]}
            >
              <Ionicons
                name={v.icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.labels}>
              <Text
                numberOfLines={1}
                style={{
                  color: on ? t.fg1 : t.fg2,
                  fontFamily: theme.fonts.sansSemibold,
                  fontSize: theme.fontSize.sm,
                  fontWeight: '700',
                }}
              >
                {v.label}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: on ? v.color : t.fg3,
                  fontSize: theme.fontSize.xs,
                  fontFamily: theme.fonts.sans,
                  marginTop: 1,
                }}
              >
                {item.brandName}
              </Text>
            </View>
            <Ionicons
              name={on ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={on ? v.color : t.fgMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    minHeight: 56,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: { flex: 1 },
});
