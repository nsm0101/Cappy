import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { formatClockTime } from '@/lib';

/** One medication lane in the 24h timeline. */
export type DayBarLane = {
  key: string;
  /** Lane label — brand display name. */
  label: string;
  accent: string;
  /** Doses logged in the last 24h (midnight-to-midnight, local). */
  doses: { givenAt: string }[];
  /** Safe window to shade — null when there's no prior dose (nothing to shade). */
  window: { fromAt: string; toAt: string } | null;
};

export type DoseDayBarProps = {
  lanes: DayBarLane[];
  now?: Date;
};

const LANE_HEIGHT = 64;
const HOUR_LABELS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

/** Fraction of the day (0-1) elapsed at `date`, clamped to local midnight bounds. */
const dayFraction = (date: Date, midnight: Date): number => {
  const dayMs = 24 * 3600 * 1000;
  const frac = (date.getTime() - midnight.getTime()) / dayMs;
  return Math.min(1, Math.max(0, frac));
};

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Midnight-to-midnight horizontal 24h bar, one lane per medication.
 * Hour gridlines every 2h, dose dots at their time positions, a
 * shaded "too early" region from each last dose to its next-safe time,
 * and a "now" vertical line.
 */
export const DoseDayBar: React.FC<DoseDayBarProps> = ({ lanes, now = new Date() }) => {
  const theme = useTheme();
  const t = theme.tokens;
  const midnight = startOfDay(now);
  const tomorrow = new Date(midnight.getTime() + 24 * 3600 * 1000);
  const nowFrac = dayFraction(now, midnight);

  return (
    <View accessibilityRole="image" accessibilityLabel="24-hour dose timeline" style={styles.wrap}>
      {/* Hour gridline labels */}
      <View style={styles.hourLabelRow}>
        {HOUR_LABELS.map((h) => (
          <Text
            key={h}
            style={{
              color: t.fg3,
              fontSize: theme.fontSize.xs,
              fontFamily: theme.fonts.mono,
              width: `${(2 / 24) * 100}%`,
            }}
          >
            {String(h).padStart(2, '0')}
          </Text>
        ))}
      </View>

      {lanes.map((lane) => (
        <View key={lane.key} style={{ marginTop: theme.spacing.sm }}>
          <Text
            style={{
              color: t.fg2,
              fontSize: theme.fontSize.xs,
              fontFamily: theme.fonts.sansSemibold,
              marginBottom: 4,
            }}
          >
            {lane.label}
          </Text>
          <View
            style={[
              styles.lane,
              { height: LANE_HEIGHT, backgroundColor: t.bgInset, borderRadius: theme.radii.sm },
            ]}
          >
            {/* Hour gridlines */}
            {HOUR_LABELS.map((h) => (
              <View
                key={h}
                style={[
                  styles.gridline,
                  { left: `${(h / 24) * 100}%`, backgroundColor: t.border },
                ]}
              />
            ))}

            {/* Too-early shaded window, clipped to [midnight, tomorrow) */}
            {lane.window
              ? (() => {
                  const fromAt = new Date(lane.window.fromAt);
                  const toAt = new Date(lane.window.toAt);
                  if (toAt <= midnight || fromAt >= tomorrow) return null;
                  const clippedFrom = fromAt < midnight ? midnight : fromAt;
                  const clippedTo = toAt > tomorrow ? tomorrow : toAt;
                  const left = dayFraction(clippedFrom, midnight) * 100;
                  const width = Math.max(0, dayFraction(clippedTo, midnight) * 100 - left);
                  return (
                    <View
                      style={[
                        styles.window,
                        {
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: lane.accent,
                          opacity: 0.18,
                        },
                      ]}
                    />
                  );
                })()
              : null}

            {/* Dose dots */}
            {lane.doses.map((dose, idx) => {
              const date = new Date(dose.givenAt);
              if (date < midnight || date >= tomorrow) return null;
              const left = dayFraction(date, midnight) * 100;
              return (
                <View key={idx} style={[styles.doseMarkerWrap, { left: `${left}%` }]}>
                  <View style={[styles.doseDot, { backgroundColor: lane.accent }]} />
                  <Text
                    style={{
                      color: t.fg3,
                      fontSize: 9,
                      fontFamily: theme.fonts.mono,
                      marginTop: 2,
                    }}
                  >
                    {formatClockTime(date)}
                  </Text>
                </View>
              );
            })}

            {/* "Now" line */}
            <View
              pointerEvents="none"
              style={[styles.nowLine, { left: `${nowFrac * 100}%`, backgroundColor: t.fg1 }]}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  hourLabelRow: {
    flexDirection: 'row',
  },
  lane: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  gridline: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  doseMarkerWrap: {
    position: 'absolute',
    top: 6,
    alignItems: 'center',
    transform: [{ translateX: -4 }],
  },
  doseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nowLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
  },
});
