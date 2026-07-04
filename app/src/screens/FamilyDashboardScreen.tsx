import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

import { Button, Card, Field, MemberAvatar, RowItem, Sheet } from '@/components';
import {
  families as familiesApi,
  children as childrenApi,
  type CaregiverWithProfile,
  type Child,
} from '@/api';
import { useTheme } from '@/theme';
import { useAuth } from '@/auth/AuthContext';
import { useActiveFamily } from '@/family/ActiveFamilyContext';
import { initialsFromName, shareInviteLink } from '@/lib';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  caregiver: 'Caregiver',
  readonly: 'Read-only',
  guest: 'Guest',
};

const formatDateYYYYMMDD = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const ageFromDob = (dobISO: string | null): string | null => {
  if (!dobISO) return null;
  const dob = new Date(`${dobISO}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 24) return `${months} mo`;
  const years = Math.floor(months / 12);
  return `${years} yr`;
};

type InviteReady = { code: string; link: string; role: 'caregiver' | 'guest' };

export const FamilyDashboardScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { activeFamily, refreshFamilies } = useActiveFamily();

  const [caregivers, setCaregivers] = useState<CaregiverWithProfile[]>([]);
  const [kids, setKids] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  const [shareSheet, setShareSheet] = useState(false);
  const [inviteReady, setInviteReady] = useState<InviteReady | null>(null);
  const [editChild, setEditChild] = useState<Child | null>(null);

  const isAdmin = activeFamily?.my_role === 'admin';

  const load = useCallback(async () => {
    if (!activeFamily) {
      setCaregivers([]);
      setKids([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cg, children] = await Promise.all([
        familiesApi.listFamilyCaregivers(activeFamily.id),
        childrenApi.listChildrenInFamily(activeFamily.id),
      ]);
      setCaregivers(cg);
      setKids(children);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [activeFamily]);

  useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();
  const activeCaregivers = useMemo(
    () => caregivers.filter((c) => c.status === 'active'),
    [caregivers],
  );
  const adults = useMemo(
    () =>
      activeCaregivers.filter(
        (c) => c.role !== 'guest' && (!c.expires_at || new Date(c.expires_at).getTime() > now),
      ),
    [activeCaregivers, now],
  );
  const guests = useMemo(
    () =>
      activeCaregivers.filter(
        (c) => c.role === 'guest' && (!c.expires_at || new Date(c.expires_at).getTime() > now),
      ),
    [activeCaregivers, now],
  );

  // ── Quick Share ──────────────────────────────────────────────────────
  const createInvite = useCallback(
    async (role: 'caregiver' | 'guest', guestHours?: number) => {
      if (!activeFamily) return;
      setShareSheet(false);
      try {
        const { code } = await familiesApi.createInvite(activeFamily.id, role, guestHours);
        setInviteReady({ code, link: familiesApi.buildInviteLink(code), role });
      } catch (err) {
        Alert.alert('Could not create invite', err instanceof Error ? err.message : 'Try again.');
      }
    },
    [activeFamily],
  );

  const handleShareLink = useCallback(async () => {
    if (!inviteReady) return;
    await shareInviteLink({
      code: inviteReady.code,
      link: inviteReady.link,
      familyName: activeFamily?.name,
      role: inviteReady.role,
    });
  }, [inviteReady, activeFamily]);

  const handleTapToSend = useCallback(() => {
    if (!inviteReady) return;
    setInviteReady(null);
    navigation.navigate('ShareViaTap', {
      code: inviteReady.code,
      link: inviteReady.link,
      familyName: activeFamily?.name,
      role: inviteReady.role,
    });
  }, [inviteReady, navigation, activeFamily]);

  // ── Remove members ───────────────────────────────────────────────────
  const confirmRemoveCaregiver = useCallback(
    (c: CaregiverWithProfile) => {
      Alert.alert(
        'Remove member',
        `Remove ${c.display_name ?? 'this member'} from ${activeFamily?.name}? They'll lose access immediately.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await familiesApi.revokeCaregiver(c.id);
                await load();
              } catch (err) {
                Alert.alert('Could not remove', err instanceof Error ? err.message : 'Try again.');
              }
            },
          },
        ],
      );
    },
    [activeFamily, load],
  );

  const confirmRemoveChild = useCallback(
    (child: Child) => {
      Alert.alert(
        'Remove child',
        `Remove ${child.display_name}? Their dose history is kept but they'll no longer appear in the family.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await childrenApi.softDeleteChild(child.id);
                await load();
              } catch (err) {
                Alert.alert('Could not remove', err instanceof Error ? err.message : 'Try again.');
              }
            },
          },
        ],
      );
    },
    [load],
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.brand} />
      </SafeAreaView>
    );
  }

  if (!activeFamily) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={{ padding: theme.spacing.lg }}>
          <Card inset style={styles.emptyCard}>
            <Ionicons name="people-outline" size={36} color={t.fgMuted} style={{ marginBottom: 12 }} />
            <Text style={{ color: t.fg2, textAlign: 'center', marginBottom: 16 }}>
              Create or join a family to see your family dashboard.
            </Text>
            <Button
              label="Create a family"
              variant="blue"
              onPress={() => navigation.navigate('CreateFamily')}
              block
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const sectionTitle = (label: string, count: number) => (
    <Text style={[styles.sectionTitle, { color: t.fg3, fontSize: theme.fontSize.xs }]}>
      {label} · {count}
    </Text>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}
        >
          <Ionicons name="chevron-back" size={22} color={t.brand} />
          <Text style={{ color: t.brand, fontSize: theme.fontSize.base }}>Back</Text>
        </Pressable>
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
        <Text style={{ color: t.fg3, marginTop: 2, marginBottom: theme.spacing.lg }}>
          {adults.length} adult{adults.length === 1 ? '' : 's'} · {kids.length} child
          {kids.length === 1 ? '' : 'ren'}
          {guests.length > 0 ? ` · ${guests.length} guest${guests.length === 1 ? '' : 's'}` : ''}
        </Text>

        {isAdmin ? (
          <Button
            label="Quick Share — invite a caregiver"
            variant="blue"
            onPress={() => setShareSheet(true)}
            block
            style={{ marginBottom: theme.spacing.xl }}
          />
        ) : null}

        {/* Adults */}
        {sectionTitle('ADULTS', adults.length)}
        <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          {adults.map((c) => {
            const isSelf = c.user_id === user?.id;
            const age = ageFromDob(c.date_of_birth);
            return (
              <RowItem
                key={c.id}
                title={(c.display_name ?? 'Caregiver') + (isSelf ? ' (you)' : '')}
                subtitle={`${ROLE_LABEL[c.role] ?? c.role}${age ? ` · ${age}` : ''}`}
                leftSlot={
                  <MemberAvatar
                    avatarPath={c.avatar_url}
                    initials={initialsFromName(c.display_name ?? '?')}
                    tint={theme.palette.teal[500]}
                    size="md"
                  />
                }
                showChevron={false}
                rightSlot={
                  isAdmin && !isSelf ? (
                    <Pressable
                      onPress={() => confirmRemoveCaregiver(c)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${c.display_name ?? 'member'}`}
                      hitSlop={10}
                    >
                      <Ionicons name="trash-outline" size={20} color={t.error} />
                    </Pressable>
                  ) : null
                }
              />
            );
          })}
          {isAdmin ? (
            <Button
              label="Add an adult"
              variant="secondary"
              onPress={() => setShareSheet(true)}
              block
            />
          ) : null}
        </View>

        {/* Children */}
        {sectionTitle('CHILDREN', kids.length)}
        <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          {kids.map((child) => {
            const age = ageFromDob(child.date_of_birth);
            return (
              <RowItem
                key={child.id}
                title={child.display_name}
                subtitle={`${age ? `${age} · ` : ''}born ${child.date_of_birth}`}
                leftSlot={
                  <MemberAvatar
                    avatarPath={child.avatar_url}
                    initials={initialsFromName(child.display_name)}
                    tint={theme.palette.blue[500]}
                    size="md"
                  />
                }
                onPress={() => navigation.navigate('ChildDetail', { childId: child.id })}
                rightSlot={
                  isAdmin ? (
                    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                      <Pressable
                        onPress={() => setEditChild(child)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${child.display_name}`}
                        hitSlop={8}
                      >
                        <Ionicons name="create-outline" size={20} color={t.brand} />
                      </Pressable>
                      <Pressable
                        onPress={() => confirmRemoveChild(child)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${child.display_name}`}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={20} color={t.error} />
                      </Pressable>
                    </View>
                  ) : undefined
                }
              />
            );
          })}
          {isAdmin ? (
            <Button
              label="Add a child"
              variant="secondary"
              onPress={() => navigation.navigate('AddChild', { familyId: activeFamily.id })}
              block
            />
          ) : null}
        </View>

        {/* Active guests */}
        {guests.length > 0 ? (
          <>
            {sectionTitle('ACTIVE GUESTS', guests.length)}
            <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
              {guests.map((c) => (
                <RowItem
                  key={c.id}
                  title={c.display_name ?? 'Guest'}
                  subtitle={
                    'Guest' +
                    (c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : '')
                  }
                  leftSlot={<Ionicons name="time-outline" size={22} color={t.brand} />}
                  showChevron={false}
                  rightSlot={
                    isAdmin ? (
                      <Pressable
                        onPress={() => confirmRemoveCaregiver(c)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${c.display_name ?? 'guest'}`}
                        hitSlop={10}
                      >
                        <Ionicons name="trash-outline" size={20} color={t.error} />
                      </Pressable>
                    ) : null
                  }
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Quick Share role picker */}
      <Sheet visible={shareSheet} onClose={() => setShareSheet(false)}>
        <Text style={[styles.sheetTitle, { color: t.fg1, fontFamily: theme.fonts.display }]}>
          Invite to {activeFamily.name}
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          <RowItem
            title="Caregiver"
            subtitle="Full, ongoing access to log and manage doses"
            onPress={() => createInvite('caregiver')}
            showChevron={false}
          />
          <RowItem
            title="Guest · 24 hours"
            subtitle="Temporary access that auto-expires (e.g. a babysitter)"
            onPress={() => createInvite('guest', 24)}
            showChevron={false}
          />
          <RowItem
            title="Guest · 7 days"
            subtitle="Temporary access that auto-expires"
            onPress={() => createInvite('guest', 24 * 7)}
            showChevron={false}
          />
        </View>
        <View style={{ height: theme.spacing.base }} />
        <Button label="Cancel" variant="ghost" onPress={() => setShareSheet(false)} block />
      </Sheet>

      {/* Invite ready — share options */}
      <Sheet visible={inviteReady != null} onClose={() => setInviteReady(null)}>
        <Text style={[styles.sheetTitle, { color: t.fg1, fontFamily: theme.fonts.display }]}>
          Invite ready
        </Text>
        <Text style={{ color: t.fg2, marginBottom: theme.spacing.md }}>
          Share this link with your partner or caregiver. It opens Cappy and joins your family
          automatically. The 6-digit code is a backup: {inviteReady?.code}
        </Text>
        <View
          style={{
            backgroundColor: t.bgInset,
            borderRadius: theme.radii.md,
            padding: 12,
            marginBottom: theme.spacing.md,
          }}
        >
          <Text style={{ color: t.fg1, fontFamily: theme.fonts.mono }}>
            {inviteReady?.link}
          </Text>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Button label="Send to a nearby phone" variant="blue" onPress={handleTapToSend} block />
          <Button label="Share link…" variant="secondary" onPress={handleShareLink} block />
        </View>
        <View style={{ height: theme.spacing.base }} />
        <Button label="Done" variant="ghost" onPress={() => setInviteReady(null)} block />
      </Sheet>

      {/* Edit child (fix name / DOB) */}
      <EditChildSheet
        child={editChild}
        onClose={() => setEditChild(null)}
        onSaved={async () => {
          setEditChild(null);
          await load();
          await refreshFamilies();
        }}
      />
    </SafeAreaView>
  );
};

// ── Edit child sheet ─────────────────────────────────────────────────────
const EditChildSheet: React.FC<{
  child: Child | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}> = ({ child, onClose, onSaved }) => {
  const theme = useTheme();
  const t = theme.tokens;
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (child) {
      setName(child.display_name);
      const parsed = new Date(`${child.date_of_birth}T00:00:00`);
      setDob(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
      setShowPicker(false);
    }
  }, [child]);

  const handleSave = async () => {
    if (!child) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }
    setSaving(true);
    try {
      await childrenApi.updateChildDetails(child.id, {
        displayName: trimmed,
        dateOfBirth: formatDateYYYYMMDD(dob),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await onSaved();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={child != null} onClose={onClose}>
      <Text style={[styles.sheetTitle, { color: t.fg1, fontFamily: theme.fonts.display }]}>
        Edit {child?.display_name}
      </Text>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Child's name" />
      <View style={{ height: theme.spacing.md }} />
      <Text style={{ color: t.fg3, fontSize: theme.fontSize.xs, marginBottom: 6, fontWeight: '600' }}>
        DATE OF BIRTH
      </Text>
      <Pressable
        onPress={() => setShowPicker((s) => !s)}
        accessibilityRole="button"
        accessibilityLabel="Change date of birth"
        style={{
          backgroundColor: t.bgInset,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: t.border,
          padding: 14,
        }}
      >
        <Text style={{ color: t.fg1 }}>{formatDateYYYYMMDD(dob)}</Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={dob}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(_e, d) => {
            if (Platform.OS !== 'ios') setShowPicker(false);
            if (d) setDob(d);
          }}
        />
      ) : null}
      <View style={{ height: theme.spacing.lg }} />
      <Button label="Save changes" variant="blue" onPress={handleSave} loading={saving} block />
      <View style={{ height: theme.spacing.sm }} />
      <Button label="Cancel" variant="ghost" onPress={onClose} block />
    </Sheet>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  sectionTitle: { fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
});
