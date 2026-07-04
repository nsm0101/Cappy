import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

import { Button, Field } from '@/components';
import { profiles as profilesApi } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import {
  CURRENT_CONSENT_VERSION,
  useCaregiverProfile,
} from '@/auth/CaregiverProfileContext';
import { useTheme } from '@/theme';

const MIN_CAREGIVER_AGE = 18;

const formatDateYYYYMMDD = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const yearsSince = (d: Date): number => {
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1;
  return years;
};

/**
 * First-run caregiver setup. Sign in with Apple doesn't reliably give us a
 * name (and never a DOB), so we collect first/last name + DOB + consent
 * here before the caregiver can use the app. Shown by RootNavigator
 * whenever the profile is incomplete.
 */
export const CaregiverSetupScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { user, signOut } = useAuth();
  const { profile, refresh } = useCaregiverProfile();

  const defaultDob = new Date();
  defaultDob.setFullYear(defaultDob.getFullYear() - 30);

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [dob, setDob] = useState<Date>(
    profile?.date_of_birth ? new Date(`${profile.date_of_birth}T00:00:00`) : defaultDob,
  );
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [consent, setConsent] = useState(Boolean(profile?.consent_accepted_at));
  const [saving, setSaving] = useState(false);

  const age = yearsSince(dob);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Name required', 'Please enter your first and last name.');
      return;
    }
    if (age < MIN_CAREGIVER_AGE) {
      Alert.alert(
        'Must be 18 or older',
        'Caregiver accounts are for adults. Please check the date of birth you entered.',
      );
      return;
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please agree to the Terms & Privacy Policy to continue.');
      return;
    }
    setSaving(true);
    try {
      await profilesApi.updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: formatDateYYYYMMDD(dob),
        consentVersion: CURRENT_CONSENT_VERSION,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      await refresh(); // flips needsSetup → RootNavigator shows the app
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl }}>
          <Text
            style={{
              color: t.fg1,
              fontFamily: theme.fonts.display,
              fontSize: theme.fontSize.xxl,
              fontWeight: '800',
              marginBottom: theme.spacing.xs,
            }}
          >
            Welcome to Cappy
          </Text>
          <Text style={{ color: t.fg2, marginBottom: theme.spacing.xl, lineHeight: 22 }}>
            {"Let's set up your caregiver profile. Your name appears on the doses you log so other caregivers know who gave a dose."}
          </Text>

          <Field
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            autoCapitalize="words"
            textContentType="givenName"
          />
          <View style={{ height: theme.spacing.md }} />
          <Field
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            autoCapitalize="words"
            textContentType="familyName"
          />

          <View style={{ height: theme.spacing.md }} />
          <Text style={{ color: t.fg3, fontSize: theme.fontSize.xs, marginBottom: 6, fontWeight: '600' }}>
            DATE OF BIRTH
          </Text>
          <Pressable
            onPress={() => setShowPicker((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel="Set date of birth"
            style={{
              backgroundColor: t.bgInset,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: t.border,
              padding: 14,
            }}
          >
            <Text style={{ color: t.fg1 }}>
              {formatDateYYYYMMDD(dob)} · {age} years old
            </Text>
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

          <Pressable
            onPress={() => setConsent((c) => !c)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              marginTop: theme.spacing.xl,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: consent ? t.brand : t.border,
                backgroundColor: consent ? t.brand : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {consent ? <Text style={{ color: '#FFF', fontWeight: '900' }}>✓</Text> : null}
            </View>
            <Text style={{ color: t.fg2, flex: 1, lineHeight: 20 }}>
              {"I agree to Cappy's Terms of Service and Privacy Policy, and understand Cappy is a coordination tool, not medical advice."}
            </Text>
          </Pressable>

          <View style={{ height: theme.spacing.xl }} />
          <Button label="Continue" variant="blue" onPress={handleSave} loading={saving} block />
          <View style={{ height: theme.spacing.sm }} />
          <Button
            label="Sign out"
            variant="ghost"
            onPress={() => signOut()}
            block
          />
          <Text style={{ color: t.fgMuted, fontSize: theme.fontSize.xs, textAlign: 'center', marginTop: 12 }}>
            {user?.email ?? ''}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
