import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export type DoseStatus = 'due' | 'early' | 'recent' | 'overdue' | 'max_reached' | 'unknown';

export type DosePillProps = {
  label: string;
  status: DoseStatus;
  solid?: boolean;
  style?: ViewStyle;
};

/**
 * The dose-safety pill is the signature UI element of Cappy.
 * Color reinforces safe-vs-too-early WITHOUT implying clinical certainty.
 * Always pair with <DoseSafetyText> for the disclaimer.
 */
export const DosePill: React.FC<DosePillProps> = ({ label, status, solid = false, style }) => {
  const theme = useTheme();
  const t = theme.tokens;

  const bg = solid ? statusColor(t, status, 'solid') : statusColor(t, status, 'bg');
  const fg = solid ? '#FFFFFF' : statusColor(t, status, 'fg');
  const ring = solid ? 'transparent' : statusColor(t, status, 'ring');
  const dotBg = solid ? 'rgba(255,255,255,0.9)' : statusColor(t, status, 'solid');

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Dose status: ${label}`}
      style={[
        styles.pill,
        {
          backgroundColor: bg,
          borderColor: ring,
          borderWidth: solid ? 0 : 1,
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotBg }]} />
      <Text
        style={[
          styles.label,
          {
            color: fg,
            fontFamily: theme.fonts.sansBold,
            fontSize: theme.fontSize.sm,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

type Slot = 'solid' | 'fg' | 'bg' | 'ring';

const statusColor = (t: ReturnType<typeof useTheme>['tokens'], status: DoseStatus, slot: Slot) => {
  switch (status) {
    case 'due':
      return slot === 'solid'
        ? t.doseDueSolid
        : slot === 'fg'
          ? t.doseDueFg
          : slot === 'bg'
            ? t.doseDueBg
            : t.doseDueRing;
    case 'early':
      return slot === 'solid'
        ? t.doseEarlySolid
        : slot === 'fg'
          ? t.doseEarlyFg
          : slot === 'bg'
            ? t.doseEarlyBg
            : t.doseEarlyRing;
    case 'recent':
      return slot === 'solid'
        ? t.doseRecentSolid
        : slot === 'fg'
          ? t.doseRecentFg
          : slot === 'bg'
            ? t.doseRecentBg
            : t.doseRecentRing;
    case 'overdue':
      return slot === 'solid'
        ? t.doseOverdueSolid
        : slot === 'fg'
          ? t.doseOverdueFg
          : slot === 'bg'
            ? t.doseOverdueBg
            : t.doseOverdueRing;
    case 'max_reached':
      // 24-hour cap hit — same red family as overdue: this is a hard stop.
      return slot === 'solid'
        ? t.doseOverdueSolid
        : slot === 'fg'
          ? t.doseOverdueFg
          : slot === 'bg'
            ? t.doseOverdueBg
            : t.doseOverdueRing;
    case 'unknown':
      return slot === 'solid'
        ? t.fgMuted
        : slot === 'fg'
          ? t.fg2
          : slot === 'bg'
            ? t.bgInset
            : t.border;
  }
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    paddingLeft: 10,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontWeight: '700',
    lineHeight: 14,
  },
});
