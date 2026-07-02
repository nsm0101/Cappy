import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MemberAvatar, Button, Card, DosePill, RowItem, Sheet, Wordmark, OnboardingSteps } from '@/components';
import {
  children as childrenApi,
  doses as dosesApi,
  realtime as realtimeApi,
  profiles as profilesApi,
} from '@/api';
import type { Child, DoseStatus } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme';
import { useActiveFamily } from '@/family/ActiveFamilyContext';
import {
  formatRelativeTime,
  formatWeightFromGrams,
  initialsFromName,
} from '@/lib';
import type { AppStackParamList } from '@/navigation/types';

type ChildWithStatus = Child & {
  status: DoseStatus;
  lastDoseAt: string | null;
  weightGrams: number | null;
};

type Nav = NativeStackNavigationProp<AppStackParamList>;

const STATUS_LABEL: Record<DoseStatus, string> = {
  due: 'Due now',
  early: 'Too early',
  recent: 'Given recently',
  overdue: 'Overdue',
  max_reached: '24-hour limit reached',
  unknown: 'Status unavailable',
};

export const HomeScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { families, activeFamily, loading: familiesLoading, refreshFamilies, setActiveFamily } =
    useActiveFamily();

  const [childrenList, setChildrenList] = useState<ChildWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [familySwitcherVisible, setFamilySwitcherVisible] = useState(false);

  const loadChildren = useCallback(async (familyId: string) => {
    try {
      const kids = await childrenApi.listChildrenInFamily(familyId);
      // For each child + the alpha medication, compute dose status.
      // Alpha simplification: there's one default medication. We'll
      // need to extend this when families have multiple meds.
      const enriched: ChildWithStatus[] = await Promise.all(
        kids.map(async (child) => {
          try {
            // Status reflects the most recently dosed medication, computed
            // server-side by the compute_dose_status RPC (real interval/
            // caps), not a time heuristic.
            const recent = await dosesApi.listDosesForChild(child.id, { limit: 1 });
            const last = recent[0];
            const weight = await childrenApi.getLatestWeight(child.id);
            let status: DoseStatus = 'due';
            if (last) {
              try {
                const result = await dosesApi.getDoseStatus(child.id, last.medication_id);
                status = result.status;
              } catch {
                status = 'unknown';
              }
            }
            return {
              ...child,
              status,
              lastDoseAt: last?.given_at ?? null,
              weightGrams: weight,
            };
          } catch {
            return { ...child, status: 'unknown', lastDoseAt: null, weightGrams: null };
          }
        }),
      );
      setChildrenList(enriched);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('listChildrenInFamily error', err);
    }
  }, []);

  useEffect(() => {
    void profilesApi.getMyDisplayName().then(setDisplayName).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(familiesLoading);
  }, [familiesLoading]);

  useEffect(() => {
    if (activeFamily) {
      void loadChildren(activeFamily.id);
    }
  }, [activeFamily, loadChildren]);

  // RT-1: live updates. Subscribe to dose_events for the active family's
  // children; when any caregiver logs a dose, refetch so Home reflects it
  // without a manual pull-to-refresh. Re-subscribes if the family or the
  // set of children changes.
  const childIdsKey = childrenList.map((c) => c.id).join(',');
  useEffect(() => {
    if (!activeFamily || childIdsKey.length === 0) return;
    const childIds = childIdsKey.split(',');
    const familyId = activeFamily.id;
    const dispose = realtimeApi.subscribeFamilyDoses(familyId, childIds, () => {
      void loadChildren(familyId);
    });
    return dispose;
  }, [activeFamily, childIdsKey, loadChildren]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshFamilies();
    if (activeFamily) await loadChildren(activeFamily.id);
    setRefreshing(false);
  };

  const who = displayName ?? user?.email?.split('@')[0] ?? null;

  // D9: Onboarding complete when all four steps are done
  const shouldHideOnboarding = () => {
    if (families.length === 0) return true;
    if (childrenList.length === 0) return true;
    if (!childrenList.some((c) => c.weightGrams !== null)) return true;
    if (!childrenList.some((c) => c.lastDoseAt !== null)) return true;
    return false;
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
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxxl,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.brand} />
        }
      >
        <View style={styles.headerRow}>
          <Wordmark size={24} />
        </View>

        <Text
          style={{
            color: t.fg2,
            fontSize: theme.fontSize.sm,
            marginTop: theme.spacing.lg,
          }}
        >
          {`Welcome back${who ? `, ${who}` : ''}.`}
        </Text>

        {/* D9: Onboarding checklist — show when signed in, loading complete, and any step incomplete */}
        {user && !loading && families.length > 0 && !shouldHideOnboarding() && (
          <View style={{ marginTop: theme.spacing.lg }}>
            <OnboardingSteps
              hasFamily={families.length > 0}
              hasChild={childrenList.length > 0}
              hasWeight={childrenList.some((c) => c.weightGrams !== null)}
              hasDose={childrenList.some((c) => c.lastDoseAt !== null)}
              onCreateFamily={() => navigation.navigate('CreateFamily')}
              onAddChild={() => {
                if (activeFamily) {
                  navigation.navigate('AddChild', { familyId: activeFamily.id });
                }
              }}
              onAddWeight={() => {
                const firstWithoutWeight = childrenList.find((c) => c.weightGrams === null);
                if (firstWithoutWeight) {
                  navigation.navigate('ChildDetail', { childId: firstWithoutWeight.id });
                }
              }}
              onLogDose={() => navigation.navigate('ScanTab')}
            />
          </View>
        )}

        {families.length === 0 ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <Card>
              <Text
                style={{
                  color: t.fg1,
                  fontFamily: theme.fonts.displaySemibold,
                  fontSize: theme.fontSize.xl,
                  fontWeight: '700',
                  marginBottom: theme.spacing.sm,
                }}
              >
                Start a family
              </Text>
              <Text
                style={{ color: t.fg2, fontSize: theme.fontSize.sm, lineHeight: 20 }}
              >
                Create your first family to start tracking doses. You can invite other
                caregivers afterwards with a 6-digit code.
              </Text>
              <View style={{ height: theme.spacing.base }} />
              <Button
                label="Create a family"
                onPress={() => navigation.navigate('CreateFamily')}
                block
              />
              <View style={{ height: theme.spacing.sm }} />
              <Button
                label="Join with code"
                variant="secondary"
                onPress={() => navigation.navigate('AcceptInvite')}
                block
              />
            </Card>
          </View>
        ) : (
          <>
            {activeFamily && (
              <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.base }}>
                {families.length > 1 ? (
                  <Pressable
                    onPress={() => setFamilySwitcherVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Switch family"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.base }}
                  >
                    <Text
                      style={{
                        color: t.fg1,
                        fontFamily: theme.fonts.display,
                        fontSize: theme.fontSize.xxl,
                        fontWeight: '800',
                      }}
                    >
                      {activeFamily.name}
                    </Text>
                    <Ionicons name="chevron-down" size={24} color={t.fg1} />
                  </Pressable>
                ) : (
                  <Text
                    style={{
                      color: t.fg1,
                      fontFamily: theme.fonts.display,
                      fontSize: theme.fontSize.xxl,
                      fontWeight: '800',
                    }}
                  >
                    {activeFamily.name}
                  </Text>
                )}
              </View>
            )}

            {childrenList.length === 0 ? (
              <Card>
                <Text style={{ color: t.fg2, marginBottom: theme.spacing.md }}>
                  No children added yet.
                </Text>
                <Button
                  label="Add a child"
                  onPress={() =>
                    activeFamily &&
                    navigation.navigate('AddChild', { familyId: activeFamily.id })
                  }
                  block
                />
              </Card>
            ) : (
              <>
              <View style={{ gap: theme.spacing.md }}>
                {childrenList.map((child) => (
                  <RowItem
                    key={child.id}
                    title={child.display_name}
                    subtitle={`${formatWeightFromGrams(child.weightGrams)} · ${
                      child.lastDoseAt
                        ? `last dose ${formatRelativeTime(child.lastDoseAt)}`
                        : 'no doses logged'
                    }`}
                    leftSlot={
                      <MemberAvatar
                        avatarPath={child.avatar_url}
                        initials={initialsFromName(child.display_name)}
                        tint={theme.palette.blue[500]}
                      />
                    }
                    rightSlot={
                      <DosePill
                        label={STATUS_LABEL[child.status]}
                        status={child.status}
                      />
                    }
                    onPress={() =>
                      navigation.navigate('ChildDetail', { childId: child.id })
                    }
                    showChevron={false}
                  />
                ))}
              </View>
              <View style={{ height: theme.spacing.md }} />
              <Button
                label="Add a child"
                variant="secondary"
                onPress={() =>
                  activeFamily &&
                  navigation.navigate('AddChild', { familyId: activeFamily.id })
                }
                block
              />
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Family Switcher Sheet */}
      <Sheet visible={familySwitcherVisible} onClose={() => setFamilySwitcherVisible(false)}>
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xl,
            fontWeight: '700',
            marginBottom: theme.spacing.md,
          }}
        >
          Switch family
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          {families.map((fam) => (
            <RowItem
              key={fam.id}
              title={fam.name}
              subtitle={
                fam.my_role === 'admin'
                  ? 'Admin'
                  : fam.my_role === 'caregiver'
                    ? 'Caregiver'
                    : fam.my_role === 'readonly'
                      ? 'Read-only'
                      : 'Guest'
              }
              rightSlot={
                activeFamily?.id === fam.id ? <Ionicons name="checkmark" size={20} color={t.brand} /> : null
              }
              onPress={async () => {
                await setActiveFamily(fam);
                setFamilySwitcherVisible(false);
              }}
              showChevron={false}
            />
          ))}
        </View>
        <View style={{ height: theme.spacing.base }} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setFamilySwitcherVisible(false)}
          block
        />
      </Sheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
