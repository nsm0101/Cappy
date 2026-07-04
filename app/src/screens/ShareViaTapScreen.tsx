import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Button, NfcTarget } from '@/components';
import { cancelNfcScan, initNfc, isNfcSupported, writeUri, type NfcWritePhase } from '@/nfc';
import { shareInviteLink } from '@/lib';
import { useTheme } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'ShareViaTap'>;

type SendState =
  | { phase: 'idle' }
  | { phase: NfcWritePhase }
  | { phase: 'error'; message: string };

const SENDING_PHASES = new Set<SendState['phase']>([
  'idle',
  'requesting',
  'tag_detected',
  'writing',
]);

/**
 * "Tap to send" — writes a Quick Share family-invite link to a blank
 * physical NFC tag so a second caregiver's phone (iOS or Android, Cappy
 * installed or not) can tap the tag and land straight on the join link.
 *
 * iOS Core NFC can't emulate a tag for true phone-to-phone push, so this
 * is the closest thing to "AirDrop for family access": one phone writes
 * a tag, the other reads it. The pulsing NfcTarget below is the active
 * "send" signal — it tells the caregiver holding this phone exactly when
 * and where to hold it against the blank tag. On iOS, the system NFC
 * sheet layers its own "Hold Near Reader" prompt on top of this screen;
 * on Android there is no equivalent system UI, so this in-app indicator
 * is the only cue the user gets.
 */
export const ShareViaTapScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { code, link, familyName, role } = route.params;

  const [state, setState] = useState<SendState>({ phase: 'idle' });
  const [nfcReady, setNfcReady] = useState<boolean | null>(null);
  const writeToken = useRef(0);

  useEffect(() => {
    void initNfc().then(setNfcReady);
    return () => {
      void cancelNfcScan();
    };
  }, []);

  // Cancel any in-flight session if the app backgrounds mid-write (e.g. the
  // user switches to Messages to hand the phone to someone else).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void cancelNfcScan();
    });
    return () => sub.remove();
  }, []);

  const familyLabel = familyName?.trim() || 'your family';

  const startWrite = useCallback(async () => {
    const token = ++writeToken.current;
    setState({ phase: 'requesting' });

    const result = await writeUri(link, {
      alertMessage: 'Hold your phone near the blank tag.',
      onPhase: (phase) => {
        if (writeToken.current === token) setState({ phase });
      },
    });

    if (writeToken.current !== token) return; // superseded by a retry/unmount

    if (result.ok) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      return;
    }

    if (result.error.kind === 'user_cancelled') {
      setState({ phase: 'idle' });
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    setState({ phase: 'error', message: result.error.message });
  }, [link]);

  const handleShareInstead = useCallback(async () => {
    await cancelNfcScan();
    await shareInviteLink({ code, link, familyName, role });
  }, [code, link, familyName, role]);

  const isSending = SENDING_PHASES.has(state.phase) && state.phase !== 'idle';
  const isSuccess = state.phase === 'success';
  const isError = state.phase === 'error';

  const headline = isSuccess
    ? 'Tag written!'
    : state.phase === 'requesting'
      ? 'Hold near a blank tag'
      : state.phase === 'tag_detected'
        ? 'Tag found…'
        : state.phase === 'writing'
          ? 'Writing…'
          : isError
            ? "Couldn't write tag"
            : 'Ready to send';

  const subline = isSuccess
    ? `Hand the tag to your caregiver, or leave it somewhere they can tap. Any phone — iOS or Android — will open the invite to join ${familyLabel}.`
    : isError
      ? state.phase === 'error'
        ? state.message
        : undefined
      : state.phase === 'requesting' || state.phase === 'tag_detected' || state.phase === 'writing'
        ? 'Hold the top of your phone against a blank Cappy NFC tag or sticker.'
        : `Write your invite to a blank NFC tag. Once written, another phone can tap it to join ${familyLabel} — no code needed.`;

  if (nfcReady === null) {
    return <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]} />;
  }

  if (!nfcReady || !isNfcSupported()) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.content, { padding: theme.spacing.lg }]}>
          <View style={styles.spacer} />
          <Ionicons name="phone-portrait-outline" size={56} color={t.fgMuted} />
          <Text
            style={{
              color: t.fg1,
              fontFamily: theme.fonts.display,
              fontSize: theme.fontSize.xl,
              fontWeight: '700',
              marginTop: theme.spacing.md,
              textAlign: 'center',
            }}
          >
            {"NFC isn't available on this device"}
          </Text>
          <Text
            style={{
              color: t.fg2,
              fontSize: theme.fontSize.base,
              lineHeight: 22,
              marginTop: theme.spacing.sm,
              textAlign: 'center',
            }}
          >
            You can still share the invite link directly.
          </Text>
          <View style={styles.spacer} />
          <Button label="Share link…" variant="blue" size="lg" onPress={handleShareInstead} block />
          <View style={{ height: theme.spacing.sm }} />
          <Button label="Done" variant="ghost" onPress={() => navigation.goBack()} block />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { padding: theme.spacing.lg }]}>
        <View style={styles.spacer} />

        {isSuccess ? (
          <View
            style={[
              styles.successBadge,
              { backgroundColor: theme.palette.sage[100], borderColor: t.success },
            ]}
          >
            <Ionicons name="checkmark-circle" size={72} color={t.success} />
          </View>
        ) : (
          <NfcTarget size={180} pulsing={isSending || state.phase === 'idle'} />
        )}

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
        {subline ? (
          <Text
            style={{
              color: t.fg2,
              fontSize: theme.fontSize.base,
              lineHeight: 22,
              marginTop: theme.spacing.sm,
              textAlign: 'center',
              paddingHorizontal: theme.spacing.lg,
            }}
          >
            {subline}
          </Text>
        ) : null}

        <View style={styles.spacer} />

        {isSuccess ? (
          <>
            <Button label="Write another tag" variant="secondary" onPress={startWrite} block />
            <View style={{ height: theme.spacing.sm }} />
            <Button label="Done" variant="blue" size="lg" onPress={() => navigation.goBack()} block />
          </>
        ) : (
          <>
            <Button
              label={isError ? 'Try again' : isSending ? 'Sending…' : 'Start tap-to-send'}
              variant="blue"
              size="lg"
              onPress={startWrite}
              disabled={isSending}
              loading={isSending}
              block
            />
            <View style={{ height: theme.spacing.sm }} />
            <Button label="Share link instead" variant="ghost" onPress={handleShareInstead} block />
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1 },
  content: { flex: 1, alignItems: 'center' },
  spacer: { flex: 1 },
  successBadge: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
