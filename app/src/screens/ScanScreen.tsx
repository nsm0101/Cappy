import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, NfcTarget } from '@/components';
import { initNfc, scanOnce, cancelNfcScan, isNfcSupported } from '@/nfc';
import { nfc as nfcApi } from '@/api';
import { useTheme } from '@/theme';
import { useActiveFamily } from '@/family/ActiveFamilyContext';
import { isWellKnownTagSlug } from '@/lib';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'resolving'; tagUid: string }
  | { phase: 'error'; message: string };

type Props = {
  /** Pre-supplied UID from a Universal Link cold-launch */
  initialTagUid?: string;
};

export const ScanScreen: React.FC<Props> = ({ initialTagUid }) => {
  const theme = useTheme();
  const t = theme.tokens;
  const navigation = useNavigation<Nav>();
  const { activeFamily } = useActiveFamily();
  const [state, setState] = useState<ScanState>({ phase: 'idle' });
  const [nfcReady, setNfcReady] = useState<boolean | null>(null);

  useEffect(() => {
    void initNfc().then(setNfcReady);
    return () => {
      void cancelNfcScan();
    };
  }, []);

  const handleResolved = useCallback(
    async (tagUid: string) => {
      setState({ phase: 'resolving', tagUid });
      try {
        const resolved = await nfcApi.resolveNfcTag(tagUid, activeFamily?.id);
        if (!resolved) {
          // A well-known medication sticker (ace-child / ibu-child) only
          // resolves once the user has an active family, so give a
          // clearer hint in that case.
          const message =
            isWellKnownTagSlug(tagUid) && !activeFamily
              ? 'Create or join a family first, then tap the sticker again to log a dose.'
              : "This tag isn't registered to a family you have access to. Ask the family admin to register it.";
          setState({ phase: 'error', message });
          return;
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate('DoseSheet', { resolved });
        setState({ phase: 'idle' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not resolve tag.';
        setState({ phase: 'error', message });
      }
    },
    [navigation, activeFamily],
  );

  // Handle a tag UID handed in from Universal Link cold-launch
  useEffect(() => {
    if (initialTagUid) {
      void handleResolved(initialTagUid);
    }
  }, [initialTagUid, handleResolved]);

  const handleScan = async () => {
    setState({ phase: 'scanning' });
    const result = await scanOnce();
    if (!result.ok) {
      if (result.error.kind === 'user_cancelled') {
        setState({ phase: 'idle' });
        return;
      }
      setState({ phase: 'error', message: result.error.message });
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void handleResolved(result.tagUid);
  };

  if (nfcReady === null) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.brand} />
      </SafeAreaView>
    );
  }

  if (!nfcReady || !isNfcSupported()) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.bg }]} edges={['top']}>
        <View style={{ padding: theme.spacing.lg, alignItems: 'center' }}>
          <Text
            style={{
              color: t.fg1,
              fontFamily: theme.fonts.display,
              fontSize: theme.fontSize.xl,
              fontWeight: '700',
              marginBottom: theme.spacing.md,
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
              textAlign: 'center',
            }}
          >
            You can still view and log doses manually from the Home screen.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={[styles.content, { padding: theme.spacing.lg }]}>
        <View style={styles.spacer} />
        <NfcTarget size={180} pulsing={state.phase === 'idle' || state.phase === 'scanning'} />
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
          {state.phase === 'scanning'
            ? 'Hold steady…'
            : state.phase === 'resolving'
              ? 'Reading tag…'
              : state.phase === 'error'
                ? "Couldn't read tag"
                : 'Tap to scan'}
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
          {state.phase === 'error'
            ? state.message
            : 'Hold the top of your phone against the Cappy sticker on the bottle.'}
        </Text>
        <View style={styles.spacer} />
        <Button
          label={state.phase === 'error' ? 'Try again' : 'Scan tag'}
          variant="blue"
          size="lg"
          onPress={handleScan}
          disabled={state.phase === 'resolving' || state.phase === 'scanning'}
          loading={state.phase === 'scanning' || state.phase === 'resolving'}
          block
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, alignItems: 'center' },
  spacer: { flex: 1 },
});
