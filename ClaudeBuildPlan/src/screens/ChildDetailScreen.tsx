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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, Card } from '@/components';
import {
  children as childrenApi,
  doses as dosesApi,
  type Child,
  type DoseEventWithDetails,
} from '@/api';
import { useTheme } from '@/theme';
import {
  formatClockTime,
  formatDoseAmount,
  formatRelativeTime,
  formatWeightFromGrams,
  initialsFromName,
} from '@/lib';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'ChildDetail'>;

export const ChildDetailScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { childId } = route.params;

  const [child, setChild] = useState<Child | null>(null);
  const [weightGrams, setWeightGrams] = useState<number | null>(null);
  const [doses, setDoses] = useState<DoseEventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');

  const loadData = useCallback(async () => {
    try {
      setErrorText('');
      const childData = await childrenApi.getChild(childId);
      setChild(childData);

      const latestWeight = await childrenApi.getLatestWeight(childId);
      setWeightGrams(latestWeight);

      const doseHistory = await dosesApi.listDosesWithDetailsForChild(childId);
      setDoses(doseHistory);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not load details.');
    }
  }, [childId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.brand} />
      </SafeAreaView>
    );
  }

  if (errorText || !child) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={t.error} />
          <Text style={[styles.errorTitle, { color: t.fg1, fontFamily: theme.fonts.display }]}>
            {"Couldn't load child details"}
          </Text>
          <Text style={[styles.errorSubtitle, { color: t.fg2, fontFamily: theme.fonts.sans }]}>
            {errorText || 'The child record could not be found.'}
          </Text>
          <Button label="Retry" onPress={loadData} style={{ marginTop: 16 }} />
          <Button label="Go Back" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 8 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      {/* Header bar */}
      <View style={[styles.headerRow, { paddingHorizontal: theme.spacing.lg }]}>
        <Button
          label="Back"
          variant="ghost"
          leftIcon={<Ionicons name="chevron-back" size={20} color={t.fg2} />}
          onPress={() => navigation.goBack()}
        />
        <Text style={[styles.headerTitle, { color: t.fg1, fontFamily: theme.fonts.displaySemibold }]}>
          Child Profile
        </Text>
        <View style={{ width: 64 }} /> {/* Spacer */}
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
        {/* Child Profile Card */}
        <View style={{ marginBottom: theme.spacing.xl }}>
          <Card style={styles.profileCard}>
            <Avatar
              initials={initialsFromName(child.display_name)}
              tint={theme.palette.blue[500]}
              size="lg"
            />
            <View style={styles.profileInfo}>
              <Text
                style={{
                  color: t.fg1,
                  fontFamily: theme.fonts.display,
                  fontSize: theme.fontSize.xxl,
                  fontWeight: '800',
                }}
              >
                {child.display_name}
              </Text>
              <Text
                style={{
                  color: t.fg2,
                  fontFamily: theme.fonts.sans,
                  fontSize: theme.fontSize.sm,
                  marginTop: 4,
                }}
              >
                Weight: {formatWeightFromGrams(weightGrams)}
              </Text>
            </View>
          </Card>
        </View>

        {/* Dose History Title */}
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.displaySemibold,
            fontSize: theme.fontSize.lg,
            fontWeight: '700',
            marginBottom: theme.spacing.md,
          }}
        >
          Dose History
        </Text>

        {/* Dose History List */}
        {doses.length === 0 ? (
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
              No doses logged yet. Program an NFC tag or tap Scan to register a medication dose.
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
                    <View>
                      <Text
                        style={{
                          color: t.fg1,
                          fontFamily: theme.fonts.sansSemibold,
                          fontSize: theme.fontSize.base,
                          fontWeight: '600',
                        }}
                      >
                        {medicationName}
                      </Text>
                      <Text
                        style={{
                          color: t.fg3,
                          fontFamily: theme.fonts.sans,
                          fontSize: theme.fontSize.xs,
                          marginTop: 2,
                        }}
                      >
                        {formatClockTime(dose.given_at)} · {formatRelativeTime(dose.given_at)}
                      </Text>
                    </View>
                    <View style={styles.doseAmountCol}>
                      <Text
                        style={{
                          color: t.accent2,
                          fontFamily: theme.fonts.display,
                          fontSize: theme.fontSize.xl,
                          fontWeight: '700',
                        }}
                      >
                        {formattedDose.primary}
                      </Text>
                      {formattedDose.secondary ? (
                        <Text
                          style={{
                            color: t.fg3,
                            fontFamily: theme.fonts.mono,
                            fontSize: theme.fontSize.xs,
                            marginTop: 2,
                          }}
                        >
                          {formattedDose.secondary}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.doseFooter,
                      { borderTopColor: t.border, marginTop: theme.spacing.sm },
                    ]}
                  >
                    <Text style={{ color: t.fg3, fontSize: theme.fontSize.xs }}>
                      Logged by {loggerName}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
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
    alignItems: 'flex-start',
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
