import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, Wordmark } from '@/components';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme';

export const SignInScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { signInWithEmail, verifyEmailOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Alert.alert('Email needed', 'Please enter a valid email address.');
      return;
    }
    setSending(true);
    const { error } = await signInWithEmail(trimmed);
    setSending(false);
    if (error) {
      Alert.alert("Couldn't send", error.message);
      return;
    }
    setSent(true);
  };

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (!/^[0-9]{6}$/.test(trimmed)) {
      Alert.alert('Enter the code', 'Type the 6-digit code from the email.');
      return;
    }
    setVerifying(true);
    // On success, the auth state listener flips us into the app — no
    // manual navigation needed here.
    const { error } = await verifyEmailOtp(email.trim().toLowerCase(), trimmed);
    setVerifying(false);
    if (error) {
      Alert.alert("That code didn't work", error.message);
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
            {sent ? 'Check your email' : 'Welcome'}
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
            {sent
              ? `We emailed a 6-digit code to ${email}. Enter it below to sign in.`
              : "Sign in with your email — we'll send you a 6-digit code."}
          </Text>

          {!sent ? (
            <Card>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!sending}
              />
              <View style={{ height: theme.spacing.base }} />
              <Button
                label={sending ? 'Sending…' : 'Send sign-in link'}
                onPress={handleSend}
                disabled={sending}
                loading={sending}
                block
              />
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              <Card>
                <Field
                  label="6-digit code"
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="123456"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  editable={!verifying}
                />
                <View style={{ height: theme.spacing.base }} />
                <Button
                  label={verifying ? 'Verifying…' : 'Verify code'}
                  onPress={handleVerify}
                  disabled={verifying || code.length < 6}
                  loading={verifying}
                  block
                />
              </Card>
              <Button
                variant="secondary"
                label="Use a different email"
                onPress={() => {
                  setSent(false);
                  setEmail('');
                  setCode('');
                }}
                disabled={verifying}
                block
              />
            </View>
          )}

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
