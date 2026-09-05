import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  Button,
  Card,
  LastDoseBlock,
  MemberAvatar,
  DOSE_STATUS_LABEL,
} from '@/components';
import {
  supabase,
  doses as dosesApi,
  type DoseEventWithDetails,
  type DoseStatusResult,
} from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme';
import {
  brandFor,
  formatClockTime,
  formatDayHeading,
  formatDoseAmount,
  formatTimeUntil,
  initialsFromName,
} from '@/lib';
import type { AppStackParamList } from '@/navigation/types';

/**
 * ADR-0009 ticket 7 — the tap destination for a dose notification.
 *
 * "Deep link to the logged dose in a read-only sheet — same component as the
 * log flow, without the Log action." This screen therefore reuses
 * `LastDoseBlock` (the safety-critical block from the scan sheet) and adds
 * nothing that mutates: no Log button, no amount field, no time picker.
 *
 * Route param shape: `{ doseId: string }` (registered as `DoseDetail`).
 */
type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'DoseDetail'>;

/**
 * TECH DEBT (flagged for the Orchestrator): this query belongs in
 * `src/api/doses.ts` as
 *
 *   export const getDoseWithDetails =
 *     (doseId: string): Promise<DoseEventWithDetails | null>
 *
 * It is inlined here only because `src/api/**` is owned by another agent in
 * this release. The select mirrors `DOSE_DETAILS_SELECT` in that module —
 * both FKs to `profiles` must be named explicitly or the embed is ambiguous.
 * Lift it verbatim and swap the call below.
 */
const DOSE_DETAIL_SELECT = `
  *,
  medication:medications (*),
  profiles!dose_events_logged_by_fkey ( display_name ),
  caregiver_recipient:profiles!dose_events_caregiver_user_id_fkey ( display_name, avatar_url ),
  children ( display_name, avatar_url )
`;

const getDoseWithDetails = async (doseId: string): Promise<DoseEventWithDetails | null> => {
  const { data, error } = await supabase
    .from('dose_events')
    .select(DOSE_DETAIL_SELECT)
    .eq('id', doseId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as DoseEventWithDetails | null) ?? null;
};

/**
 * RLS returns nothing both for a dose that does not exist and for a dose in a
 * family the viewer has left. The copy is deliberately identical for both —
 * confirming that a row exists would leak another family's record.
 */
const NOT_AVAILABLE = "This dose isn't available. It may have been removed, or it belongs to a family you're no longer part of.";

