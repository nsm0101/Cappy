import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Card } from './Card';
import { DosePill, type DoseStatus } from './DosePill';
import { DoseSafetyText } from './DoseSafetyText';
import { useTheme } from '@/theme';
import { formatClockTime, formatRelativeTime } from '@/lib';

/**
 * ADR-0009 (scan sheet ordering): push notifications are *awareness*, not
 * prevention — they fire after the dose is already written. The whole burden
 * of preventing a double-dose therefore sits on this block, which must sit
 * above the fold and above the primary action on the scan sheet.
 *
 * It answers one question, in one glance: **has someone already given this?**
 * Amount, who logged it, and how long ago — plus the status pill and the
 * dose-safety line that has to follow it.
 *
 * Cappy is a coordination tool and a shared record. Nothing rendered here is
 * clinical guidance; copy is supplied by the caller and must stay factual.
 */
export type LastDoseBlockProps = {
  /** Eyebrow above the block. Defaults to 'Last dose'. */
  heading?: string;
  /**
   * Server-computed status for this recipient + medication, with the label to
   * show on the pill. Pass both or neither — a read-only record view has no
   * live "is it OK to give now" question to answer.
   */
  status?: DoseStatus;
  statusLabel?: string;
  /** ISO timestamp of the dose. `null` means nothing is on record yet. */
  givenAt: string | null;
  /** Preformatted amount, e.g. `5 mL`. Null when the details aren't loaded. */
  amountLabel?: string | null;
  /** Who logged it — a display name, or the literal `you`. */
  loggedByLabel?: string | null;
  /**
   * Copy for the nothing-on-record state. This is a first-class state, not an
   * error: it should read as reassuring.
   */
  emptyText?: string;
  /** The dose-safety line that follows the block (ADR-0009 ordering, item 3). */
  safetyText?: string | null;
  /** Extra muted lines below the safety line, e.g. the 24-hour count. */
  footnotes?: string[];
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_EMPTY_TEXT = 'Nothing on record yet.';

/**
 * The pill vocabulary for a dose status — the single source of these words,
 * shared by the scan sheet and the read-only dose view so the two can never
 * describe the same state differently.
 *
 * Coordination language only: it reports what the shared record says, it does
 * not tell anyone what to do.
 */
export const DOSE_STATUS_LABEL: Record<DoseStatus, string> = {
  due: 'OK to give now',
  early: 'Too early',
  recent: 'Given recently',
  overdue: 'Window passed — check before giving',
  max_reached: '24-hour limit reached',
  unknown: 'Status unavailable',
};

/**
 * Pill for a child recipient.
 *
 * Deliberately narrower than {@link DOSE_STATUS_LABEL}: the child sheet has
 * always collapsed `recent` and `early` into one "too early" state and treated
 * `overdue` as safe-to-give, because the child interval is computed server
 * side and is age-aware. Preserved verbatim from the pre-ADR-0009 sheet so the
 * reorder changes *where* this reads, never *what* it says.
 */
export const childDoseStatusPill = (
  status: DoseStatus,
  hasLastDose: boolean,
): { label: string; status: DoseStatus } => {
  if (status === 'max_reached') {
    return { label: DOSE_STATUS_LABEL.max_reached, status: 'max_reached' };
  }
  if (status === 'unknown') return { label: DOSE_STATUS_LABEL.unknown, status: 'unknown' };
  if (status === 'due' || status === 'overdue') {
    return { label: hasLastDose ? DOSE_STATUS_LABEL.due : 'No prior dose', status: 'due' };
  }
  return { label: DOSE_STATUS_LABEL.early, status: 'early' };
};

/**
 * One-sentence spoken/plain-text summary of a last-dose state.
 *
 * Shared so the same words can be attached to the Log button's
 * accessibility hint — a screen-reader user who jumps straight to the
 * primary action still hears the last-dose state before activating it.
 */
export const describeLastDose = (input: {
  givenAt: string | null;
  amountLabel?: string | null;
  loggedByLabel?: string | null;
  emptyText?: string;
}): string => {
  if (!input.givenAt) return input.emptyText ?? DEFAULT_EMPTY_TEXT;
  const parts = [
    input.amountLabel ?? null,
    input.loggedByLabel ? `logged by ${input.loggedByLabel}` : null,
    formatRelativeTime(input.givenAt),
  ].filter((part): part is string => Boolean(part));
  return `${parts.join(', ')}.`;
};

export const LastDoseBlock: React.FC<LastDoseBlockProps> = ({
  heading = 'Last dose',
  status,
  statusLabel,
  givenAt,
  amountLabel,
  loggedByLabel,
  emptyText = DEFAULT_EMPTY_TEXT,
  safetyText,
  footnotes,
  style,
}) => {
  const theme = useTheme();
  const t = theme.tokens;

  const summary = describeLastDose({ givenAt, amountLabel, loggedByLabel, emptyText });

  // One grouped announcement so VoiceOver/TalkBack reads the whole state in a
  // single stop, in this order, before reaching the primary action below.
  const a11yLabel = [
    `${heading}.`,
    statusLabel ? `${statusLabel}.` : null,
    summary,
    safetyText ?? null,
    ...(footnotes ?? []),
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ');

  const byLine = givenAt
    ? loggedByLabel
      ? `Logged by ${loggedByLabel} at ${formatClockTime(givenAt)}`
      : `Logged at ${formatClockTime(givenAt)}`
    : null;

  return (
    <View accessible accessibilityLabel={a11yLabel}>
      <Card
        style={[
          styles.card,
          { borderTopWidth: 3, borderTopColor: accentFor(t, status) },
          style,
        ]}
      >
        <Text
          style={{
            color: t.fg3,
            fontSize: theme.fontSize.xs,
            letterSpacing: 1,
            textTransform: 'uppercase',
            fontWeight: '600',
            marginBottom: theme.spacing.sm,
          }}
        >
          {heading}
        </Text>

        {status && statusLabel ? (
          <DosePill label={statusLabel} status={status} style={{ marginBottom: theme.spacing.sm }} />
        ) : null}

        {givenAt ? (
          <>
            <Text
              style={{
                color: t.fg1,
                fontFamily: theme.fonts.display,
                fontSize: theme.fontSize.xxxl,
                lineHeight: theme.lineHeight.display,
                fontWeight: '800',
              }}
            >
              {amountLabel ? `${amountLabel} · ` : ''}
              {formatRelativeTime(givenAt)}
            </Text>
            {byLine ? (
              <Text
                style={{
                  color: t.fg2,
                  fontFamily: theme.fonts.sansMedium,
                  fontSize: theme.fontSize.base,
                  marginTop: 2,
                }}
              >
                {byLine}
              </Text>
            ) : null}
          </>
        ) : (
          <Text
            style={{
              color: t.fg2,
              fontFamily: theme.fonts.sans,
              fontSize: theme.fontSize.base,
              lineHeight: theme.lineHeight.base,
            }}
          >
            {emptyText}
          </Text>
        )}

        {safetyText ? (
          <DoseSafetyText style={{ marginTop: theme.spacing.sm }}>{safetyText}</DoseSafetyText>
        ) : null}

        {(footnotes ?? []).map((line) => (
          <DoseSafetyText key={line} style={{ marginTop: 6 }}>
            {line}
          </DoseSafetyText>
        ))}
      </Card>
    </View>
  );
};

/** Top-edge accent, matching the dose-status colour family of the pill. */
const accentFor = (
  t: ReturnType<typeof useTheme>['tokens'],
  status: DoseStatus | undefined,
): string => {
  switch (status) {
    case 'due':
      return t.doseDueSolid;
    case 'early':
      return t.doseEarlySolid;
    case 'recent':
      return t.doseRecentSolid;
    case 'overdue':
    case 'max_reached':
      return t.doseOverdueSolid;
    default:
      return t.border;
  }
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
  },
});
