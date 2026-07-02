import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Field, Wordmark } from '@/components';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme';

type Mode = 'signin' | 'signup';

export const SignInScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { signInWithPassword, signUpWithPassword, signInWithApple } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  const handleApple = async () => {
    setBusy(true);
    const { error } = await signInWithApple();
    setBusy(false);
    if (error) {
      Alert.alert('Apple sign-in failed', error.message);
    }
  };

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Alert.alert('Email needed', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (isSignup && name.trim().length === 0) {
      Alert.alert('Name needed', 'Enter your name so doses are attributed to you.');
      return;
    }
    setBusy(true);
    // On success the auth-state listener flips us into the app — no manual
    // navigation needed here.
    if (isSignup) {
      const { error, needsEmailConfirm } = await signUpWithPassword(trimmed, password, name);
      setBusy(false);
      if (error) {
        Alert.alert("Couldn't create account", error.message);
        return;
      }
      if (needsEmailConfirm) {
        // Email confirmation is enabled on this project: no session yet.
        setMode('signin');
        Alert.alert(
          'Check your email',
          `We sent a confirmation link to ${trimmed}. Tap it, then come back and sign in.`,
        );
      }
      return;
    }
    const { error } = await signInWithPassword(trimmed, password);
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't sign in", error.message);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={[styles.container, { padding: theme.spacing.lg }]}>
          <View style={{ marginTop: theme.spacing.xxl, marginBottom: theme.spacing.xl }}>
            <Wordmark size={32} />
          </View>

          <Text
            style={{
              color: t.fg1,
              fontFamily: theme.fonts.display,
              fontSize: theme.fontSize.xxl,
              fontWeight: '800',
              marginBottom: theme.spacing.sm,
            }}
          >
            {isSignup ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text
            style={{
              color: t.fg2,
              fontFamily: theme.fonts.sans,
              fontSize: theme.fontSize.base,
              lineHeight: theme.lineHeight.base,
              marginBottom: theme.spacing.xl,
            }}
          >
            {isSignup
              ? 'Set up Cappy to coordinate doses with your family.'
              : 'Sign in to coordinate doses with your family.'}
          </Text>

          <Card>
            {isSignup ? (
              <>
                <Field
                  label="Your name"
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Alex"
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  editable={!busy}
                />
                <View style={{ height: theme.spacing.base }} />
              </>
            ) : null}
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              autoCorrect={false}
              editable={!busy}
            />
            <View style={{ height: theme.spacing.base }} />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              textContentType={isSignup ? 'newPassword' : 'password'}
              autoCorrect={false}
              editable={!busy}
            />
            <View style={{ height: theme.spacing.base }} />
            <Button
              label={busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
              onPress={handleSubmit}
              disabled={busy || !email || password.length < 6}
              loading={busy}
              block
            />
          </Card>

          {Platform.OS === 'ios' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.lg }}>
                <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
                <Text style={{ color: t.fg3, marginHorizontal: theme.spacing.md, fontSize: theme.fontSize.xs }}>
                  or
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
              </View>
              <Pressable
                onPress={handleApple}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#000000',
                  borderRadius: 12,
                  paddingVertical: 14,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontFamily: theme.fonts.sansSemibold, fontSize: theme.fontSize.base }}>
                  Continue with Apple
                </Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            onPress={() => setMode(isSignup ? 'signin' : 'signup')}
            disabled={busy}
            style={{ marginTop: theme.spacing.lg, alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel={
              isSignup ? 'Switch to sign in' : 'Switch to create an account'
            }
          >
            <Text
              style={{
                color: t.brand,
                fontFamily: theme.fonts.sansSemibold,
                fontSize: theme.fontSize.base,
              }}
            >
              {isSignup ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </Pressable>

          <View style={{ marginTop: theme.spacing.xxl }}>
            <Text
              style={{
                color: t.fg3,
                fontSize: theme.fontSize.xs,
                lineHeight: 18,
                textAlign: 'center',
              }}
            >
              By continuing you agree to our Terms and Privacy Policy. Cappy is a
              coordination tool, not medical advice — always follow the medication
              label and consult a pediatrician for dosing decisions.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1 },
});
