import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';

import { Button, NfcTarget } from '@/components';
import {
  isHceAvailable,
  startHceBroadcast,
  type HceBroadcastHandle,
  type HceBroadcastPhase,
} from '@/nfc';
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

type Phase = HceBroadcastPhase | 'idle' | 'error';

const ACTIVE_PHASES = new Set<Phase>(['enabling', 'waiting', 'connected']);

type SharedInvite = {
  code: string;
  link: string;
  familyName?: string;
  role: 'caregiver' | 'guest';
};

/**
 * "Tap to send" — direct phone-to-phone transmission of a Cappy family
 * invite. No physical tag, no code to read aloud.
 *
 * Android is the true "send" side: this phone emulates an NFC Forum
 * Type 4 Tag (via Host Card Emulation, see src/nfc/hceBroadcast.ts)
 * containing the invite link. Any nearby phone — iOS or Android, Cappy
 * installed or not — just taps it and reads the link like it would a
 * sticker. The pulsing NfcTarget below is the active "send" signal: it
 * tells the admin exactly when to hold the two phones together.
 *
 * iPhones can only *read* NFC tags, not emit them, so this screen skips
 * the radio entirely on iOS and leads with two things that feel just as
 * immediate: a curated AirDrop-first share sheet (see src/lib/share.ts),
 * and an on-screen QR code the other person's camera can scan directly —
 * both land on the same join link, no NFC involved.
 */
export const ShareViaTapScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { code, link, familyName, role } = route.params;

  const canSendDirectly = isHceAvailable();
  const familyLabel = familyName?.trim() || 'your family';

  // iPhone 11+ can do a real proximity handshake (see src/proximity); older
  // iPhones fall straight back to AirDrop/QR since there's nothing for them
  // to toggle to.
  const [iosMode, setIosMode] = useState<'proximity' | 'classic'>(() =>
    isProximityShareSupported() ? 'proximity' : 'classic',
  );

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const handleRef = useRef<HceBroadcastHandle | null>(null);
  const succeededRef = useRef(false);

  const stopBroadcast = useCallback(async () => {
    await handleRef.current?.stop();
    handleRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      void stopBroadcast();
    };
  }, [stopBroadcast]);

  // If the app leaves the foreground mid-send, end the session rather than
  // leaving an invite broadcasting unattended.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && !succeededRef.current) void stopBroadcast();
    });
    return () => sub.remove();
  }, [stopBroadcast]);

  useEffect(() => {
    if (phase !== 'read') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void stopBroadcast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startSend = useCallback(async () => {
    succeededRef.current = false;
    setErrorMessage('');

    const result = await startHceBroadcast(link, (p) => {
      if (p === 'read') {
        succeededRef.current = true;
        setPhase('read');
        return;
      }
      // Swallow the 'stopped' phase our own cleanup triggers right after a
      // successful read — the success screen should stay put.
      if (succeededRef.current) return;
      setPhase(p);
    });

    if (!result.ok) {
      setPhase('error');
      setErrorMessage(result.message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      return;
    }
    handleRef.current = result.handle;
  }, [link]);

  const handleSendAgain = useCallback(() => {
    setPhase('idle');
    void startSend();
  }, [startSend]);

  const handleShareInstead = useCallback(async () => {
    await stopBroadcast();
    await shareInviteLink({ code, link, familyName, role });
  }, [stopBroadcast, code, link, familyName, role]);

  const isActive = ACTIVE_PHASES.has(phase);
  const isSuccess = phase === 'read';
  const isError = phase === 'error';

  // ── iOS: lead with a real proximity handshake on supported phones;
  // AirDrop + QR are always one tap away as a fallback.
  if (!canSendDirectly) {
    const invite: SharedInvite = { code, link, familyName, role };
    if (iosMode === 'proximity') {
      return (
        <ProximitySendView
          invite={invite}
          familyLabel={familyLabel}
          onUseClassic={() => setIosMode('classic')}
          onDone={() => navigation.goBack()}
        />
      );
    }
    return (
      <ClassicSendView
        invite={invite}
        familyLabel={familyLabel}
        showProximityToggle={isProximityShareSupported()}
        onUseProximity={() => setIosMode('proximity')}
        onDone={() => navigation.goBack()}
      />
    );
  }

  // ── Android: real direct tap-to-send.
  const headline = isSuccess
    ? 'Sent!'
    : isError
      ? "Couldn't send"
      : phase === 'connected'
        ? 'Connecting…'
        : phase === 'waiting' || phase === 'enabling'
          ? 'Ready — hold phones together'
          : 'Ready to send';

  const subline = isSuccess
    ? `The other phone just received the invite to join ${familyLabel} — no app required to open it.`
    : isError
      ? errorMessage
      : phase === 'waiting' || phase === 'enabling'
        ? 'Hold the back of this phone against the other phone. Most phones’ NFC antenna sits center-back.'
        : phase === 'connected'
          ? 'Almost there — keep the phones together.'
          : `Tap this phone directly against another phone to send the invite to join ${familyLabel}. Works whether they have Cappy installed or not.`;

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
            <Button label="Send again" variant="secondary" onPress={handleSendAgain} block />
            <View style={{ height: theme.spacing.sm }} />
            <Button label="Done" variant="blue" size="lg" onPress={() => navigation.goBack()} block />
          </>
        ) : (
          <>
            <Button
              label={isError ? 'Try again' : isActive ? 'Sending…' : 'Start tap-to-send'}
              variant="blue"
              size="lg"
              onPress={startSend}
              disabled={isActive}
              loading={isActive}
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
          {`AirDrop it to a nearby iPhone, or have them scan the code below — either way opens Cappy straight to joining ${familyLabel}.`}
        </Text>

        <View style={{ height: theme.spacing.xl }} />
        <Button
          label="AirDrop / Share…"
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
