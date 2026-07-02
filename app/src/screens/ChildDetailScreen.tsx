import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import { Button, Card, Field, MemberAvatar, InputSheet, RowItem, Sheet, DosePill } from '@/components';
import {
  children as childrenApi,
  doses as dosesApi,
  avatars as avatarsApi,
  allergies as allergiesApi,
  nfc as nfcApi,
  type Child,
  type DoseEventWithDetails,
  type ChildAllergy,
  type DoseStatus,
  type ResolvedTag,
} from '@/api';
import {
  pickAndCropSquareImage,
  searchAllergens,
  kgFromLbs,
  lbsFromKg,
  ageMonthsFromDob,
  getLatestBodyMassKg,
} from '@/lib';

const STALE_WEIGHT_DAYS = 90;
import { useTheme } from '@/theme';
import {
  formatClockTime,
  formatDoseAmount,
  formatRelativeTime,
  formatWeightFromGrams,
  initialsFromName,
} from '@/lib';
import type { AppStackParamList } from '@/navigation/types';

const formatAge = (dobISO: string | null): string => {
  if (!dobISO) return '';
  const ageMonths = ageMonthsFromDob(dobISO);
  if (ageMonths < 24) {
    return `${ageMonths} months old`;
  }
  const years = Math.floor(ageMonths / 12);
  return `${years} years old`;
};

