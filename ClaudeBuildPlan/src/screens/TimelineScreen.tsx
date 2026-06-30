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
import { Avatar, Card } from '@/components';
import {
  families as familiesApi,
  children as childrenApi,
  doses as dosesApi,
  type FamilyWithRole,
  type DoseEventWithDetails,
} from '@/api';
import { useTheme } from '@/theme';
import {
  formatClockTime,
  formatDoseAmount,
  formatRelativeTime,
  initialsFromName,
} from '@/lib';

export const TimelineScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;

  const [activeFamily, setActiveFamily] = useState<FamilyWithRole | null>(null);
  const [doses, setDoses] = useState<DoseEventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');

  const loadTimeline = useCallback(async () => {
    try {
      setErrorText('');
      const fams = await familiesApi.listMyFamilies();
      if (fams.length === 0) {
        setActiveFamily(null);
        setDoses([]);
        return;
      }
      
      const family = fams[0];
      if (!family) return;
      setActiveFamily(family);

      const kids = await childrenApi.listChildrenInFamily(family.id);
      if (kids.length === 0) {
        setDoses([]);
        return;
      }

      const childIds = kids.map((k) => k.id);
      const doseHistory = await dosesApi.listDosesWithDetailsForFamily(childIds);
      setDoses(doseHistory);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not load timeline.');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadTimeline();
      setLoading(false);
    })();
  }, [loadTimeline]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTimeline();
    setRefreshing(false);
  };

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
              No doses logged yet in this family. Program an NFC tag or tap Scan on child profile to begin.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {doses.map((dose) => {
              const formattedDose = formatDoseAmount({
                formulation: dose.medication.formulation,
                amountMg: dose.amount_mg,
                amountVolumeMl: dose.amount_volume_ml,
                unitCount: dose.unit_count,
              });

              const childName = dose.children?.display_name ?? 'Child';
              const medicationName = dose.medication.brand_name ?? dose.medication.generic_name;
              const loggerName = dose.profiles?.display_name ?? 'Caregiver';
              const isSuperseded = dose.status === 'superseded';

              return (
                <Card
                  key={dose.id}
                  style={[
                    styles.doseCard,
                    isSuperseded && { opacity: 0.5, backgroundColor: t.bgMuted },
                  ]}
                >
                  <View style={styles.doseHeader}>
                    <View style={styles.childInfoCol}>
                      <Avatar
                        initials={initialsFromName(childName)}
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
                          {childName}
                        </Text>
                        <Text
                          style={{
                            color: t.fg3,
                            fontFamily: theme.fonts.sans,
                            fontSize: theme.fontSize.xs,
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
        )}
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
