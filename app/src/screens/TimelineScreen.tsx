import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, MemberAvatar } from '@/components';
import {
  doses as dosesApi,
  type DoseEventWithDetails,
  children as childrenApi,
  realtime as realtimeApi,
} from '@/api';
import { useTheme } from '@/theme';
import { useActiveFamily } from '@/family/ActiveFamilyContext';
import {
  brandFor,
  formatClockTime,
  formatDoseAmount,
  formatRelativeTime,
  formatDayHeading,
  initialsFromName,
} from '@/lib';

export const TimelineScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { activeFamily } = useActiveFamily();

  const [doses, setDoses] = useState<DoseEventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');

  const loadTimeline = useCallback(async () => {
    if (!activeFamily) {
      setDoses([]);
      return;
    }
    try {
      setErrorText('');
      const doseHistory = await dosesApi.listDosesWithDetailsForFamily(activeFamily.id);
      setDoses(doseHistory);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not load timeline.');
    }
  }, [activeFamily]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadTimeline();
      setLoading(false);
    })();
  }, [loadTimeline, activeFamily?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTimeline();
    setRefreshing(false);
  };

  // RT-1: live updates. Subscribe to dose_events for the active family's
  // children; when any caregiver logs a dose, refetch so Timeline reflects it
  // without a manual pull-to-refresh. Fetch child ids once per family change.
  useEffect(() => {
    if (!activeFamily) return;

    let unsubscribe: (() => void) | undefined;

    // Fetch child IDs for this family for the realtime subscription
    const setupSubscription = async () => {
      try {
        const kids = await childrenApi.listChildrenInFamily(activeFamily.id);
        const childIds = kids.map((c) => c.id);

        if (childIds.length === 0) return;

        unsubscribe = realtimeApi.subscribeFamilyDoses(activeFamily.id, childIds, () => {
          void loadTimeline();
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to set up realtime subscription', err);
      }
    };

    void setupSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeFamily, loadTimeline]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg }]}>
        <Text style={[styles.headerTitle, { color: t.fg1, fontFamily: theme.fonts.display }]}>
          Family Timeline
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxxl,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.brand} />
        }
      >
        {errorText ? (
          <Card style={styles.errorCard}>
            <Ionicons name="warning-outline" size={24} color={t.error} />
            <Text style={{ color: t.fg1, marginTop: 8, textAlign: 'center' }}>{errorText}</Text>
          </Card>
        ) : !activeFamily ? (
          <Card inset style={styles.emptyCard}>
            <Ionicons name="people-outline" size={36} color={t.fgMuted} style={{ marginBottom: 12 }} />
            <Text
              style={{
                color: t.fg2,
                fontFamily: theme.fonts.sans,
                fontSize: theme.fontSize.base,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              Start by creating or joining a family to see the dose timeline.
            </Text>
          </Card>
        ) : doses.length === 0 ? (
          <Card inset style={styles.emptyCard}>
            <Ionicons name="medical-outline" size={36} color={t.fgMuted} style={{ marginBottom: 12 }} />
            <Text
              style={{
                color: t.fg2,
                fontFamily: theme.fonts.sans,
                fontSize: theme.fontSize.base,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              No doses logged yet in {activeFamily.name}. Program an NFC tag or tap Scan on child profile to begin.
            </Text>
          </Card>
        ) : (() => {
          // Group doses by local calendar day of given_at
          const groupedByDay = doses.reduce(
            (acc, dose) => {
              const dayKey = formatDayHeading(dose.given_at);
              if (!acc[dayKey]) {
                acc[dayKey] = [];
              }
              acc[dayKey]!.push(dose);
              return acc;
            },
            {} as Record<string, DoseEventWithDetails[]>,
          );

          // Determine day order: 'Today', 'Yesterday', then others in order they appear
          const dayKeys = Object.keys(groupedByDay).sort((a, b) => {
            if (a === 'Today') return -1;
            if (b === 'Today') return 1;
            if (a === 'Yesterday') return -1;
            if (b === 'Yesterday') return 1;
            // For other days, maintain order they first appeared
            return 0;
          });

          return (
            <View style={{ gap: theme.spacing.md }}>
              {dayKeys.map((dayKey) => (
                <View key={dayKey}>
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
                    {dayKey}
                  </Text>
                  <View style={{ gap: theme.spacing.md }}>
                    {groupedByDay[dayKey]!.map((dose) => {
                      const formattedDose = formatDoseAmount({
                        formulation: dose.medication.formulation,
                        amountMg: dose.amount_mg,
                        amountVolumeMl: dose.amount_volume_ml,
                        unitCount: dose.unit_count,
                      });

                      const recipientName =
                        dose.children?.display_name ?? dose.caregiver_recipient?.display_name ?? 'Family member';
                      const recipientAvatarUrl =
                        dose.children?.avatar_url ?? dose.caregiver_recipient?.avatar_url ?? null;
                      const medicationName = dose.medication.brand_name ?? dose.medication.generic_name;
                      const loggerName = dose.profiles?.display_name ?? 'Caregiver';
                      const isSuperseded = dose.status === 'superseded';
                      // Color-code by medication: brand accent when a brand is
                      // named, otherwise generic-level color (Tylenol red /
                      // Motrin blue family) so acetaminophen vs ibuprofen is
                      // scannable at a glance.
                      const medKey = (dose.medication.brand_name ?? '').toLowerCase().includes('motrin')
                        ? 'motrin'
                        : (dose.medication.brand_name ?? '').toLowerCase().includes('advil')
                          ? 'advil'
                          : (dose.medication.brand_name ?? '').toLowerCase().includes('tylenol')
                            ? 'tylenol'
                            : undefined;
                      const accent = brandFor(dose.medication.generic_name, medKey).accent;

                      return (
                        <Card
                          key={dose.id}
                          style={[
                            styles.doseCard,
                            { borderLeftWidth: 3, borderLeftColor: accent },
                            isSuperseded && { opacity: 0.5, backgroundColor: t.bgMuted },
                          ]}
                        >
                          <View style={styles.doseHeader}>
                            <View style={styles.childInfoCol}>
                              <MemberAvatar
                                avatarPath={recipientAvatarUrl}
                                initials={initialsFromName(recipientName)}
                                tint={theme.palette.blue[500]}
                                size="md"
                              />
                              <View style={styles.childText}>
                                <Text
                                  style={{
                                    color: t.fg1,
                                    fontFamily: theme.fonts.sansSemibold,
                                    fontSize: theme.fontSize.base,
                                    fontWeight: '600',
                                  }}
                                >
                                  {recipientName}
                                </Text>
                                <Text
                                  style={{
                                    color: accent,
                                    fontFamily: theme.fonts.sansSemibold,
                                    fontSize: theme.fontSize.xs,
                                    fontWeight: '600',
                                    marginTop: 2,
                                  }}
                                >
                                  {medicationName}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.doseAmountCol}>
                              <Text
                                style={{
                                  color: t.accent2,
                                  fontFamily: theme.fonts.display,
                                  fontSize: theme.fontSize.base,
                                  fontWeight: '700',
                                }}
                              >
                                {formattedDose.primary}
                              </Text>
                              <Text
                                style={{
                                  color: t.fg3,
                                  fontFamily: theme.fonts.sans,
                                  fontSize: 10,
                                  marginTop: 2,
                                }}
                              >
                                {formatClockTime(dose.given_at)}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={[
                              styles.doseFooter,
                              { borderTopColor: t.border, marginTop: theme.spacing.sm },
                            ]}
                          >
                            <Text style={{ color: t.fg3, fontSize: theme.fontSize.xs }}>
                              {formatRelativeTime(dose.given_at)} · logged by {loggerName}
                            </Text>
                            {isSuperseded ? (
                              <Text style={{ color: t.error, fontSize: theme.fontSize.xs, fontWeight: '700' }}>
                                SUPERSEDED
                              </Text>
                            ) : null}
                          </View>

                          {dose.note ? (
                            <View style={[styles.noteContainer, { backgroundColor: t.bgInset }]}>
                              <Text style={{ color: t.fg2, fontSize: theme.fontSize.sm, fontFamily: theme.fonts.sans }}>
                                Note: {dose.note}
                              </Text>
                            </View>
                          ) : null}
                        </Card>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    height: 48,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  errorCard: {
    alignItems: 'center',
    padding: 16,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  doseCard: {
    padding: 16,
  },
  doseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  childInfoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  childText: {
    marginLeft: 12,
  },
  doseAmountCol: {
    alignItems: 'flex-end',
  },
  doseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  noteContainer: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
  },
});
