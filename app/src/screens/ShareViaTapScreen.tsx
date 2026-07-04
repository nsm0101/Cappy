import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';

import { Button, NfcTarget } from '@/components';
import {
  isProximityShareSupported,
  startProximitySend,
  type ProximityHandle,
} from '@/proximity';
import { shareInviteLink } from '@/lib';
import { useTheme } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Rt = RouteProp<AppStackParamList, 'ShareViaTap'>;

type SharedInvite = {
  code: string;
  link: string;
  familyName?: string;
  role: 'caregiver' | 'guest';
};

/**
 * "Tap to send" — direct phone-to-phone transmission of a Cappy family
 * invite, no physical tag and no code to read aloud.
 *
 * iPhone 11+ (U1/U2 chip) gets a real proximity handshake — see
 * src/proximity and ProximitySendView below. Every other device (older
 * iPhones, and Android for now — see src/nfc/hceBroadcast.ts for why the
 * Android HCE tap-to-send path is temporarily disabled) falls back to
 * ClassicSendView: a share-sheet handoff plus an on-screen QR code the
 * other person's camera can scan directly. Both land on the same join
 * link either way.
 */
export const ShareViaTapScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { code, link, familyName, role } = route.params;

  const familyLabel = familyName?.trim() || 'your family';
  const invite: SharedInvite = { code, link, familyName, role };

  // iPhone 11+ can do a real proximity handshake (see src/proximity);
  // everything else (older iPhones, Android) falls straight back to
  // share-sheet + QR since there's nothing for them to toggle to.
  const [mode, setMode] = useState<'proximity' | 'classic'>(() =>
    isProximityShareSupported() ? 'proximity' : 'classic',
  );

  if (mode === 'proximity') {
    return (
      <ProximitySendView
        invite={invite}
        familyLabel={familyLabel}
        onUseClassic={() => setMode('classic')}
        onDone={() => navigation.goBack()}
      />
    );
  }
  return (
    <ClassicSendView
      invite={invite}
      familyLabel={familyLabel}
      showProximityToggle={isProximityShareSupported()}
      onUseProximity={() => setMode('proximity')}
      onDone={() => navigation.goBack()}
    />
  );
};

type PxPhase = 'idle' | 'searching' | 'connected' | 'ranging' | 'sent' | 'error';

const PX_ACTIVE_PHASES = new Set<PxPhase>(['searching', 'connected', 'ranging']);

/**
 * iOS proximity "send" view — the real tap-like experience on iPhone 11+.
 * Both phones advertise/browse simultaneously (see the native module), so
 * the other person needs their own receiving screen open (AcceptInviteScreen's
 * "hold phones together" mode) for the two sides to find each other.
 */
