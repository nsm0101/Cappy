import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MemberAvatar, Button, Card, DosePill, DoseSafetyText, Field } from '@/components';
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
type ResolvedCaregiver = ResolvedTag['caregivers'][number];

/** A dose recipient is either a child (weight/age dosing engine) or an
 * adult caregiver (manual entry — see the module doc below). */
type Recipient =
  | { kind: 'child'; child: ResolvedChild }
  | { kind: 'caregiver'; caregiver: ResolvedCaregiver };

const recipientKey = (r: Recipient): string => (r.kind === 'child' ? r.child.id : r.caregiver.id);
const recipientName = (r: Recipient): string =>
  r.kind === 'child' ? r.child.display_name : r.caregiver.display_name ?? 'Caregiver';
const recipientAvatarUrl = (r: Recipient): string | null =>
  r.kind === 'child' ? r.child.avatar_url : r.caregiver.avatar_url;

const CAREGIVER_STATUS_LABEL: Record<ResolvedCaregiver['status'], string> = {
  due: 'OK to give now',
  early: 'Too early',
  recent: 'Given recently',
  overdue: 'Window passed — check before giving',
  max_reached: '24-hour limit reached',
  unknown: 'Status unavailable',
};

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

  const recipients: Recipient[] = useMemo(
    () => [
      ...resolved.children.map((child): Recipient => ({ kind: 'child', child })),
      ...resolved.caregivers.map((caregiver): Recipient => ({ kind: 'caregiver', caregiver })),
    ],
    [resolved.children, resolved.caregivers],
  );

  const onlyRecipient = recipients.length === 1 ? (recipients[0] ?? null) : null;
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(onlyRecipient);
  const selectedChild = selectedRecipient?.kind === 'child' ? selectedRecipient.child : null;
  const selectedCaregiver = selectedRecipient?.kind === 'caregiver' ? selectedRecipient.caregiver : null;

  const [weightGrams, setWeightGrams] = useState<number | null>(null);
  const [weightRecordedAt, setWeightRecordedAt] = useState<string | null>(null);
  const [weightLoading, setWeightLoading] = useState(false);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [allergyLoading, setAllergyLoading] = useState(false);
  const [brandKey, setBrandKey] = useState<string | undefined>(undefined);
  const [logging, setLogging] = useState(false);
  const [manualAmountMg, setManualAmountMg] = useState('');

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
  // their allergies (to gate the recommendation). Caregivers don't go
  // through this — see the manual-entry path below.
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

  // SAFE-2: timing comes from the server (compute_dose_status, via the
  // resolved payload) so the Home pill and this sheet can never disagree.
  // The dosing engine still owns the *amount* (mg/mL); the server owns
  // the *clock* (age-aware interval + 24h cap).
  const safety = useMemo(() => {
    if (!selectedChild) return null;
    const lastAt = selectedChild.last_dose_at ? new Date(selectedChild.last_dose_at) : null;
    const nextSafeAt = selectedChild.next_safe_at ? new Date(selectedChild.next_safe_at) : null;
    const safe = selectedChild.status === 'due' || selectedChild.status === 'overdue';
    return { safe, nextSafeAt, lastAt };
  }, [selectedChild]);
  const maxReached = selectedChild?.status === 'max_reached';

  const volumeMl =
    medDose && med.concentration_mg_per_ml > 0
      ? round1(medDose.recommendedMg / med.concentration_mg_per_ml)
      : null;

  const manualAmountValue = parseFloat(manualAmountMg);
  const manualAmountValid = Number.isFinite(manualAmountValue) && manualAmountValue > 0;

  /**
   * SAFE-3: `force` skips the fresh status re-check — only set after the
   * caregiver has explicitly confirmed an override. The default path
   * re-runs compute_dose_status immediately before the insert to close
   * the two-caregiver race (the resolved payload is a scan-time snapshot).
   */
  const doLog = async (force = false) => {
    if (!selectedRecipient) return;
    setLogging(true);
    try {
      if (selectedRecipient.kind === 'child') {
        if (!medDose) return;
        if (!force) {
          try {
            const fresh = await dosesApi.getDoseStatus(selectedRecipient.child.id, med.id);
            if (fresh.status === 'early' || fresh.status === 'recent' || fresh.status === 'max_reached') {
              setLogging(false);
              Alert.alert(
                'A dose was just logged',
                fresh.status === 'max_reached'
                  ? 'This child has reached the 24-hour maximum for this medication. Log anyway?'
                  : `Another caregiver logged a dose ${
                      fresh.last_dose_at ? formatRelativeTime(fresh.last_dose_at) : 'moments ago'
                    }.${
                      fresh.next_safe_at
                        ? ` The next dose is safe ${formatTimeUntil(fresh.next_safe_at)} (at ${formatClockTime(fresh.next_safe_at)}).`
                        : ''
                    } Log anyway?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log anyway', style: 'destructive', onPress: () => void doLog(true) },
                ],
              );
              return;
            }
          } catch {
            // Status check unavailable (offline etc.) — proceed; the insert
            // itself is still RLS-guarded and the sheet showed scan-time state.
          }
        }
        await dosesApi.logDose({
          id: uuidv4(),
          childId: selectedRecipient.child.id,
          familyId: resolved.family.id,
          medicationId: med.id,
          givenAt: new Date(),
          amountMg: medDose.recommendedMg,
          amountVolumeMl: volumeMl ?? undefined,
        });
      } else {
        if (!manualAmountValid) return;
        await dosesApi.logDose({
          id: uuidv4(),
          caregiverUserId: selectedRecipient.caregiver.id,
          familyId: resolved.family.id,
          medicationId: med.id,
          givenAt: new Date(),
          amountMg: manualAmountValue,
        });
      }
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
    if (!selectedRecipient) return;
    if (selectedRecipient.kind === 'child') {
      if (!safety) return;
      if (!safety.safe && safety.nextSafeAt) {
        Alert.alert(
          'Given recently',
          `The minimum ${medDose?.intervalHours}-hour interval hasn't elapsed. The next dose is safe ${formatTimeUntil(
            safety.nextSafeAt.toISOString(),
          )} (at ${formatClockTime(safety.nextSafeAt.toISOString())}). Log anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log anyway', style: 'destructive', onPress: () => void doLog(true) },
          ],
        );
        return;
      }
      void doLog();
    } else {
      if (!manualAmountValid) return;
      const caregiver = selectedRecipient.caregiver;
      if (caregiver.status === 'early' || caregiver.status === 'recent' || caregiver.status === 'max_reached') {
        Alert.alert(
          'Given recently',
          caregiver.next_safe_at
            ? `${caregiver.display_name ?? 'This person'} logged a dose recently. The next dose is safe ${formatTimeUntil(
                caregiver.next_safe_at,
              )} (at ${formatClockTime(caregiver.next_safe_at)}). Log anyway?`
            : `${caregiver.display_name ?? 'This person'} logged a dose recently. Log anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log anyway', style: 'destructive', onPress: () => void doLog() },
          ],
        );
        return;
      }
      void doLog();
    }
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

      {/* Recipient picker — avatar row with active-selection ring. Includes
          both children and adult caregivers, since either can be a dose
          recipient through the same NFC-tag-tap flow. */}
      {recipients.length > 1 && (
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
            Who&apos;s getting a dose?
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              {recipients.map((recipient) => {
                const active = selectedRecipient ? recipientKey(selectedRecipient) === recipientKey(recipient) : false;
                const name = recipientName(recipient);
                return (
                  <Pressable
                    key={`${recipient.kind}:${recipientKey(recipient)}`}
                    onPress={() => setSelectedRecipient(recipient)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Select ${name}`}
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
                        avatarPath={recipientAvatarUrl(recipient)}
                        initials={initialsFromName(name)}
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
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {!selectedRecipient ? (
        <Card inset style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Ionicons name="people-outline" size={32} color={t.fgMuted} />
          <Text style={{ color: t.fg2, marginTop: 8, textAlign: 'center' }}>
            Select a family member above to see their dose.
          </Text>
        </Card>
      ) : selectedCaregiver ? (
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
              Current status
            </Text>
            <View style={{ marginTop: 8 }}>
              <DosePill
                label={CAREGIVER_STATUS_LABEL[selectedCaregiver.status]}
                status={selectedCaregiver.status}
              />
            </View>
            <DoseSafetyText style={{ textAlign: 'center', marginTop: theme.spacing.sm }}>
              {selectedCaregiver.last_dose_at
                ? `Last dose ${formatRelativeTime(selectedCaregiver.last_dose_at)}.`
                : 'No prior dose logged.'}{' '}
              Cappy doesn&apos;t calculate an adult dose — enter the amount from the product label.
            </DoseSafetyText>
          </Card>

          <View style={{ marginTop: theme.spacing.lg }}>
            <Field
              label="Amount taken (mg)"
              placeholder="e.g. 500"
              keyboardType="decimal-pad"
              value={manualAmountMg}
              onChangeText={setManualAmountMg}
              hint={`${med.brand_name ?? med.generic_name} — check the product label for the correct adult dose.`}
            />
          </View>

          <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
            <Button
              label="Log dose now"
              variant="blue"
              size="lg"
              onPress={handleLog}
              loading={logging}
              disabled={logging || !manualAmountValid}
              block
            />
            <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} block />
          </View>
        </>
      ) : !selectedChild ? null : weightLoading || allergyLoading ? (
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
            will not recommend this medication. Remove the allergy on the child&apos;s profile if
            this is incorrect.
          </Text>
        </Card>
      ) : maxReached ? (
        <Card style={{ borderWidth: 1, borderColor: t.error }}>
          <Text style={{ color: t.error, fontFamily: theme.fonts.displaySemibold, fontSize: theme.fontSize.lg, fontWeight: '700', marginBottom: 6 }}>
            24-hour limit reached
          </Text>
          <Text style={{ color: t.fg2, lineHeight: 20 }}>
            {`${selectedChild.display_name} has had ${selectedChild.doses_in_last_24h} dose${
              selectedChild.doses_in_last_24h === 1 ? '' : 's'
            } of ${med.generic_name} in the last 24 hours — the maximum is ${med.max_doses_per_24h}.${
              selectedChild.next_safe_at
                ? ` The next dose is safe ${formatTimeUntil(selectedChild.next_safe_at)} (at ${formatClockTime(selectedChild.next_safe_at)}).`
                : ''
            } If fever or pain persists, contact your pediatrician.`}
          </Text>
          {medDose ? (
            <View style={{ marginTop: theme.spacing.md }}>
              <Button
                label="Log anyway"
                variant="ghost"
                onPress={() =>
                  Alert.alert(
                    'Exceed the 24-hour maximum?',
                    'Only log this if the dose was actually given. This exceeds the labeled daily limit.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Log anyway', style: 'destructive', onPress: () => void doLog(true) },
                    ],
                  )
                }
                block
              />
            </View>
          ) : null}
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
            Dosing is based on current weight. Add {selectedChild.display_name}&apos;s weight to
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
            <DoseSafetyText style={{ textAlign: 'center', marginTop: 6 }}>
              {`${selectedChild.doses_in_last_24h} of ${med.max_doses_per_24h} doses in the last 24 hours.`}
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
