import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Card, Field } from '@/components';
import { families as familiesApi } from '@/api';
import { useTheme } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export const AcceptInviteScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (inviteCode: string) => {
    const cleanCode = inviteCode.trim();
    if (cleanCode.length !== 6 || !/^\d+$/.test(cleanCode)) {
      setErrorText('Please enter a valid 6-digit invite code.');
      return;
    }
    setErrorText('');
    setLoading(true);
    try {
      await familiesApi.acceptInvite(cleanCode);
      setSuccess(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not accept invite.';
      setErrorText(message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    setCode(cleanText);
    if (cleanText.length === 6) {
      void handleSubmit(cleanText);
    } else {
      setErrorText('');
    }
  };

  if (success) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.container, styles.center, { padding: theme.spacing.lg }]}>
          <Card style={styles.successCard}>
            <View style={[styles.iconContainer, { backgroundColor: theme.palette.teal[50] }]}>
              <Ionicons name="checkmark-circle" size={64} color={theme.palette.teal[500]} />
            </View>
            <Text
              style={{
                color: t.fg1,
                fontFamily: theme.fonts.display,
                fontSize: theme.fontSize.xxl,
                fontWeight: '800',
                textAlign: 'center',
                marginBottom: theme.spacing.sm,
              }}
            >
              Joined Family!
            </Text>
            <Text
              style={{
                color: t.fg2,
                fontFamily: theme.fonts.sans,
                fontSize: theme.fontSize.base,
                lineHeight: theme.lineHeight.base,
                textAlign: 'center',
                marginBottom: theme.spacing.xl,
              }}
            >
              {"You've successfully joined the family as a caregiver. You can now view child dose history and log medication."}
            </Text>
            <Button
              label="Continue"
              onPress={() => {
                navigation.navigate('Tabs');
              }}
              block
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.container, { padding: theme.spacing.lg }]}>
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xxl,
            fontWeight: '800',
            marginBottom: theme.spacing.sm,
          }}
        >
          Join with code
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
          Enter the 6-digit invite code provided by a family administrator to join their family record.
        </Text>

        <Field
          label="Invite Code"
          value={code}
          onChangeText={handleTextChange}
          placeholder="000000"
          maxLength={6}
          keyboardType="number-pad"
          autoFocus
          editable={!loading}
          errorText={errorText}
          style={styles.codeInput}
          accessibilityLabel="Invite Code input field"
          accessibilityHint="Enter the 6-digit family invite code"
        />

        <View style={{ height: theme.spacing.xl }} />

        <Button
          label={loading ? 'Joining…' : 'Join family'}
          onPress={() => handleSubmit(code)}
          disabled={loading || code.length !== 6}
          loading={loading}
          block
          accessibilityLabel="Join Family Button"
        />
        <View style={{ height: theme.spacing.sm }} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => navigation.goBack()}
          disabled={loading}
          block
          accessibilityLabel="Cancel Button"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  center: { justifyContent: 'center' },
  successCard: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  codeInput: {
    letterSpacing: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
  },
});
