import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  DoseClock,
  DoseDayBar,
  DoseSafetyText,
  MemberAvatar,
  Segmented,
  captionForStatus,
  type ClockDoseMarker,
  type ClockSafeArc,
  type DayBarLane,
} from '@/components';
import {
  children as childrenApi,
  doses as dosesApi,
  nfc as nfcApi,
  brands as brandsApi,
  realtime as realtimeApi,
  type Child,
  type DoseEvent,
  type DoseStatusResult,
} from '@/api';
import type { Database } from '@/api';
import { useTheme } from '@/theme';
import { useActiveFamily } from '@/family/ActiveFamilyContext';
import { brandFor, initialsFromName, type MedicationKind } from '@/lib';

type MedicationRow = Database['public']['Tables']['medications']['Row'];

type MedToggle = 'acetaminophen' | 'ibuprofen' | 'both';
type ViewToggle = 'clock' | 'timeline';

/** Per-generic resolved state: the medication row + its live status. */
type GenericState = {
  generic: MedicationKind;
  med: MedicationRow;
  statusResult: DoseStatusResult | null;
  loading: boolean;
};

const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;

/** Pick the family-preferred brand row for a generic, else the first row. */
const pickMedForGeneric = (
  rows: MedicationRow[],
  generic: MedicationKind,
  prefs: Record<string, string>,
): MedicationRow | null => {
  const candidates = rows.filter((r) => r.generic_name.toLowerCase() === generic);
  if (candidates.length === 0) return null;
  const prefKey = prefs[generic];
  if (prefKey) {
    const preferred = candidates.find((r) => {
      const brand = brandFor(r.generic_name, prefKey);
      return (r.brand_name ?? '').toLowerCase() === brand.name.toLowerCase() || prefKey === 'generic';
    });
    if (preferred) return preferred;
  }
  return candidates[0] ?? null;
};