const STATUS_LABEL: Record<DoseStatus, string> = {
  due: 'Due now',
  early: 'Too early',
  recent: 'Given recently',
  overdue: 'Overdue',
  max_reached: '24-hour limit reached',
  unknown: 'Status unavailable',
};

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
  const [weightRecordedAt, setWeightRecordedAt] = useState<string | null>(null);
  const [allergyList, setAllergyList] = useState<ChildAllergy[]>([]);
  const [doses, setDoses] = useState<DoseEventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');

  const [weightSheetVisible, setWeightSheetVisible] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');
  // D13: a Health-imported value seeds the weight field; the caregiver still
  // reviews it against the provenance caveat and saves through validation.
  const [healthSeed, setHealthSeed] = useState<string | null>(null);

  const handleImportFromHealth = async () => {
    const sample = await getLatestBodyMassKg();
    if (!sample || !child) {
      Alert.alert(
        'Health data unavailable',
        'No weight sample was found, or Health access is not available on this build.',
      );
      return;
    }
    const display =
      weightUnit === 'lb' ? lbsFromKg(sample.kg).toFixed(1) : sample.kg.toFixed(1);
    Alert.alert(
      'Confirm before importing',
      `Apple Health usually contains the phone owner's weight — confirm this reading (${display} ${weightUnit}, recorded ${new Date(
        sample.recordedAt,
      ).toLocaleDateString()}) is ${child.display_name}'s before saving.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use this weight', onPress: () => setHealthSeed(display) },
      ],
    );
  };
  const [nameSheetVisible, setNameSheetVisible] = useState(false);
  const [doseStatus, setDoseStatus] = useState<DoseStatus>('due');

  const loadData = useCallback(async () => {
    try {
      setErrorText('');
      const childData = await childrenApi.getChild(childId);
      setChild(childData);

      const latestWeight = await childrenApi.getLatestWeightRecord(childId);
      setWeightGrams(latestWeight?.valueGrams ?? null);
      setWeightRecordedAt(latestWeight?.recordedAt ?? null);

      const allergyRows = await allergiesApi.listChildAllergies(childId);
      setAllergyList(allergyRows);

      const doseHistory = await dosesApi.listDosesWithDetailsForChild(childId);
      setDoses(doseHistory);

      // Fetch the most recent dose status for the status pill
      try {
        const recentDoses = await dosesApi.listDosesForChild(childId, { limit: 1 });
        const lastDose = recentDoses[0];
        if (!lastDose) {
          setDoseStatus('due');
        } else {
          const result = await dosesApi.getDoseStatus(childId, lastDose.medication_id);
          setDoseStatus(result.status);
        }
      } catch {
        setDoseStatus('unknown');
      }
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

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const handleChangePhoto = async () => {
    if (!child) return;
    try {
      const picked = await pickAndCropSquareImage();
      if (!picked) return;
      setUploadingPhoto(true);
      await avatarsApi.uploadChildAvatar(child.family_id, child.id, picked.base64);
      await loadData();
    } catch (err) {
      Alert.alert('Photo upload failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [allergyQuery, setAllergyQuery] = useState('');

  // FLOW-1: manual dose logging — pick a medication, then reuse the exact
  // same DoseSheet (and its SAFE-1/2/3 checks) the NFC flow uses, by
  // building a resolved payload without a tag.
  const [medSheetVisible, setMedSheetVisible] = useState(false);
  const [meds, setMeds] = useState<ResolvedTag['medication'][]>([]);
  const [medsLoading, setMedsLoading] = useState(false);

  const handleOpenLogDose = async () => {
    setMedSheetVisible(true);
    if (meds.length === 0) {
      setMedsLoading(true);
      try {
        setMeds(await nfcApi.listMedications());
      } catch (err) {
        setMedSheetVisible(false);
        Alert.alert(
          'Could not load medications',
          err instanceof Error ? err.message : 'Try again.',
        );
      } finally {
        setMedsLoading(false);
      }
    }
  };

  const handlePickMedication = async (medication: ResolvedTag['medication']) => {
    if (!child) return;
    setMedSheetVisible(false);
    // Fetch the current safety status; fall back to 'unknown' (never 'due')
    // so the sheet stays conservative and re-checks at log time (SAFE-3).
    let status: {
      status: DoseStatus;
      last_dose_at: string | null;
      next_safe_at: string | null;
      doses_in_last_24h: number;
    } = { status: 'unknown', last_dose_at: null, next_safe_at: null, doses_in_last_24h: 0 };
    try {
      status = await dosesApi.getDoseStatus(child.id, medication.id);
    } catch {
      // keep 'unknown'
    }
    navigation.navigate('DoseSheet', {
      resolved: {
        tag: { id: 'manual', label: 'Manual entry', status: 'active' },
        family: { id: child.family_id, name: '' },
        medication,
        children: [
          {
            id: child.id,
            display_name: child.display_name,
            date_of_birth: child.date_of_birth,
            avatar_url: child.avatar_url,
            ...status,
          },
        ],
        caregivers: [],
      },
    });
  };

  const getInitialWeightDisplay = useCallback(() => {
    if (weightGrams == null) return '';
    const kg = weightGrams / 1000;
    return weightUnit === 'lb' ? lbsFromKg(kg).toFixed(1) : kg.toFixed(1);
  }, [weightGrams, weightUnit]);

  const validateWeight = useCallback((value: string): string | null => {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) {
      return `Enter a number in ${weightUnit}.`;
    }
    const [min, max] = weightUnit === 'lb' ? [4, 330] : [2, 150];
    if (num < min || num > max) {
      return "That doesn't look right — check the unit.";
    }
    return null;
  }, [weightUnit]);

  const handleUpdateWeight = useCallback(() => {
    setWeightUnit('lb');
    setWeightSheetVisible(true);
  }, []);

  const validateName = useCallback((value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Name cannot be empty.';
    }
    if (trimmed.length > 40) {
      return 'Name must be 40 characters or less.';
    }
    return null;
  }, []);

  const handleNameSubmit = useCallback(
    async (value: string) => {
      try {
        await childrenApi.updateChildName(childId, value.trim());
        await loadData();
      } catch (err) {
        Alert.alert('Could not save name', err instanceof Error ? err.message : 'Try again.');
      }
    },
    [childId, loadData],
  );

  const handleWeightSubmit = useCallback(async (value: string) => {
    const num = parseFloat(value);
    const kg = weightUnit === 'lb' ? kgFromLbs(num) : num;
    const grams = Math.round(kg * 1000);
    try {
      await childrenApi.recordWeight(childId, grams);
      await loadData();
    } catch (err) {
      Alert.alert('Could not save weight', err instanceof Error ? err.message : 'Try again.');
    }
  }, [weightUnit, childId, loadData]);

  const handleAddAllergy = async (allergen: string, label: string) => {
    try {
      await allergiesApi.addChildAllergy(childId, allergen, label);
      setShowAddAllergy(false);
      setAllergyQuery('');
      await loadData();
    } catch (err) {
      Alert.alert('Could not add allergy', err instanceof Error ? err.message : 'Try again.');
    }
  };

  const handleRemoveAllergy = (id: string, label: string) => {
    Alert.alert('Remove allergy', `Remove "${label}" from this child?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await allergiesApi.removeChildAllergy(id);
            await loadData();
          } catch (err) {
            Alert.alert('Could not remove', err instanceof Error ? err.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const weightStale =
    weightRecordedAt != null &&
    Date.now() - new Date(weightRecordedAt).getTime() > STALE_WEIGHT_DAYS * 86400 * 1000;
  const existingAllergenKeys = allergyList.map((a) => a.allergen);
  const allergySuggestions = searchAllergens(allergyQuery).filter(
    (a) => !existingAllergenKeys.includes(a.key),
  );

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
        <View style={{ width: 64 }} />

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
            <Pressable
              onPress={handleChangePhoto}
              disabled={uploadingPhoto}
              accessibilityRole="button"
              accessibilityLabel={`Change ${child.display_name}'s photo`}
            >
              <MemberAvatar
                avatarPath={child.avatar_url}
                initials={initialsFromName(child.display_name)}
                tint={theme.palette.blue[500]}
                size="lg"
              />
              <View
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  backgroundColor: t.brand,
                  borderRadius: 999,
                  padding: 5,
                  borderWidth: 2,
                  borderColor: t.bgCard,
                }}
              >
                <Ionicons
                  name={uploadingPhoto ? 'hourglass-outline' : 'camera'}
                  size={12}
                  color="#FFFFFF"
                />
              </View>
            </Pressable>
            <View style={styles.profileInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
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
                <Pressable
                  onPress={() => setNameSheetVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit name"
                >
                  <Ionicons name="pencil-outline" size={18} color={t.fg2} />
                </Pressable>
              </View>
              <Text
                style={{
                  color: t.fg3,
                  fontFamily: theme.fonts.sans,
                  fontSize: theme.fontSize.sm,
                  marginTop: 4,
                }}
              >
                {formatAge(child.date_of_birth)} · born{' '}
                {new Date(child.date_of_birth).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                <DosePill label={STATUS_LABEL[doseStatus]} status={doseStatus} />
              </View>
              <Text
                style={{
                  color: t.fg2,
                  fontFamily: theme.fonts.sans,
                  fontSize: theme.fontSize.sm,
                  marginTop: theme.spacing.sm,
                }}
              >
                Weight: {formatWeightFromGrams(weightGrams)}
              </Text>
            </View>
          </Card>
        </View>

        {/* Weight card */}
        <Card style={{ marginBottom: theme.spacing.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.fg1, fontFamily: theme.fonts.displaySemibold, fontSize: theme.fontSize.lg, fontWeight: '700' }}>
                Weight
              </Text>
              <Text style={{ color: t.fg2, fontSize: theme.fontSize.base, marginTop: 4 }}>
                {formatWeightFromGrams(weightGrams)}
                {weightRecordedAt
                  ? ` · updated ${formatRelativeTime(weightRecordedAt)}`
                  : ' · not recorded'}
              </Text>
            </View>
            <Button label="Update" variant="secondary" onPress={handleUpdateWeight} />
          </View>
          {weightStale ? (
            <Text style={{ color: t.error, fontSize: theme.fontSize.sm, marginTop: theme.spacing.sm }}>
              This weight is over {STALE_WEIGHT_DAYS} days old. Update it for accurate dosing.
            </Text>
          ) : null}
        </Card>

        {/* Allergies card */}
        <Card style={{ marginBottom: theme.spacing.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: t.fg1, fontFamily: theme.fonts.displaySemibold, fontSize: theme.fontSize.lg, fontWeight: '700' }}>
              Allergies
            </Text>
            <Button
              label={showAddAllergy ? 'Done' : 'Add'}
              variant="secondary"
              onPress={() => {
                setShowAddAllergy((s) => !s);
                setAllergyQuery('');
              }}
            />
          </View>

          {allergyList.length === 0 && !showAddAllergy ? (
            <Text style={{ color: t.fg3, fontSize: theme.fontSize.sm, marginTop: theme.spacing.sm }}>
              No allergies recorded. Cappy will not recommend a medication a child is allergic to.
            </Text>
          ) : null}

          {allergyList.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.sm }}>
              {allergyList.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => handleRemoveAllergy(a.id, a.label)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${a.label}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: t.bgInset,
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text style={{ color: t.fg1, fontSize: theme.fontSize.sm }}>{a.label}</Text>
                  <Ionicons name="close-circle" size={16} color={t.fgMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {showAddAllergy ? (
            <View style={{ marginTop: theme.spacing.md }}>
              <Field
                label="Search allergens"
                value={allergyQuery}
                onChangeText={setAllergyQuery}
                placeholder="Type to search (e.g. ibuprofen, peanut)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={{ marginTop: theme.spacing.sm, gap: 6 }}>
                {allergySuggestions.slice(0, 6).map((a) => (
                  <Pressable
                    key={a.key}
                    onPress={() => handleAddAllergy(a.key, a.label)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${a.label}`}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: t.bgInset,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: t.fg1, fontSize: theme.fontSize.base }}>{a.label}</Text>
                  </Pressable>
                ))}
                {allergySuggestions.length === 0 ? (
                  <Text style={{ color: t.fg3, fontSize: theme.fontSize.sm }}>
                    No matching allergens in the list.
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </Card>

        {/* FLOW-1: manual dose logging entry point */}
        <Button
          label="Log a dose"
          size="lg"
          onPress={() => void handleOpenLogDose()}
          block
          style={{ marginBottom: theme.spacing.xl }}
        />

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

      {/* Medication picker for manual dose logging */}
      <Sheet visible={medSheetVisible} onClose={() => setMedSheetVisible(false)}>
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.displaySemibold,
            fontSize: theme.fontSize.lg,
            fontWeight: '700',
            marginBottom: theme.spacing.md,
          }}
        >
          Choose a medication
        </Text>
        {medsLoading ? (
          <Text style={{ color: t.fg2, marginBottom: theme.spacing.md }}>Loading…</Text>
        ) : (
          <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            {meds.map((m) => (
              <RowItem
                key={m.id}
                title={m.brand_name ?? m.generic_name}
                subtitle={m.concentration_label}
                onPress={() => void handlePickMedication(m)}
              />
            ))}
          </View>
        )}
        <Button label="Cancel" variant="ghost" onPress={() => setMedSheetVisible(false)} block />
      </Sheet>

      {/* Weight input sheet */}
      <InputSheet
        visible={weightSheetVisible}
        title="Update weight"
        hint={`Enter current weight in ${weightUnit}.`}
        initialValue={healthSeed ?? getInitialWeightDisplay()}
        footer={
          <Button
            label="Import from Apple Health"
            variant="ghost"
            onPress={() => void handleImportFromHealth()}
            block
          />
        }
        placeholder={weightUnit === 'lb' ? 'e.g., 50' : 'e.g., 23'}
        keyboardType="decimal-pad"
        validate={validateWeight}
        submitLabel="Save"
        onSubmit={handleWeightSubmit}
        onClose={() => {
          setWeightSheetVisible(false);
          setHealthSeed(null);
        }}
        segments={{
          options: [
            { label: 'lb', value: 'lb' },
            { label: 'kg', value: 'kg' },
          ],
          value: weightUnit,
          onChange: (v) => {
            setWeightUnit(v as 'lb' | 'kg');
            // A Health-imported seed is unit-specific — clear on toggle.
            setHealthSeed(null);
          },
        }}
      />

      {/* Name edit input sheet */}
      <InputSheet
        visible={nameSheetVisible}
        title="Edit name"
        initialValue={child?.display_name ?? ''}
        placeholder="Enter child's name"
        keyboardType="default"
        validate={validateName}
        submitLabel="Save"
        onSubmit={handleNameSubmit}
        onClose={() => setNameSheetVisible(false)}
      />
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
