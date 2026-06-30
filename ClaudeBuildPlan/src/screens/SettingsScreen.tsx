import React, { useState } from 'react';
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
import { initialsFromName } from '@/lib';

export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { user, signOut } = useAuth();
  const { mode, setMode } = useThemeMode();

  const [themeSheetVisible, setThemeSheetVisible] = useState(false);

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
                Caregiver Profile
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