const ProximitySendView: React.FC<{
  invite: SharedInvite;
  familyLabel: string;
  onUseClassic: () => void;
  onDone: () => void;
}> = ({ invite, familyLabel, onUseClassic, onDone }) => {
  const theme = useTheme();
  const t = theme.tokens;

  const [phase, setPhase] = useState<PxPhase>('idle');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const handleRef = useRef<ProximityHandle | null>(null);
  const succeededRef = useRef(false);

  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && !succeededRef.current) stop();
    });
    return () => sub.remove();
  }, [stop]);

  useEffect(() => {
    if (phase !== 'sent') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = useCallback(() => {
    succeededRef.current = false;
    setErrorMessage('');
    setDistanceMeters(null);

    const handle = startProximitySend(invite.link, (event) => {
      if (event.type === 'range') {
        setDistanceMeters(event.distanceMeters);
        return;
      }
      if (event.type === 'error') {
        setPhase('error');
        setErrorMessage(event.message);
        return;
      }
      if (event.type !== 'phase') return;

      if (event.phase === 'sent') {
        succeededRef.current = true;
        setPhase('sent');
        return;
      }
      if (succeededRef.current) return; // ignore the 'stopped' our own cleanup triggers
      if (event.phase === 'disconnected') {
        setPhase('searching'); // the other phone can reconnect — keep waiting
        return;
      }
      if (event.phase === 'searching' || event.phase === 'connected' || event.phase === 'ranging') {
        setPhase(event.phase);
      }
    });

    if (!handle) {
      setPhase('error');
      setErrorMessage("This iPhone can't send this way right now.");
      return;
    }
    handleRef.current = handle;
    setPhase('searching');
  }, [invite.link]);

  const isActive = PX_ACTIVE_PHASES.has(phase);
  const isSuccess = phase === 'sent';
  const isError = phase === 'error';
  const isClose = distanceMeters != null && distanceMeters <= 0.3;

  const headline = isSuccess
    ? 'Sent!'
    : isError
      ? "Couldn't send"
      : phase === 'ranging'
        ? isClose
          ? 'Almost there…'
          : 'Getting closer…'
        : phase === 'connected'
          ? 'Found a nearby iPhone'
          : phase === 'searching'
            ? 'Hold phones together'
            : 'Ready to send';

  const subline = isSuccess
    ? `The other iPhone just received the invite to join ${familyLabel}.`
    : isError
      ? errorMessage
      : phase === 'searching'
        ? "Bring the backs of both iPhones close together. The other person needs their “hold phones together” screen open too."
        : phase === 'connected'
          ? 'Keep the phones close while we confirm the connection.'
          : phase === 'ranging'
            ? 'Keep holding the phones together.'
            : `Hold this iPhone against another iPhone to send the invite to join ${familyLabel} directly — no AirDrop, no code.`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { padding: theme.spacing.lg }]}>
        <View style={styles.spacer} />

        {isSuccess ? (
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: theme.palette.sage[100], borderColor: t.success },
            ]}
          >
            <Ionicons name="checkmark-circle" size={72} color={t.success} />
          </View>
        ) : (
          <NfcTarget size={180} pulsing={isActive || phase === 'idle'} />
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

        <View style={styles.spacer} />

        {isSuccess ? (
          <>
            <Button label="Send again" variant="secondary" onPress={start} block />
            <View style={{ height: theme.spacing.sm }} />
            <Button label="Done" variant="blue" size="lg" onPress={onDone} block />
          </>
        ) : (
          <>
            <Button
              label={isError ? 'Try again' : isActive ? 'Waiting…' : 'Hold phones together'}
              variant="blue"
              size="lg"
              onPress={start}
              disabled={isActive}
              loading={isActive}
              block
            />
            <View style={{ height: theme.spacing.sm }} />
            <Button label="Use AirDrop / QR instead" variant="ghost" onPress={onUseClassic} block />
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

/**
 * iOS fallback "send" view — AirDrop-first curated share sheet plus an
 * on-screen QR code. Used on iPhones without a U1/U2 chip, or as a manual
 * fallback from the proximity view above.
 */
const ClassicSendView: React.FC<{
  invite: SharedInvite;
  familyLabel: string;
  showProximityToggle: boolean;
  onUseProximity: () => void;
  onDone: () => void;
}> = ({ invite, familyLabel, showProximityToggle, onUseProximity, onDone }) => {
  const theme = useTheme();
  const t = theme.tokens;

  const handleShare = useCallback(async () => {
    await shareInviteLink(invite);
  }, [invite]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.iosContent, { padding: theme.spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xxl,
            fontWeight: '800',
            marginTop: theme.spacing.lg,
            textAlign: 'center',
          }}
        >
          Send it now
        </Text>
        <Text
          style={{
            color: t.fg2,
            fontSize: theme.fontSize.base,
            lineHeight: 22,
            marginTop: theme.spacing.sm,
            textAlign: 'center',
            paddingHorizontal: theme.spacing.md,
          }}
        >
          {Platform.OS === 'ios'
            ? `AirDrop it to a nearby iPhone, or have them scan the code below — either way opens Cappy straight to joining ${familyLabel}.`
            : `Share it directly, or have them scan the code below — either way opens Cappy straight to joining ${familyLabel}.`}
        </Text>

        <View style={{ height: theme.spacing.xl }} />
        <Button
          label={Platform.OS === 'ios' ? 'AirDrop / Share…' : 'Share…'}
          variant="blue"
          size="lg"
          onPress={handleShare}
          leftIcon={<Ionicons name="share-outline" size={20} color={t.accent2Fg} />}
          block
        />

        <View style={styles.orRow}>
          <View style={[styles.orLine, { backgroundColor: t.border }]} />
          <Text style={{ color: t.fg3, fontSize: theme.fontSize.xs, fontWeight: '700' }}>OR</Text>
          <View style={[styles.orLine, { backgroundColor: t.border }]} />
        </View>

        <View style={[styles.qrCard, { backgroundColor: '#FFFFFF', borderColor: t.border }]}>
          <QRCode value={invite.link} size={196} color={theme.palette.slate[800]} backgroundColor="#FFFFFF" ecl="M" />
        </View>
        <Text
          style={{
            color: t.fg2,
            fontSize: theme.fontSize.sm,
            marginTop: theme.spacing.sm,
            textAlign: 'center',
          }}
        >
          {`Have them scan this with their camera to join ${familyLabel}.`}
        </Text>

        {showProximityToggle ? (
          <>
            <View style={{ height: theme.spacing.lg }} />
            <Button
              label="Try holding phones together instead"
              variant="secondary"
              onPress={onUseProximity}
              block
            />
          </>
        ) : null}

        <View style={{ height: theme.spacing.xl }} />
        <Button label="Done" variant="ghost" onPress={onDone} block />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, alignItems: 'center' },
  spacer: { flex: 1 },
  iconBadge: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 24,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    marginVertical: 20,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  qrCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
});
