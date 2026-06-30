import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Avatar, Button, Card, RowItem, Sheet } from '@/components';
import { useAuth } from '@/auth/AuthContext';
import { useTheme, useThemeMode } from '@/theme';
import { initialsFromName, brandsForGeneric, brandFor } from '@/lib';
import {
  families as familiesApi,
  brands as brandsApi,
  profiles as profilesApi,
  type FamilyWithRole,
  type CaregiverWithProfile,
} from '@/api';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  caregiver: 'Caregiver',
  readonly: 'Read-only',
  guest: 'Guest',
};

const GENERICS = ['acetaminophen', 'ibuprofen'] as const;
const GENERIC_LABEL: Record<string, string> = {
  acetaminophen: 'Acetaminophen',
  ibuprofen: 'Ibuprofen',
};

export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { user, signOut } = useAuth();
  const { mode, setMode } = useThemeMode();

  const [themeSheetVisible, setThemeSheetVisible] = useState(false);
  const [activeFamily, setActiveFamily] = useState<FamilyWithRole | null>(null);
  const [caregivers, setCaregivers] = useState<CaregiverWithProfile[]>([]);
  const [brandPrefs, setBrandPrefs] = useState<Record<string, string>>({});
  const [inviteSheet, setInviteSheet] = useState(false);
  const [brandSheetGeneric, setBrandSheetGeneric] = useState<string | null>(null);
  const [caregiverName, setCaregiverName] = useState<string | null>(null);

  useEffect(() => {
    void profilesApi.getMyDisplayName().then(setCaregiverName);
  }, []);

  const handleEditName = () => {
    Alert.prompt(
      'Your name',
      'This name is shown on the doses you log, so other caregivers know who gave a dose.',
      async (value) => {
        const n = (value ?? '').trim();
        if (!n) return;
        try {
          await profilesApi.updateMyDisplayName(n);
          setCaregiverName(n);
        } catch (err) {
          Alert.alert('Could not save name', err instanceof Error ? err.message : 'Try again.');
        }
      },
      'plain-text',
      caregiverName ?? '',
    );
  };

  const loadFamily = useCallback(async () => {
    try {
      const fams = await familiesApi.listMyFamilies();
      const fam = fams[0] ?? null;
      setActiveFamily(fam);
      if (fam) {
        const [cg, prefs] = await Promise.all([
          familiesApi.listFamilyCaregivers(fam.id),
          brandsApi.getFamilyBrandPrefs(fam.id),
        ]);
        setCaregivers(cg);
        setBrandPrefs(prefs);
      }
    } catch {
      // non-fatal in settings
    }
  }, []);

  useEffect(() => {
    void loadFamily();
  }, [loadFamily]);

  const isAdmin = activeFamily?.my_role === 'admin';

  const handleInvite = async (role: 'caregiver' | 'guest', guestHours?: number) => {
    if (!activeFamily) return;
    setInviteSheet(false);
    try {
      const { code } = await familiesApi.createInvite(activeFamily.id, role, guestHours);
      const guestNote = guestHours
        ? ` Guest access ends ${guestHours >= 24 ? `${Math.round(guestHours / 24)} day(s)` : `${guestHours} hours`} after they join.`
        : '';
      Alert.alert(
        role === 'guest' ? 'Guest invite created' : 'Caregiver invite created',
        `Share this 6-digit code to add someone to your family. It expires in 24 hours.${guestNote}\n\nCode: ${code}`,
      );
      await loadFamily();
    } catch (err) {
      Alert.alert('Could not create invite', err instanceof Error ? err.message : 'Try again.');
    }
  };

  const handleSetBrand = async (generic: string, brandKey: string) => {
    if (!activeFamily) return;
    setBrandSheetGeneric(null);
    try {
      await brandsApi.setFamilyBrand(activeFamily.id, generic, brandKey);
      setBrandPrefs((p) => ({ ...p, [generic]: brandKey }));
    } catch (err) {
      Alert.alert('Could not save brand', err instanceof Error ? err.message : 'Try again.');
    }
  };

  const version = Constants.expoConfig?.version ?? '0.1.0';

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', `Cannot open URL: ${url}`);
      }
    } catch {
      Alert.alert('Error', 'An error occurred while opening the link.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (err) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const getThemeLabel = (themeMode: typeof mode) => {
    switch (themeMode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
      default:
        return 'System';
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxxl,
        }}
      >
        <View style={styles.header}>
          <Text
            style={{
              color: t.fg1,
              fontFamily: theme.fonts.display,
              fontSize: theme.fontSize.xxl,
              fontWeight: '800',
              marginBottom: theme.spacing.md,
            }}
          >
            Settings
          </Text>
        </View>

        {/* User Account Section */}
        <View style={{ marginBottom: theme.spacing.xl }}>
          <Card inset style={styles.profileCard}>
            <Avatar
              initials={user?.email ? initialsFromName(user.email.split('@')[0] ?? '') : '?'}
              tint={theme.palette.teal[500]}
              size="lg"
            />
            <View style={styles.profileText}>
              <Text
                style={{
                  color: t.fg1,
                  fontFamily: theme.fonts.sansSemibold,
                  fontSize: theme.fontSize.base,
                  fontWeight: '600',
                }}
              >
                {caregiverName ?? 'Add your name'}
              </Text>
              <Text
                style={{
                  color: t.fg3,
                  fontFamily: theme.fonts.sans,
                  fontSize: theme.fontSize.sm,
                  marginTop: 2,
                }}
              >
                {user?.email ?? 'Not signed in'}
              </Text>
            </View>
          </Card>
          <View style={{ height: theme.spacing.sm }} />
          <RowItem
            title="Your name"
            subtitle={caregiverName ?? 'Set the name shown on doses you log'}
            leftSlot={<Ionicons name="create-outline" size={20} color={t.brand} />}
            onPress={handleEditName}
            accessibilityLabel="Edit your name"
          />
        </View>

        {/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: t.fg3, fontSize: theme.fontSize.xs }]}>
          PREFERENCES
        </Text>
        <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          <RowItem
            title="Theme"
            subtitle={getThemeLabel(mode)}
            leftSlot={<Ionicons name="color-palette-outline" size={20} color={t.brand} />}
            onPress={() => setThemeSheetVisible(true)}
            accessibilityLabel={`Theme configuration. Current setting is ${getThemeLabel(mode)}.`}
            accessibilityHint="Double tap to change the application theme."
          />
        </View>

        {/* Family & caregivers */}
        {activeFamily ? (
          <>
            <Text style={[styles.sectionTitle, { color: t.fg3, fontSize: theme.fontSize.xs }]}>
              FAMILY & CAREGIVERS
            </Text>
            <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
              {caregivers.map((c) => (
                <RowItem
                  key={c.id}
                  title={c.display_name ?? 'Caregiver'}
                  subtitle={
                    ROLE_LABEL[c.role] +
                    (c.role === 'guest' && c.expires_at
                      ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}`
                      : '')
                  }
                  leftSlot={<Ionicons name="person-outline" size={20} color={t.brand} />}
                  showChevron={false}
                />
              ))}
              {isAdmin ? (
                <Button
                  label="Invite a caregiver or guest"
                  variant="secondary"
                  onPress={() => setInviteSheet(true)}
                  block
                />
              ) : null}
            </View>
          </>
        ) : null}

        {/* Medication brands */}
        {activeFamily ? (
          <>
            <Text style={[styles.sectionTitle, { color: t.fg3, fontSize: theme.fontSize.xs }]}>
              MEDICATION BRANDS
            </Text>
            <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
              {GENERICS.map((g) => {
                const b = brandFor(g, brandPrefs[g]);
                return (
                  <RowItem
                    key={g}
                    title={GENERIC_LABEL[g] ?? g}
                    subtitle={b.name}
                    leftSlot={
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: b.accent }} />
                    }
                    onPress={() => setBrandSheetGeneric(g)}
                  />
                );
              })}
            </View>
          </>
        ) : null}

        {/* Legal & About Section */}
        <Text style={[styles.sectionTitle, { color: t.fg3, fontSize: theme.fontSize.xs }]}>
          ABOUT CAPPY
        </Text>
        <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          <RowItem
            title="Privacy Policy"
            leftSlot={<Ionicons name="shield-checkmark-outline" size={20} color={t.brand} />}
            onPress={() => handleOpenLink('https://cappy.closedose.com/privacy')}
            accessibilityLabel="Privacy Policy"
            accessibilityHint="Opens the privacy policy in your web browser."
          />
          <RowItem
            title="Terms of Service"
            leftSlot={<Ionicons name="document-text-outline" size={20} color={t.brand} />}
            onPress={() => handleOpenLink('https://cappy.closedose.com/privacy')} // Note: open standard terms URL, let's point to terms on closure or policy as fallbacks
            accessibilityLabel="Terms of Service"
            accessibilityHint="Opens the terms of service in your web browser."
          />
        </View>

        {/* Account Actions Section */}
        <View style={{ marginTop: theme.spacing.md }}>
          <Button
            label="Sign Out"
            variant="secondary"
            onPress={handleSignOut}
            accessibilityLabel="Sign out of the app"
            block
          />
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={{ color: t.fgMuted, fontSize: theme.fontSize.xs, fontFamily: theme.fonts.sans }}>
            Cappy Version {version}
          </Text>
          <Text style={{ color: t.fgMuted, fontSize: 10, fontFamily: theme.fonts.sans, marginTop: 4 }}>
            For coordination only · Not medical advice
          </Text>
        </View>
      </ScrollView>

      {/* Theme Picker Bottom Sheet */}
      <Sheet visible={themeSheetVisible} onClose={() => setThemeSheetVisible(false)}>
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xl,
            fontWeight: '700',
            marginBottom: theme.spacing.md,
          }}
        >
          Select Theme
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          {(['light', 'dark', 'system'] as const).map((option) => (
            <RowItem
              key={option}
              title={getThemeLabel(option)}
              onPress={() => {
                setMode(option);
                setThemeSheetVisible(false);
              }}
              showChevron={false}
              rightSlot={
                mode === option ? (
                  <Ionicons name="checkmark" size={20} color={t.brand} />
                ) : null
              }
              accessibilityLabel={`Select ${getThemeLabel(option)} theme`}
            />
          ))}
        </View>
        <View style={{ height: theme.spacing.base }} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setThemeSheetVisible(false)}
          block
        />
      </Sheet>

      {/* Invite sheet */}
      <Sheet visible={inviteSheet} onClose={() => setInviteSheet(false)}>
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xl,
            fontWeight: '700',
            marginBottom: theme.spacing.md,
          }}
        >
          Invite to {activeFamily?.name}
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          <RowItem
            title="Caregiver"
            subtitle="Full, ongoing access to log and manage doses"
            onPress={() => handleInvite('caregiver')}
            showChevron={false}
          />
          <RowItem
            title="Guest · 24 hours"
            subtitle="Temporary access that auto-expires (e.g. a babysitter)"
            onPress={() => handleInvite('guest', 24)}
            showChevron={false}
          />
          <RowItem
            title="Guest · 7 days"
            subtitle="Temporary access that auto-expires"
            onPress={() => handleInvite('guest', 24 * 7)}
            showChevron={false}
          />
        </View>
        <View style={{ height: theme.spacing.base }} />
        <Button label="Cancel" variant="ghost" onPress={() => setInviteSheet(false)} block />
      </Sheet>

      {/* Brand selection sheet */}
      <Sheet visible={brandSheetGeneric != null} onClose={() => setBrandSheetGeneric(null)}>
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xl,
            fontWeight: '700',
            marginBottom: theme.spacing.md,
          }}
        >
          {brandSheetGeneric ? GENERIC_LABEL[brandSheetGeneric] : ''} brand
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          {(brandSheetGeneric ? brandsForGeneric(brandSheetGeneric) : []).map((b) => (
            <RowItem
              key={b.key}
              title={b.name}
              leftSlot={
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: b.accent }} />
              }
              rightSlot={
                brandSheetGeneric &&
                brandFor(brandSheetGeneric, brandPrefs[brandSheetGeneric]).key === b.key ? (
                  <Ionicons name="checkmark" size={20} color={t.brand} />
                ) : null
              }
              onPress={() => handleSetBrand(brandSheetGeneric as string, b.key)}
              showChevron={false}
            />
          ))}
        </View>
        <View style={{ height: theme.spacing.base }} />
        <Button label="Cancel" variant="ghost" onPress={() => setBrandSheetGeneric(null)} block />
      </Sheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {},
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  profileText: {
    marginLeft: 16,
    flex: 1,
  },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
});
