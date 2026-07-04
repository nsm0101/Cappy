import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button, Card, Field, NfcTarget } from '@/components';
import { families as familiesApi } from '@/api';
import {
  isProximityShareSupported,
  startProximityReceive,
  type ProximityHandle,
} from '@/proximity';
import { useTheme } from '@/theme';
import { useActiveFamily } from '@/family/ActiveFamilyContext';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'AcceptInvite'>;

// Matches the trailing 6-digit code in a Quick Share invite link, e.g.
// https://cappy.closedose.com/join/123456
const CODE_FROM_JOIN_LINK = /\/join\/(\d{6})\b/;

type PxPhase = 'idle' | 'searching' | 'connected' | 'ranging' | 'received' | 'error';
const PX_ACTIVE_PHASES = new Set<PxPhase>(['searching', 'connected', 'ranging']);

export const AcceptInviteScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { refreshFamilies } = useActiveFamily();
  const prefillCode = route.params?.code?.replace(/[^0-9]/g, '').slice(0, 6) ?? '';

  const [code, setCode] = useState(prefillCode);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [success, setSuccess] = useState(false);
  const autoSubmitted = useRef(false);

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
      // Pull the newly-joined family into the active-family list so the rest
      // of the app (Home, Schedule, dashboard) sees it immediately.
      await refreshFamilies().catch(() => undefined);
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

  // Auto-submit a code delivered by a Quick Share deep link
  // (https://cappy.closedose.com/join/{code}).
  useEffect(() => {
    if (prefillCode.length === 6 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void handleSubmit(prefillCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCode]);

  const goHome = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  };

  // ── "Hold phones together" — iPhone 11+ receiving side of the direct
  // proximity send in ShareViaTapScreen. The admin's phone transmits the
  // invite link once the two phones are held together; we just need to be
  // listening on this end.
  const [mode, setMode] = useState<'code' | 'proximity'>('code');
  const [pxPhase, setPxPhase] = useState<PxPhase>('idle');
  const [pxError, setPxError] = useState('');
  const pxHandleRef = useRef<ProximityHandle | null>(null);
  const pxReceivedRef = useRef(false);

  const stopListening = useCallback(() => {
    pxHandleRef.current?.stop();
    pxHandleRef.current = null;
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  // If the app backgrounds mid-search, end the session rather than leaving
  // it listening unattended — unless we already got the invite.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && !pxReceivedRef.current) stopListening();
    });
    return () => sub.remove();
  }, [stopListening]);

  const startListening = useCallback(() => {
    setPxError('');
    pxReceivedRef.current = false;

    const handle = startProximityReceive((event) => {
      if (event.type === 'phase') {
        if (pxReceivedRef.current) return;
        if (event.phase === 'disconnected') {
          setPxPhase('searching'); // the sender can reconnect — keep waiting
          return;
        }
        setPxPhase(event.phase as PxPhase);
        return;
      }
      if (event.type === 'error') {
        if (pxReceivedRef.current) return;
        setPxPhase('error');
        setPxError(event.message);
        return;
      }
      if (event.type !== 'receive') return;

      pxReceivedRef.current = true;
      stopListening();

      const match = event.payload.match(CODE_FROM_JOIN_LINK);
      if (match?.[1]) {
        setPxPhase('received');
        setCode(match[1]);
        void handleSubmit(match[1]);
      } else {
        setPxPhase('error');
        setPxError("That didn't look like a Cappy invite. Ask them to try again.");
      }
    });

    if (!handle) {
      setPxPhase('error');
      setPxError("This iPhone can't receive this way right now.");
      return;
    }
    pxHandleRef.current = handle;
    setPxPhase('searching');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopListening]);

  const handleUseProximity = () => {
    setMode('proximity');
    startListening();
  };

  const handleCancelProximity = () => {
    stopListening();
    setMode('code');
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
              onPress={() => navigation.navigate('Tabs')}
              block
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'proximity') {
    const isActive = PX_ACTIVE_PHASES.has(pxPhase);
    const isError = pxPhase === 'error';
    const headline = isError
      ? "Couldn't connect"
      : pxPhase === 'ranging'
        ? 'Getting closer…'
        : pxPhase === 'connected'
          ? 'Found a nearby iPhone'
          : pxPhase === 'received'
            ? 'Got it!'
            : 'Hold phones together';
    const subline = isError
      ? pxError
      : "Bring the backs of both iPhones close together. The admin needs their “tap to send” screen open too.";

    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.container, styles.center, { padding: theme.spacing.lg }]}>
          <NfcTarget size={160} pulsing={isActive} style={{ alignSelf: 'center' }} />
          <Text
            style={{
              color: t.fg1,
              fontFamily: theme.fonts.display,
              fontSize: theme.fontSize.xxl,
              fontWeight: '800',
              marginTop: theme.spacing.xl,
              textAlign: 'center',
            }}
          >
            {headline}
          </Text>
          <Text
            style={{
              color: t.fg2,
              fontSize: theme.fontSize.base,
              lineHeight: theme.lineHeight.base,
              marginTop: theme.spacing.sm,
              marginBottom: theme.spacing.xl,
              textAlign: 'center',
            }}
          >
            {subline}
          </Text>
          <Button
            label={isError ? 'Try again' : 'Cancel'}
            variant={isError ? 'blue' : 'ghost'}
            onPress={isError ? startListening : handleCancelProximity}
            block
          />
          {isError ? (
            <>
              <View style={{ height: theme.spacing.sm }} />
              <Button label="Use a code instead" variant="ghost" onPress={handleCancelProximity} block />
            </>
          ) : null}
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
        {isProximityShareSupported() ? (
          <>
            <View style={{ height: theme.spacing.sm }} />
            <Button
              label="Or hold phones together"
              variant="secondary"
              onPress={handleUseProximity}
              disabled={loading}
              block
            />
          </>
        ) : null}
        <View style={{ height: theme.spacing.sm }} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={goHome}
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
