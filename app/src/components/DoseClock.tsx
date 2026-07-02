import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme';
import { formatClockTime } from '@/lib';

/** One logged dose plotted on the clock face. */
export type ClockDoseMarker = {
  /** ISO timestamp of the dose. */
  givenAt: string;
  /** Accent color for this medication (from brandFor). */
  accent: string;
};

/** A safe-window arc for one medication, drawn from `nextSafeAt` for `intervalHours`. */
export type ClockSafeArc = {
  /** ISO timestamp — start of the arc (when the next dose becomes safe). */
  nextSafeAt: string;
  intervalHours: number;
  accent: string;
  /** Arc radius — lets "both" mode offset acetaminophen vs ibuprofen. */
  radius: number;
};

export type DoseClockProps = {
  /** Dose markers to plot (last 24h). */
  markers: ClockDoseMarker[];
  /** Safe-window arcs to draw — omit entirely when status is max_reached/unknown. */
  arcs: ClockSafeArc[];
  /** Center caption line(s). */
  captionLines: string[];
  /** Current time, injectable for tests. */
  now?: Date;
};

const SIZE = 340;
const CENTER = 170;
const FACE_RADIUS = 130;
const LABEL_RADIUS = 150;
const TICK_OUTER = 130;
const TICK_INNER = 118;
const AM_DOT_RADIUS = 95;
const PM_DOT_RADIUS = 108;

/** Angle (degrees) for a given hour-of-12 position, 12 at top, clockwise. */
const hourAngleDeg = (hour: number): number => (hour % 12) * 30 - 90;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

const pointOnCircle = (radius: number, angleDeg: number): { x: number; y: number } => {
  const rad = toRad(angleDeg);
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
};

/** Fractional hour-of-12 (0-12, exclusive-ish) for a Date, used to place dose dots. */
const hourOf12 = (date: Date): number => {
  const h = date.getHours() % 12;
  const m = date.getMinutes();
  return h + m / 60;
};

const isPM = (date: Date): boolean => date.getHours() >= 12;

/**
 * Build an SVG arc path from startAngle to endAngle (degrees), clockwise,
 * at the given radius. Handles spans > 180deg by splitting into two arcs
 * (SVG's large-arc-flag only covers 0-360 in one sweep reliably when split).
 */