export const ScheduleScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { activeFamily } = useActiveFamily();

  const [kids, setKids] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [medToggle, setMedToggle] = useState<MedToggle>('both');
  const [viewToggle, setViewToggle] = useState<ViewToggle>('clock');
  const [medRows, setMedRows] = useState<MedicationRow[]>([]);
  const [brandPrefs, setBrandPrefs] = useState<Record<string, string>>({});
  const [genericStates, setGenericStates] = useState<Record<MedicationKind, GenericState | null>>({
    acetaminophen: null,
    ibuprofen: null,
  });
  const [recentDoses, setRecentDoses] = useState<DoseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedChild = kids.find((c) => c.id === selectedChildId) ?? null;

  // Load children for the active family.
  useEffect(() => {
    let mounted = true;
    if (!activeFamily) {
      setKids([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void childrenApi
      .listChildrenInFamily(activeFamily.id)
      .then((rows) => {
        if (!mounted) return;
        setKids(rows);
        setSelectedChildId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? null)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeFamily]);

  // Load the medication catalog + family brand prefs once per family.
  useEffect(() => {
    let mounted = true;
    if (!activeFamily) return;
    void nfcApi.listMedications().then((rows) => {
      if (mounted) setMedRows(rows);
    });
    void brandsApi
      .getFamilyBrandPrefs(activeFamily.id)
      .then((prefs) => {
        if (mounted) setBrandPrefs(prefs);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [activeFamily]);

  const resolvedMeds = useMemo(() => {
    const acet = pickMedForGeneric(medRows, 'acetaminophen', brandPrefs);
    const ibu = pickMedForGeneric(medRows, 'ibuprofen', brandPrefs);
    return { acetaminophen: acet, ibuprofen: ibu };
  }, [medRows, brandPrefs]);

  // Fetch dose status + last-24h doses for the selected child, per generic.
  const loadStatuses = useCallback(async () => {
    if (!selectedChild) {
      setGenericStates({ acetaminophen: null, ibuprofen: null });
      setRecentDoses([]);
      return;
    }
    const kinds: MedicationKind[] = ['acetaminophen', 'ibuprofen'];
    const next: Record<MedicationKind, GenericState | null> = { acetaminophen: null, ibuprofen: null };
    await Promise.all(
      kinds.map(async (kind) => {
        const med = resolvedMeds[kind];
        if (!med) {
          next[kind] = null;
          return;
        }
        try {
          const result = await dosesApi.getDoseStatus(selectedChild.id, med.id);
          next[kind] = { generic: kind, med, statusResult: result, loading: false };
        } catch {
          next[kind] = { generic: kind, med, statusResult: null, loading: false };
        }
      }),
    );
    setGenericStates(next);

    try {
      const doses = await dosesApi.listDosesForChild(selectedChild.id, { limit: 20 });
      const medIds = new Set([resolvedMeds.acetaminophen?.id, resolvedMeds.ibuprofen?.id].filter(Boolean));
      const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;
      setRecentDoses(
        doses.filter((d) => medIds.has(d.medication_id) && new Date(d.given_at).getTime() >= cutoff),
      );
    } catch {
      setRecentDoses([]);
    }
  }, [selectedChild, resolvedMeds]);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  // Realtime: subscribe like Home so a new dose redraws (RT-1 pattern).
  useEffect(() => {
    if (!activeFamily || kids.length === 0) return;
    const childIds = kids.map((c) => c.id);
    const dispose = realtimeApi.subscribeFamilyDoses(activeFamily.id, childIds, () => {
      void loadStatuses();
    });
    return dispose;
  }, [activeFamily, kids, loadStatuses]);

  const genericsToShow: MedicationKind[] = useMemo(
    () => (medToggle === 'both' ? ['acetaminophen', 'ibuprofen'] : [medToggle]),
    [medToggle],
  );

  const medOptions = useMemo(
    () => [
      { label: brandFor('acetaminophen', brandPrefs.acetaminophen).name, value: 'acetaminophen' as const },
      { label: brandFor('ibuprofen', brandPrefs.ibuprofen).name, value: 'ibuprofen' as const },
      { label: 'Both', value: 'both' as const },
    ],
    [brandPrefs],
  );

  // Build clock markers + arcs + captions from resolved state.
  const clockMarkers: ClockDoseMarker[] = useMemo(() => {
    return genericsToShow.flatMap((kind) => {
      const state = genericStates[kind];
      if (!state) return [];
      const accent = brandFor(kind, brandPrefs[kind]).accent;
      return recentDoses
        .filter((d) => d.medication_id === state.med.id)
        .map((d) => ({ givenAt: d.given_at, accent }));
    });
  }, [genericsToShow, genericStates, recentDoses, brandPrefs]);

  const clockArcs: ClockSafeArc[] = useMemo(() => {
    const arcs: ClockSafeArc[] = [];
    genericsToShow.forEach((kind) => {
      const state = genericStates[kind];
      if (!state || !state.statusResult) return;
      const { status, next_safe_at, last_dose_at } = state.statusResult;
      if (status !== 'early' && status !== 'recent') return;
      if (!next_safe_at) return;
      const accent = brandFor(kind, brandPrefs[kind]).accent;
      const radius =
        medToggle === 'both' ? (kind === 'acetaminophen' ? 138 : 132) : 135;
      // Arc span: derive the age-aware interval from the server's own
      // timestamps (next_safe_at - last_dose_at). medications.min_interval_hours
      // is the label floor (4h for acetaminophen) and would understate the
      // 6h window compute_dose_status enforces for children ≥6 months.
      const serverIntervalHours =
        last_dose_at != null
          ? Math.max(
              1,
              (new Date(next_safe_at).getTime() - new Date(last_dose_at).getTime()) / 3600000,
            )
          : state.med.min_interval_hours;
      arcs.push({
        nextSafeAt: next_safe_at,
        intervalHours: serverIntervalHours,
        accent,
        radius,
      });
    });
    return arcs;
  }, [genericsToShow, genericStates, brandPrefs, medToggle]);

  const captionLines = useMemo(() => {
    return genericsToShow.map((kind) => {
      const state = genericStates[kind];
      const brand = brandFor(kind, brandPrefs[kind]);
      if (!state || !state.statusResult) {
        return captionForStatus({ label: brand.name, status: 'unknown', nextSafeAt: null, hasPriorDose: false });
      }
      return captionForStatus({
        label: brand.name,
        status: state.statusResult.status,
        nextSafeAt: state.statusResult.next_safe_at,
        hasPriorDose: state.statusResult.last_dose_at != null,
      });
    });
  }, [genericsToShow, genericStates, brandPrefs]);

  // Blocking statuses (max_reached / unknown) render a message card instead
  // of implying a safe window.
  const blockingMessages = useMemo(() => {
    return genericsToShow
      .map((kind) => {
        const state = genericStates[kind];
        const brand = brandFor(kind, brandPrefs[kind]);
        if (!state || !state.statusResult) {
          return `${brand.name}: Status unavailable.`;
        }
        if (state.statusResult.status === 'max_reached') {
          const nextSafe = state.statusResult.next_safe_at;
          return `${brand.name}: 24-hour limit reached${nextSafe ? ` — next dose safe at ${new Date(nextSafe).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}.`;
        }
        if (state.statusResult.status === 'unknown') {
          return `${brand.name}: Status unavailable.`;
        }
        return null;
      })
      .filter((m): m is string => m != null);
  }, [genericsToShow, genericStates, brandPrefs]);

  const dayBarLanes: DayBarLane[] = useMemo(() => {
    return genericsToShow.map((kind) => {
      const state = genericStates[kind];
      const brand = brandFor(kind, brandPrefs[kind]);
      const doses = state ? recentDoses.filter((d) => d.medication_id === state.med.id) : [];
      let window: DayBarLane['window'] = null;
      if (state?.statusResult?.last_dose_at && state.statusResult.next_safe_at) {
        window = { fromAt: state.statusResult.last_dose_at, toAt: state.statusResult.next_safe_at };
      }
      return {
        key: kind,
        label: brand.name,
        accent: brand.accent,
        doses: doses.map((d) => ({ givenAt: d.given_at })),
        window,
      };
    });
  }, [genericsToShow, genericStates, brandPrefs, recentDoses]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      >
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xxl,
            fontWeight: '800',
            marginBottom: theme.spacing.lg,
          }}
        >
          Schedule
        </Text>

        {!activeFamily ? (
          <Card inset style={styles.emptyCard}>
            <Ionicons name="people-outline" size={36} color={t.fgMuted} style={{ marginBottom: 12 }} />
            <Text style={{ color: t.fg2, textAlign: 'center' }}>
              Start by creating or joining a family to see the dosing schedule.
            </Text>
          </Card>
        ) : kids.length === 0 ? (
          <Card inset style={styles.emptyCard}>
            <Ionicons name="body-outline" size={36} color={t.fgMuted} style={{ marginBottom: 12 }} />
            <Text style={{ color: t.fg2, textAlign: 'center' }}>
              Add a child to see their dosing schedule.
            </Text>
          </Card>
        ) : (
          <>
            {/* Child picker — avatar row, same pattern as DoseSheet recipient picker. */}
            {kids.length > 1 && (
              <View style={{ marginBottom: theme.spacing.lg }}>
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
                  Child
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                    {kids.map((child) => {
                      const active = child.id === selectedChildId;
                      return (
                        <Pressable
                          key={child.id}
                          onPress={() => setSelectedChildId(child.id)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`Select ${child.display_name}`}
                          style={{ alignItems: 'center', width: 76 }}
                        >
                          <View
                            style={{
                              borderWidth: 3,
                              borderColor: active ? t.brand : 'transparent',
                              borderRadius: 999,
                              padding: 2,
                            }}
                          >
                            <MemberAvatar
                              avatarPath={child.avatar_url}
                              initials={initialsFromName(child.display_name)}
                              tint={theme.palette.blue[500]}
                              size="lg"
                            />
                          </View>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: active ? t.fg1 : t.fg2,
                              fontSize: theme.fontSize.xs,
                              fontFamily: active ? theme.fonts.sansSemibold : theme.fonts.sans,
                              marginTop: 4,
                            }}
                          >
                            {child.display_name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Med + view toggles */}
            <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
              <Segmented
                accessibilityLabel="Medication"
                options={medOptions}
                value={medToggle}
                onChange={setMedToggle}
              />
              <Segmented
                accessibilityLabel="View"
                options={[
                  { label: 'Clock', value: 'clock' as const },
                  { label: 'Timeline', value: 'timeline' as const },
                ]}
                value={viewToggle}
                onChange={setViewToggle}
              />
            </View>

            {!selectedChild ? null : (
              <>
                {blockingMessages.length > 0 && (
                  <Card style={{ borderWidth: 1, borderColor: t.border, marginBottom: theme.spacing.lg }}>
                    {blockingMessages.map((msg, idx) => (
                      <Text
                        key={idx}
                        style={{
                          color: t.fg1,
                          fontSize: theme.fontSize.sm,
                          lineHeight: 20,
                          marginTop: idx > 0 ? 6 : 0,
                        }}
                      >
                        {msg}
                      </Text>
                    ))}
                  </Card>
                )}

                {viewToggle === 'clock' ? (
                  <View style={{ alignItems: 'center', marginBottom: theme.spacing.lg }}>
                    <DoseClock markers={clockMarkers} arcs={clockArcs} captionLines={captionLines} />
                  </View>
                ) : (
                  <View style={{ marginBottom: theme.spacing.lg }}>
                    <DoseDayBar lanes={dayBarLanes} />
                  </View>
                )}

                <DoseSafetyText style={{ textAlign: 'center' }}>
                  Cappy is a coordination tool, not medical advice. Always confirm against the
                  product label before giving a dose.
                </DoseSafetyText>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
});
