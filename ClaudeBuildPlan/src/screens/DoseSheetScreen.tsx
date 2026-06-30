import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar, Button, Card, DosePill, DoseSafetyText, RowItem } from '@/components';
import type { ResolvedTag } from '@/api';
import { doses as dosesApi } from '@/api';
import { useTheme } from '@/theme';
import { formatRelativeTime, initialsFromName, uuidv4 } from '@/lib';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'DoseSheet'>;

type ResolvedChild = ResolvedTag['children'][number];

const statusLabel = (status: ResolvedChild['status']): string =>
  status === 'due'
    ? 'Due now'
    : status === 'recent'
      ? 'Given recently'
      : status === 'early'
        ? 'Too early'
        : 'Overdue';

const safetyMessage = (child: ResolvedChild): string => {
  if (child.status === 'due' && !child.last_dose_at) {
    return 'No prior dose logged today. Always confirm against the product label.';
  }
  if (child.status === 'due') {
    return `Last dose ${formatRelativeTime(child.last_dose_at)}. Minimum interval met. Confirm against the product label.`;
  }
  if (child.status === 'recent') {
    return `Last dose ${formatRelativeTime(child.last_dose_at)}. A dose was given very recently — double-check before logging.`;
  }
  if (child.status === 'early') {
    return `Last dose ${formatRelativeTime(child.last_dose_at)}. Minimum interval has not elapsed.`;
  }
  return `Last dose ${formatRelativeTime(child.last_dose_at)}. This is much later than expected — consider whether a dose was missed.`;
};

/**
 * Suggested dose default: 5 mL for liquid acetaminophen. This is a
 * naive default for alpha — the real product computes from weight.
 */
const suggestedDose = (
  resolved: ResolvedTag,
): { amountMg: number; amountVolumeMl: number | null; unitCount: number | null } => {
  const med = resolved.medication;
  if (med.formulation === 'liquid_suspension' || med.formulation === 'infant_drops') {
    const ml = 5;
    return { amountMg: ml * med.concentration_mg_per_ml, amountVolumeMl: ml, unitCount: null };
  }
  return { amountMg: 160, amountVolumeMl: null, unitCount: 1 };
};

export const DoseSheetScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const { resolved } = useRoute<Rt>().params;

  const onlyChild = resolved.children.length === 1 ? (resolved.children[0] ?? null) : null;
  const [selectedChild, setSelectedChild] = useState<ResolvedChild | null>(onlyChild);
  const [logging, setLogging] = useState(false);

  const dose = useMemo(() => suggestedDose(resolved), [resolved]);
  const med = resolved.medication;

  const handleLog = async () => {
    if (!selectedChild) return;
    setLogging(true);
    try {
      const id = uuidv4();
      await dosesApi.logDose({
        id,
        childId: selectedChild.id,
        medicationId: med.id,
        givenAt: new Date(),
        amountMg: dose.amountMg,
        amountVolumeMl: dose.amountVolumeMl ?? undefined,
        unitCount: dose.unitCount ?? undefined,
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

  if (!selectedChild) {
    // Multi-child: show picker
    return (
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg }}
        style={{ backgroundColor: t.bg }}
      >
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xxl,
            fontWeight: '800',
            marginBottom: theme.spacing.sm,
          }}
        >
          {"Who's getting a dose?"}
        </Text>
        <Text style={{ color: t.fg2, marginBottom: theme.spacing.lg }}>
          {med.brand_name ?? med.generic_name}
        </Text>
        <View style={{ gap: theme.spacing.md }}>
          {resolved.children.map((child: ResolvedChild) => (
            <RowItem
              key={child.id}
              title={child.display_name}
              subtitle={
                child.last_dose_at
                  ? `Last dose ${formatRelativeTime(child.last_dose_at)}`
                  : 'No doses yet'
              }
              leftSlot={
                <Avatar
                  initials={initialsFromName(child.display_name)}
                  tint={theme.palette.blue[500]}
                />
              }
              rightSlot={<DosePill label={statusLabel(child.status)} status={child.status} />}
              onPress={() => setSelectedChild(child)}
              showChevron={false}
            />
          ))}
        </View>
        <View style={{ height: theme.spacing.lg }} />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => navigation.goBack()}
          block
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.lg }}
      style={{ backgroundColor: t.bg }}
    >
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Avatar
            initials={initialsFromName(selectedChild.display_name)}
            tint={theme.palette.blue[500]}
            size="lg"
          />
          <View>
            <Text
              style={{
                color: t.fg1,
                fontFamily: theme.fonts.display,
                fontSize: theme.fontSize.xl,
                fontWeight: '700',
              }}
            >
              {selectedChild.display_name}
            </Text>
            <Text style={{ color: t.fg3, fontSize: theme.fontSize.sm }}>
              {med.brand_name ?? med.generic_name}
            </Text>
          </View>
        </View>
        <Button label="Close" variant="ghost" onPress={() => navigation.goBack()} />
      </View>

      <Card inset style={{ marginTop: theme.spacing.lg, alignItems: 'center' }}>
        <Text
          style={{
            color: t.fg3,
            fontSize: theme.fontSize.xs,
            letterSpacing: 1,
            textTransform: 'uppercase',
            fontWeight: '600',
          }}
        >
          Suggested dose
        </Text>
        <Text
          style={{
            color: t.accent2,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.doseNumeral,
            lineHeight: theme.lineHeight.doseNumeral,
            fontWeight: '700',
            marginTop: 6,
            marginBottom: 2,
          }}
        >
          {dose.amountVolumeMl != null
            ? `${dose.amountVolumeMl} `
            : dose.unitCount != null
              ? `${dose.unitCount} `
              : `${dose.amountMg} `}
          <Text style={{ fontSize: theme.fontSize.lg, fontFamily: theme.fonts.mono }}>
            {dose.amountVolumeMl != null
              ? 'mL'
              : dose.unitCount != null
                ? selectedChild && med.formulation === 'chewable'
                  ? 'chewable'
                  : 'tablet'
                : 'mg'}
          </Text>
        </Text>
        <DosePill label={statusLabel(selectedChild.status)} status={selectedChild.status} />
        <View style={{ height: theme.spacing.md }} />
        <DoseSafetyText style={{ textAlign: 'center' }}>
          {safetyMessage(selectedChild)}
        </DoseSafetyText>
      </Card>

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
        <Button
          label={`Log ${
            dose.amountVolumeMl != null
              ? `${dose.amountVolumeMl} mL`
              : dose.unitCount != null
                ? `${dose.unitCount}`
                : `${dose.amountMg} mg`
          } now`}
          variant="blue"
          size="lg"
          onPress={handleLog}
          loading={logging}
          disabled={logging}
          block
        />
        <Button label="Adjust amount" variant="secondary" onPress={() => Alert.alert('Adjust amount', 'Not yet implemented in alpha.')} block />
        <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} block />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