export const DoseDetailScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { doseId } = useRoute<Rt>().params;

  const [dose, setDose] = useState<DoseEventWithDetails | null>(null);
  const [status, setStatus] = useState<DoseStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const load = useCallback(async () => {
    if (!doseId) {
      setDose(null);
      setLoading(false);
      return;
    }
    try {
      setErrorText('');
      const row = await getDoseWithDetails(doseId);
      setDose(row);
      // Current state for this recipient + medication, so a caregiver who
      // arrives from a push sees whether another dose is safe yet — not just
      // the historical row. Child-only: `getDoseStatus` has no adult variant.
      if (row?.child_id) {
        try {
          setStatus(await dosesApi.getDoseStatus(row.child_id, row.medication_id));
        } catch {
          setStatus(null);
        }
      } else {
        setStatus(null);
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not load this dose.');
    } finally {
      setLoading(false);
    }
  }, [doseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  const header = (
    <View style={styles.headerRow}>
      <Text
        style={{
          color: t.fg1,
          fontFamily: theme.fonts.display,
          fontSize: theme.fontSize.xxl,
          fontWeight: '800',
        }}
        accessibilityRole="header"
      >
        Dose details
      </Text>
      <Button label="Close" variant="ghost" onPress={close} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]} edges={['top']}>
        <ActivityIndicator color={t.brand} />
      </SafeAreaView>
    );
  }

  if (errorText || !dose) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={{ padding: theme.spacing.lg }}>
          {header}
          <Card inset style={styles.emptyCard}>
            <Ionicons
              name={errorText ? 'cloud-offline-outline' : 'document-outline'}
              size={32}
              color={t.fgMuted}
            />
            <Text
              style={{
                color: t.fg2,
                marginTop: theme.spacing.sm,
                textAlign: 'center',
                lineHeight: theme.lineHeight.base,
              }}
            >
              {errorText || NOT_AVAILABLE}
            </Text>
            {errorText ? (
              <View style={{ marginTop: theme.spacing.md }}>
                <Button
                  label="Try again"
                  onPress={() => {
                    setLoading(true);
                    void load();
                  }}
                />
              </View>
            ) : null}
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const recipientName =
    dose.children?.display_name ?? dose.caregiver_recipient?.display_name ?? 'Family member';
  const recipientAvatar = dose.children?.avatar_url ?? dose.caregiver_recipient?.avatar_url ?? null;
  const medName = dose.medication.brand_name ?? dose.medication.generic_name;
  const accent = brandFor(dose.medication.generic_name).accent;
  const amountLabel = formatDoseAmount({
    formulation: dose.medication.formulation,
    amountMg: dose.amount_mg,
    amountVolumeMl: dose.amount_volume_ml,
    unitCount: dose.unit_count,
  });
  const loggedByLabel =
    dose.logged_by === user?.id ? 'you' : dose.profiles?.display_name ?? null;
  const superseded = dose.status === 'superseded';

  // The status pill describes the *latest* dose for this recipient +
  // medication. Only attach it to this record when this dose IS that one —
  // otherwise the pill would describe a different dose than the one on screen.
  const isLatest =
    status?.last_dose_at != null &&
    Math.abs(new Date(status.last_dose_at).getTime() - new Date(dose.given_at).getTime()) < 1000;

  const nextSafeLine =
    status?.next_safe_at != null
      ? `The next dose is safe ${formatTimeUntil(status.next_safe_at)} (at ${formatClockTime(
          status.next_safe_at,
        )}).`
      : null;

  const safetyText = isLatest
    ? status && (status.status === 'due' || status.status === 'overdue')
      ? 'Always confirm against the product label.'
      : nextSafeLine
    : status != null
      ? 'A newer dose has been logged since this one.'
      : null;

  const footnotes =
    status != null
      ? [`${status.doses_in_last_24h} of ${dose.medication.max_doses_per_24h} doses in the last 24 hours.`]
      : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      >
        {header}

        <View
          style={[styles.identityRow, { marginBottom: theme.spacing.md }]}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`Dose for ${recipientName}`}
        >
          <MemberAvatar
            avatarPath={recipientAvatar}
            initials={initialsFromName(recipientName)}
            tint={theme.palette.blue[500]}
            size="lg"
          />
          <View style={styles.identityText}>
            <Text
              style={{
                color: t.fg1,
                fontFamily: theme.fonts.display,
                fontSize: theme.fontSize.xl,
                fontWeight: '800',
              }}
            >
              {recipientName}
            </Text>
            <Text
              style={{
                color: accent,
                fontFamily: theme.fonts.sansSemibold,
                fontSize: theme.fontSize.sm,
                marginTop: 2,
              }}
            >
              {medName} · {dose.medication.concentration_label}
            </Text>
          </View>
        </View>

        <LastDoseBlock
          heading="This dose"
          status={isLatest ? status?.status : undefined}
          statusLabel={isLatest && status ? DOSE_STATUS_LABEL[status.status] : undefined}
          givenAt={dose.given_at}
          amountLabel={amountLabel.primary}
          loggedByLabel={loggedByLabel}
          safetyText={safetyText}
          footnotes={footnotes}
          style={{ marginBottom: theme.spacing.lg }}
        />

        <Card>
          <Row label="Given" value={`${formatDayHeading(dose.given_at)} at ${formatClockTime(dose.given_at)}`} />
          <Row label="Amount" value={amountLabel.secondary ? `${amountLabel.primary} (${amountLabel.secondary})` : amountLabel.primary} />
          <Row label="Logged by" value={dose.profiles?.display_name ?? 'Caregiver'} />
          <Row label="Recorded" value={`${formatDayHeading(dose.logged_at)} at ${formatClockTime(dose.logged_at)}`} />
          {dose.note ? <Row label="Note" value={dose.note} /> : null}
          {superseded ? (
            <View style={{ marginTop: theme.spacing.sm }}>
              <Badge label="Corrected — replaced by a later entry" />
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const theme = useTheme();
  const t = theme.tokens;
  return (
    <View style={[styles.detailRow, { marginBottom: theme.spacing.sm }]}>
      <Text style={{ color: t.fg3, fontSize: theme.fontSize.sm }}>{label}</Text>
      <Text
        style={{
          color: t.fg1,
          fontFamily: theme.fonts.sansMedium,
          fontSize: theme.fontSize.sm,
          flexShrink: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityText: {
    flexShrink: 1,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
});
