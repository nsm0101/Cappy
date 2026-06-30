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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MemberAvatar, Button, Card, DosePill, RowItem, Wordmark } from '@/components';
import {
  families as familiesApi,
  children as childrenApi,
  doses as dosesApi,
  realtime as realtimeApi,
} from '@/api';
import type { FamilyWithRole, Child, DoseStatus } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme';
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

export const HomeScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const [families, setFamilies] = useState<FamilyWithRole[]>([]);
  const [activeFamily, setActiveFamily] = useState<FamilyWithRole | null>(null);
  const [childrenList, setChildrenList] = useState<ChildWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFamilies = useCallback(async () => {
    try {
      const fams = await familiesApi.listMyFamilies();
      setFamilies(fams);
      const firstFam = fams[0];
      if (firstFam && !activeFamily) {
        setActiveFamily(firstFam);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('listMyFamilies error', err);
    }
  }, [activeFamily]);

  const loadChildren = useCallback(async (familyId: string) => {
    try {
      const kids = await childrenApi.listChildrenInFamily(familyId);
      // For each child + the alpha medication, compute dose status.
      // Alpha simplification: there's one default medication. We'll
      // need to extend this when families have multiple meds.
      const enriched: ChildWithStatus[] = await Promise.all(
        kids.map(async (child) => {
          try {
            // For alpha, we don't yet know which medication; pull most
            // recent dose to display "last dose" without status.
            const recent = await dosesApi.listDosesForChild(child.id, { limit: 1 });
            const last = recent[0];
            const weight = await childrenApi.getLatestWeight(child.id);
            const status: DoseStatus = !last
              ? 'due'
              : Date.now() - new Date(last.given_at).getTime() < 30 * 60 * 1000
                ? 'recent'
                : 'due';
            return {
              ...child,
              status,
              lastDoseAt: last?.given_at ?? null,
              weightGrams: weight,
            };
          } catch {
            return { ...child, status: 'due', lastDoseAt: null, weightGrams: null };
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
    void (async () => {
      setLoading(true);
      await loadFamilies();
      setLoading(false);
    })();
  }, [loadFamilies]);

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
    await loadFamilies();
    if (activeFamily) await loadChildren(activeFamily.id);
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
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}.
        </Text>

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
                        label={
                          child.status === 'due'
                            ? 'Due now'
                            : child.status === 'recent'
                              ? 'Given recently'
                              : child.status === 'early'
                                ? 'Too early'
                                : 'Overdue'
                        }
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