const arcPath = (radius: number, startAngleDeg: number, endAngleDeg: number): string => {
  let span = endAngleDeg - startAngleDeg;
  // Normalize to (0, 360]
  span = ((span % 360) + 360) % 360;
  if (span === 0) span = 360;

  if (span <= 180) {
    const start = pointOnCircle(radius, startAngleDeg);
    const end = pointOnCircle(radius, endAngleDeg);
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
  }
  // Split into two <=180deg sweeps for reliable rendering.
  const midAngle = startAngleDeg + span / 2;
  const start = pointOnCircle(radius, startAngleDeg);
  const mid = pointOnCircle(radius, midAngle);
  const end = pointOnCircle(radius, endAngleDeg);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${mid.x} ${mid.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
};

/**
 * A 12-hour analog dosing clock. Each of the 12 hour positions shows a
 * stacked dual label (AM hour above, PM hour below). Logged doses in the
 * last 24h plot as dots; safe-window arcs (one per medication) show when
 * the next dose becomes safe, clockwise for `intervalHours`.
 */
export const DoseClock: React.FC<DoseClockProps> = ({ markers, arcs, captionLines, now = new Date() }) => {
  const theme = useTheme();
  const t = theme.tokens;

  // Hour numerals highlighted (accent + bold) when that AM/PM reading falls
  // inside a safe-arc's span (i.e. in the coming 12h after next_safe_at).
  const highlighted = React.useMemo(() => {
    const map = new Map<string, string>(); // key `${hour}-${ampm}` -> accent
    arcs.forEach((arc) => {
      const start = new Date(arc.nextSafeAt);
      const endMs = start.getTime() + arc.intervalHours * 3600 * 1000;
      for (let i = 0; i < 24; i++) {
        const candidate = new Date(start.getTime());
        candidate.setHours(start.getHours(), start.getMinutes(), 0, 0);
        candidate.setHours(candidate.getHours() + i);
        if (candidate.getTime() < start.getTime()) continue;
        if (candidate.getTime() > endMs) break;
        const hour12 = candidate.getHours() % 12 === 0 ? 12 : candidate.getHours() % 12;
        const ampm = candidate.getHours() >= 12 ? 'PM' : 'AM';
        map.set(`${hour12}-${ampm}`, arc.accent);
      }
    });
    return map;
  }, [arcs]);

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Dosing clock showing safe window and recent doses">
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* PM half-shade — right semicircle (per the founder's reference image). */}
        <Path
          d={`M ${CENTER} ${CENTER - FACE_RADIUS} A ${FACE_RADIUS} ${FACE_RADIUS} 0 0 1 ${CENTER} ${CENTER + FACE_RADIUS} Z`}
          fill={t.bgInset}
          opacity={0.6}
        />

        {/* Outer ring */}
        <Circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill="none" stroke={t.border} strokeWidth={2} />

        {/* Tick marks — one per hour position */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = hourAngleDeg(i === 0 ? 12 : i);
          const outer = pointOnCircle(TICK_OUTER, angle);
          const inner = pointOnCircle(TICK_INNER, angle);
          return (
            <Line
              key={`tick-${i}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={t.fgMuted}
              strokeWidth={2}
            />
          );
        })}

        {/* Safe-window arcs (drawn under the numerals) */}
        {arcs.map((arc, idx) => {
          const startAngle = hourAngleDeg(new Date(arc.nextSafeAt).getHours() % 12) +
            (new Date(arc.nextSafeAt).getMinutes() / 60) * 30;
          const endAngle = startAngle + arc.intervalHours * 30;
          return (
            <Path
              key={`arc-${idx}`}
              d={arcPath(arc.radius, startAngle, endAngle)}
              fill="none"
              stroke={arc.accent}
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
        })}

        {/* Dose markers */}
        {markers.map((marker, idx) => {
          const date = new Date(marker.givenAt);
          const angle = hourAngleDeg(Math.floor(hourOf12(date))) + (hourOf12(date) % 1) * 30;
          const radius = isPM(date) ? PM_DOT_RADIUS : AM_DOT_RADIUS;
          const pos = pointOnCircle(radius, angle);
          return <Circle key={`dose-${idx}`} cx={pos.x} cy={pos.y} r={5} fill={marker.accent} />;
        })}

        {/* "Now" hand — short line from center pointing at the current time. */}
        {(() => {
          const angle = hourAngleDeg(Math.floor(hourOf12(now))) + (hourOf12(now) % 1) * 30;
          const tip = pointOnCircle(TICK_INNER, angle);
          return (
            <Line
              x1={CENTER}
              y1={CENTER}
              x2={tip.x}
              y2={tip.y}
              stroke={t.fg1}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.5}
            />
          );
        })()}

        {/* Stacked dual hour labels */}
        {Array.from({ length: 12 }, (_, i) => {
          const hour12 = i === 0 ? 12 : i;
          const angle = hourAngleDeg(hour12);
          const pos = pointOnCircle(LABEL_RADIUS, angle);
          const amAccent = highlighted.get(`${hour12}-AM`);
          const pmAccent = highlighted.get(`${hour12}-PM`);
          const amLabel = `${String(hour12).padStart(2, '0')}:00`;
          const pmLabel = `${String(hour12).padStart(2, '0')}:00`;
          return (
            <React.Fragment key={`label-${i}`}>
              <SvgText
                x={pos.x}
                y={pos.y}
                dy={-6}
                fontSize={11}
                fontWeight={amAccent ? '700' : '400'}
                fill={amAccent ?? theme.palette.blue[500]}
                textAnchor="middle"
              >
                {amLabel}
              </SvgText>
              <SvgText
                x={pos.x}
                y={pos.y}
                dy={10}
                fontSize={11}
                fontWeight={pmAccent ? '700' : '400'}
                fill={pmAccent ?? t.fg1}
                textAnchor="middle"
              >
                {pmLabel}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Center caption — absolutely positioned RN Text so it can wrap and
          use theme fonts (SvgText can't wrap multi-line easily). */}
      <View pointerEvents="none" style={[styles.captionWrap, { width: SIZE }]}>
        {captionLines.map((line, idx) => (
          <Text
            key={idx}
            style={{
              color: t.fg2,
              fontSize: theme.fontSize.xs,
              fontFamily: theme.fonts.sansMedium,
              textAlign: 'center',
            }}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
};

/** Helper the screen uses to build a caption line for a medication. */
export const captionForStatus = (params: {
  label: string;
  status: 'due' | 'early' | 'recent' | 'overdue' | 'max_reached' | 'unknown';
  nextSafeAt: string | null;
  hasPriorDose: boolean;
}): string => {
  const { label, status, nextSafeAt, hasPriorDose } = params;
  if (status === 'max_reached') return `${label}: 24-hour limit reached`;
  if (status === 'unknown') return `${label}: Status unavailable`;
  if (status === 'due' || status === 'overdue') {
    return `${label}: ${hasPriorDose ? 'OK to give now' : 'No prior dose'}`;
  }
  if (nextSafeAt) return `${label}: safe at ${formatClockTime(nextSafeAt)}`;
  return `${label}: OK to give now`;
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWrap: {
    position: 'absolute',
    top: CENTER - 20,
    alignItems: 'center',
    gap: 2,
  },
});
