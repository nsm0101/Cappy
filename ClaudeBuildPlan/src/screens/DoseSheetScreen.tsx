import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MemberAvatar, Button, Card, DosePill, DoseSafetyText } from '@/components';
import type { ResolvedTag } from '@/api';
import {
  doses as dosesApi,
  children as childrenApi,
  allergies as allergiesApi,
  brands as brandsApi,
} from '@/api';
import { useTheme } from '@/theme';
import {
  ageMonthsFromDob,
  computeDosing,
  doseForMedication,
  resolveAgeGate,
  isAllergicToMedication,
  brandFor,
  formatClockTime,
  formatRelativeTime,
  formatTimeUntil,
  initialsFromName,
  uuidv4,
  type MedicationKind,
} from '@/lib';

const IBUPROFEN_UNDER_6_MONTHS =
  'Ibuprofen is not recommended for infants under six months. Consult your pediatrician.';
const STALE_WEIGHT_DAYS = 90;
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'DoseSheet'>;

type ResolvedChild = ResolvedTag['children'][number];

const round1 = (n: number): number => Math.round(n * 10) / 10;

const medKind = (genericName: string): MedicationKind =>
  genericName.toLowerCase() === 'ibuprofen' ? 'ibuprofen' : 'acetaminophen';

export const DoseSheetScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const { resolved } = useRoute<Rt>().params;
  const med = resolved.medication;
  const kind = medKind(med.generic_name);

  const onlyChild = resolved.children.length === 1 ? (resolved.children[0] ?? null) : null;
  const [selectedChild, setSelectedChild] = useState<ResolvedChild | null>(onlyChild);
  const [weightGrams, setWeightGrams] = useState<number | null>(null);
  const [weightRecordedAt, setWeightRecordedAt] = useState<string | null>(null);
  const [weightLoading, setWeightLoading] = useState(false);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [allergyLoading, setAllergyLoading] = useState(false);
  const [brandKey, setBrandKey] = useState<string | undefined>(undefined);
  const [logging, setLogging] = useState(false);

  // Family brand preference for this medication (drives the accent color).
  useEffect(() => {
    let mounted = true;
    void brandsApi
      .getFamilyBrandPrefs(resolved.family.id)
      .then((prefs) => {
        if (mounted) setBrandKey(prefs[med.generic_name]);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [resolved.family.id, med.generic_name]);

  const brand = brandFor(med.generic_name, brandKey);
  const accent = brand.accent;

  // Fetch the selected child's latest weight (dosing is weight-based) and
  // their allergies (to gate the recommendation).
  useEffect(() => {
    let mounted = true;
    if (!selectedChild) {
      setWeightGrams(null);
      setWeightRecordedAt(null);
      setAllergens([]);
      return;
    }
    setWeightLoading(true);
    setAllergyLoading(true);
    void childrenApi
      .getLatestWeightRecord(selectedChild.id)
      .then((rec) => {
        if (!mounted) return;
        setWeightGrams(rec?.valueGrams ?? null);
        setWeightRecordedAt(rec?.recordedAt ?? null);
      })
      .finally(() => {
        if (mounted) setWeightLoading(false);
      });
    void allergiesApi
      .listChildAllergies(selectedChild.id)
      .then((rows) => {
        if (mounted) setAllergens(rows.map((r) => r.allergen));
      })
      .finally(() => {
        if (mounted) setAllergyLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedChild]);

  const ageMonths = selectedChild ? ageMonthsFromDob(selectedChild.date_of_birth) : 0;
  const ageGate = selectedChild ? resolveAgeGate(ageMonths) : null;
  const weightKg = weightGrams != null ? weightGrams / 1000 : null;
  const allergic = isAllergicToMedication(kind, allergens);
  const weightStale =
    weightRecordedAt != null &&
    Date.now() - new Date(weightRecordedAt).getTime() > STALE_WEIGHT_DAYS * 86400 * 1000;

  const dosing = useMemo(
    () => (weightKg != null ? computeDosing(weightKg, ageMonths) : null),
    [weightKg, ageMonths],
  );
  const medDose = dosing ? doseForMedication(dosing, kind) : null;

  // Safe-to-give-now, using the age-appropriate interval from the engine.
  const safety = useMemo(() => {
    if (!medDose) return null;
    const last = selectedChild?.last_dose_at;
    if (!last) {
      return { safe: true, nextSafeAt: null as Date | null, lastAt: null as Date | null };
    }
    const lastAt = new Date(last);
    const nextSafeAt = new Date(lastAt.getTime() + medDose.intervalHours * 3600 * 1000);
    return { safe: Date.now() >= nextSafeAt.getTime(), nextSafeAt, lastAt };
  }, [medDose, selectedChild?.last_dose_at]);

  const volumeMl =
    medDose && med.concentration_mg_per_ml > 0
      ? round1(medDose.recommendedMg / med.concentration_mg_per_ml)
      : null;

  const doLog = async () => {
    if (!selectedChild || !medDose) return;
    setLogging(true);
    try {
      await dosesApi.logDose({
        id: uuidv4(),
        childId: selectedChild.id,
        medicationId: med.id,
        givenAt: new Date(),
        amountMg: medDose.recommendedMg,
        amountVolumeMl: volumeMl ?? undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not log dose.';
      Alert.alert("Couldn't log", message);
    } finally {
      setLogging(false);
    }
  };

  const handleLog = () => {
    if (!safety) return;
    if (!safety.safe && safety.nextSafeAt) {
      Alert.alert(
        'Given recently',
        `The minimum ${medDose?.intervalHours}-hour interval hasn't elapsed. The next dose is safe ${formatTimeUntil(
          safety.nextSafeAt.toISOString(),
        )} (at ${formatClockTime(safety.nextSafeAt.toISOString())}). Log anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log anyway', style: 'destructive', onPress: () => void doLog() },
        ],
      );
      return;
    }
    void doLog();
  };

  const heading = (text: string, sub?: string) => (
    <View style={{ marginBottom: theme.spacing.md }}>
      <Text
        style={{
          color: t.fg1,
          fontFamily: theme.fonts.display,
          fontSize: theme.fontSize.xxl,
          fontWeight: '800',
        }}
      >
        {text}
      </Text>
      {sub ? (
        <Text style={{ color: t.fg2, fontSize: theme.fontSize.sm, marginTop: 4 }}>{sub}</Text>
      ) : null}
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      style={{ backgroundColor: t.bg }}
    >
      <View style={styles.headerRow}>
        {heading(
          'Log a dose',
          `${brand.key !== 'generic' ? brand.name : med.brand_name ?? med.generic_name} · ${med.concentration_label}`,
        )}
        <Button label="Close" variant="ghost" onPress={() => navigation.goBack()} />
      </View>

      {/* Patient picker — avatar row with active-selection ring. */}
      {resolved.children.length > 1 && (
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
            Who's getting a dose?
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              {resolved.children.map((child) => {
                const active = selectedChild?.id === child.id;
                return (
                  <Pressable
                    key={child.id}
                    onPress={() => setSelectedChild(child)}
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

      {!selectedChild ? (
        <Card inset style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Ionicons name="people-outline" size={32} color={t.fgMuted} />
          <Text style={{ color: t.fg2, marginTop: 8, textAlign: 'center' }}>
            Select a family member above to see their dose.
          </Text>
        </Card>
      ) : weightLoading || allergyLoading ? (
        <Card inset style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ color: t.fg2 }}>Loading…</Text>
        </Card>
      ) : ageGate === 'emergency' ? (
        <Card style={{ borderWidth: 1, borderColor: t.error }}>
          <Text style={{ color: t.error, fontFamily: theme.fonts.displaySemibold, fontSize: theme.fontSize.lg, fontWeight: '700', marginBottom: 6 }}>
            Too young for self-dosing
          </Text>
          <Text style={{ color: t.fg2, lineHeight: 20 }}>
            For infants under 2 months, do not give medication at home. Contact your
            pediatrician or seek care for fever in this age group.
          </Text>
        </Card>
      ) : allergic ? (
        <Card style={{ borderWidth: 1, borderColor: t.error }}>
          <Text style={{ color: t.error, fontFamily: theme.fonts.displaySemibold, fontSize: theme.fontSize.lg, fontWeight: '700', marginBottom: 6 }}>
            Allergy on file
          </Text>
          <Text style={{ color: t.fg2, lineHeight: 20 }}>
            {selectedChild.display_name} has a recorded allergy to {med.generic_name}. Cappy
            will not recommend this medication. Remove the allergy on the child's profile if
            this is incorrect.
          </Text>
        </Card>
      ) : kind === 'ibuprofen' && ageGate === 'infant' ? (
        <Card style={{ borderWidth: 1, borderColor: t.error }}>
          <Text style={{ color: t.fg1, fontFamily: theme.fonts.displaySemibold, fontSize: theme.fontSize.lg, fontWeight: '700', marginBottom: 6 }}>
            Ibuprofen not recommended
          </Text>
          <Text style={{ color: t.fg2, lineHeight: 20 }}>{IBUPROFEN_UNDER_6_MONTHS}</Text>
        </Card>
      ) : weightKg == null ? (
        <Card style={{ borderWidth: 1, borderColor: t.border }}>
          <Text style={{ color: t.fg1, fontFamily: theme.fonts.displaySemibold, fontSize: theme.fontSize.lg, fontWeight: '700', marginBottom: 6 }}>
            Add a weight for {selectedChild.display_name}
          </Text>
          <Text style={{ color: t.fg2, lineHeight: 20, marginBottom: theme.spacing.md }}>
            Dosing is based on current weight. Add {selectedChild.display_name}'s weight to
            see a recommended dose.
          </Text>
          <Button
            label="Add weight"
            onPress={() => navigation.navigate('ChildDetail', { childId: selectedChild.id })}
            block
          />
        </Card>
      ) : medDose ? (
        <>
          <Card inset style={{ alignItems: 'center', borderTopWidth: 3, borderTopColor: accent }}>
            <Text
              style={{
                color: t.fg3,
                fontSize: theme.fontSize.xs,
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontWeight: '600',
              }}
            >
              Recommended dose
            </Text>
            <Text
              style={{
                color: accent,
                fontFamily: theme.fonts.display,
                fontSize: theme.fontSize.doseNumeral,
                lineHeight: theme.lineHeight.doseNumeral,
                fontWeight: '700',
                marginTop: 6,
                marginBottom: 2,
              }}
            >
              {volumeMl != null ? `${volumeMl} ` : `${medDose.displayMg} `}
              <Text style={{ fontSize: theme.fontSize.lg, fontFamily: theme.fonts.mono }}>
                {volumeMl != null ? 'mL' : 'mg'}
              </Text>
            </Text>
            <Text style={{ color: t.fg3, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.sm }}>
              {medDose.displayMg} mg · {medDose.frequencyLabel}
            </Text>

            {/* Safe-to-give banner */}
            <DosePill
              label={
                safety?.safe
                  ? selectedChild.last_dose_at
                    ? 'OK to give now'
                    : 'No prior dose'
                  : 'Too early'
              }
              status={safety?.safe ? 'due' : 'early'}
            />
            <View style={{ height: theme.spacing.sm }} />
            <DoseSafetyText style={{ textAlign: 'center' }}>
              {safety?.safe
                ? selectedChild.last_dose_at
                  ? `Minimum ${medDose.intervalHours}-hour interval met. Always confirm against the product label.`
                  : 'No prior dose logged. Always confirm against the product label.'
                : safety?.nextSafeAt
                  ? `Last dose too recent. Next dose is safe ${formatTimeUntil(
                      safety.nextSafeAt.toISOString(),
                    )} (at ${formatClockTime(safety.nextSafeAt.toISOString())}).`
                  : ''}
            </DoseSafetyText>
            {medDose.capped ? (
              <DoseSafetyText style={{ textAlign: 'center', marginTop: 6 }}>
                {dosing?.spacingReminder}
              </DoseSafetyText>
            ) : null}
            {weightStale && weightRecordedAt ? (
              <DoseSafetyText style={{ textAlign: 'center', marginTop: 6 }}>
                {`Weight last updated ${formatRelativeTime(
                  weightRecordedAt,
                )} — update it for an accurate dose.`}
              </DoseSafetyText>
            ) : null}
          </Card>

          <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
            <Button
              label={`Log ${volumeMl != null ? `${volumeMl} mL` : `${medDose.displayMg} mg`} now`}
              variant="blue"
              size="lg"
              onPress={handleLog}
              loading={logging}
              disabled={logging}
              block
            />
            <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} block />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
});
