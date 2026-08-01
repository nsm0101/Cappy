import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, MemberAvatar, NotificationPrimingSheet, RowItem, Switch } from '@/components';
import {
  children as childrenApi,
  notifications as notificationsApi,
  type Child,
  type NotificationPermission,
} from '@/api';
import { useTheme } from '@/theme';
import { useActiveFamily } from '@/family/ActiveFamilyContext';
import { initialsFromName } from '@/lib';

/**
 * Per-child notification settings (ADR-0009, "Settings surface").
 *
 * A caregiver hears about a dose only for children they are subscribed to.
 * Notifications here are *awareness* of what another caregiver has already
 * recorded — never a prompt to give a dose. All copy on this screen is held
 * to that line, and guarded by `components/__tests__/notificationCopy.test.ts`.
 *
 * Unless permission is granted, every toggle on this screen would be a lie:
 * nothing can be delivered no matter what a row says. In that state the
 * screen shows an inset banner above the list and renders every switch
 * disabled. The two not-granted states are not the same and must not share
 * copy:
 *
 *  - `denied`       — the one OS prompt was spent. The only way back is the
 *                     device settings deep link (ADR-0009 "Permission-denied
 *                     state").
 *  - `undetermined` — the prompt has never been shown. Sending the caregiver
 *                     to device settings here would be wrong; the priming
 *                     sheet is offered instead, which keeps the OS dialog
 *                     firing from exactly one place in the app.
 */
export const NotificationsScreen: React.FC = () => {
  const theme = useTheme();
  const t = theme.tokens;
  const { activeFamily } = useActiveFamily();

  const [kids, setKids] = useState<Child[]>([]);
  /** childId -> enabled. Optimistic; rolled back if the write does not land. */
  const [subs, setSubs] = useState<Record<string, boolean>>({});
  const [permission, setPermission] = useState<NotificationPermission>('granted');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [primingVisible, setPrimingVisible] = useState(false);

  const granted = permission === 'granted';

  const load = useCallback(async () => {
    if (!activeFamily) {
      setKids([]);
      setSubs({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorText(null);
    try {
      const [childList, status, subscriptions] = await Promise.all([
        childrenApi.listChildrenInFamily(activeFamily.id),
        notificationsApi.getPermissionStatus(),
        notificationsApi.listMySubscriptions(),
      ]);
      setKids(childList);
      setPermission(status);
      setSubs(Object.fromEntries(subscriptions.map((s) => [s.childId, s.enabled])));
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : 'Could not load your notification settings.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeFamily]);

  useEffect(() => {
    void load();
  }, [load]);

  // The caregiver can leave for the OS settings app and flip permission there.
  // Re-read on every return to the foreground so the banner and the disabled
  // state reflect reality rather than what was true on mount.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void notificationsApi
        .getPermissionStatus()
        .then(setPermission)
        .catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  const handleToggle = useCallback(async (child: Child, next: boolean) => {
    // Optimistic — the switch must feel instant. Reverted below if the write
    // does not land, so the row never claims a subscription the server does
    // not have.
    setSubs((prev) => ({ ...prev, [child.id]: next }));
    const ok = await notificationsApi.setSubscriptionEnabled(child.id, next);
    if (ok) return;
    setSubs((prev) => ({ ...prev, [child.id]: !next }));
    Alert.alert(
      'Could not save that change',
      `${child.display_name}'s notification setting was not saved. Please try again.`,
    );
  }, []);

  const handleOpenSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        'Could not open settings',
        'Open your device Settings app, find Cappy, and turn on Notifications.',
      );
    }
  }, []);

  // Accepting the priming sheet is the only path in the app that fires the OS
  // dialog. There is one chance at it per install, so it is never fired from
  // a bare tap on this screen.
  const handlePrimingAccept = useCallback(async () => {
    setPrimingVisible(false);
    await notificationsApi.requestPermission();
    setPermission(await notificationsApi.getPermissionStatus());
  }, []);

  const rows = useMemo(
    () =>
      kids.map((child, index) => {
        // A child with no subscription row is subscribed by default —
        // ADR-0009 decision 1 makes the safe state the automatic one.
        const enabled = subs[child.id] ?? true;
        const subtitle = !granted
          ? 'Paused until notifications are on'
          : enabled
            ? 'Dose logs from other caregivers'
            : 'Muted';
        return (
          <View key={child.id}>
            {index > 0 ? (
              <View
                style={[
                  styles.divider,
                  {
                    backgroundColor: t.hairline,
                    // Align under the title, past the avatar and the row gap.
                    marginLeft: theme.spacing.base + 44 + theme.spacing.md,
                  },
                ]}
              />
            ) : null}
            <RowItem
              title={child.display_name}
              subtitle={subtitle}
              showChevron={false}
              leftSlot={
                <MemberAvatar
                  avatarPath={child.avatar_url}
                  initials={initialsFromName(child.display_name)}
                  tint={theme.palette.blue[500]}
                  size="md"
                />
              }
              rightSlot={
                <Switch
                  value={enabled}
                  disabled={!granted}
                  onValueChange={(next) => void handleToggle(child, next)}
                  accessibilityLabel={`Dose notifications for ${child.display_name}`}
                  accessibilityHint={
                    granted
                      ? 'Tells you when another caregiver logs a dose for this child.'
                      : 'Unavailable until notifications are turned on for Cappy.'
                  }
                />
              }
              // The row is a container, not a control — the switch owns the
              // interaction so a screen reader gets one target, not two.
              style={styles.rowInCard}
            />
          </View>
        );
      }),
    [kids, subs, granted, handleToggle, t.hairline, theme.spacing, theme.palette],
  );

  const primingChildName = kids[0]?.display_name ?? '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxxl,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xxl,
            fontWeight: '800',
            marginBottom: theme.spacing.sm,
          }}
        >
          Notifications
        </Text>
        <Text
          style={{
            color: t.fg3,
            fontFamily: theme.fonts.sans,
            fontSize: theme.fontSize.sm,
            lineHeight: theme.lineHeight.sm,
            marginBottom: theme.spacing.lg,
          }}
        >
          Cappy tells you when another caregiver logs a dose. It shares what has already been
          recorded — it does not tell you when to give a dose.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={t.brand} />
          </View>
        ) : errorText ? (
          <Card style={styles.errorCard}>
            <Ionicons name="warning-outline" size={24} color={t.error} />
            <Text
              style={{
                color: t.fg1,
                fontFamily: theme.fonts.sans,
                fontSize: theme.fontSize.base,
                textAlign: 'center',
                marginTop: theme.spacing.sm,
                marginBottom: theme.spacing.base,
              }}
            >
              {errorText}
            </Text>
            <Button label="Try again" variant="secondary" onPress={() => void load()} />
          </Card>
        ) : !activeFamily ? (
          <Card inset style={styles.emptyCard}>
            <Ionicons
              name="people-outline"
              size={36}
              color={t.fgMuted}
              style={styles.emptyIcon}
            />
            <Text style={[styles.emptyText, { color: t.fg2, fontFamily: theme.fonts.sans }]}>
              Start by creating or joining a family to choose who you hear about.
            </Text>
          </Card>
        ) : kids.length === 0 ? (
          <Card inset style={styles.emptyCard}>
            <Ionicons name="body-outline" size={36} color={t.fgMuted} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: t.fg2, fontFamily: theme.fonts.sans }]}>
              Add a child to {activeFamily.name} to choose who you hear about.
            </Text>
          </Card>
        ) : (
          <>
            {/*
              Permission banner. Sits above the list so it is read before any
              toggle is, and every switch below it is disabled — a toggle must
              never look functional when nothing can be delivered.
            */}
            {!granted ? (
              <Card inset style={styles.bannerCard}>
                <View style={styles.bannerHead}>
                  <Ionicons name="notifications-off-outline" size={22} color={t.warn} />
                  <Text
                    style={{
                      flex: 1,
                      color: t.fg1,
                      fontFamily: theme.fonts.sansSemibold,
                      fontSize: theme.fontSize.base,
                      fontWeight: '600',
                    }}
                  >
                    {permission === 'denied'
                      ? 'Notifications are turned off for Cappy in your device settings'
                      : 'Cappy has not been given permission to send notifications'}
                  </Text>
                </View>
                <Text
                  style={{
                    color: t.fg2,
                    fontFamily: theme.fonts.sans,
                    fontSize: theme.fontSize.sm,
                    lineHeight: theme.lineHeight.sm,
                    marginTop: theme.spacing.sm,
                    marginBottom: theme.spacing.base,
                  }}
                >
                  Until they are on, nothing below can reach you — even for a child that is
                  switched on here.
                </Text>
                {permission === 'denied' ? (
                  <Button
                    label="Open device settings"
                    variant="primary"
                    block
                    onPress={() => void handleOpenSettings()}
                    accessibilityHint="Opens Cappy's notification settings on your device."
                  />
                ) : (
                  <Button
                    label="Turn on notifications"
                    variant="primary"
                    block
                    onPress={() => setPrimingVisible(true)}
                    accessibilityHint="Explains what you would be told, then asks your device for permission."
                  />
                )}
              </Card>
            ) : null}

            <Text style={[styles.sectionTitle, { color: t.fg3, fontSize: theme.fontSize.xs }]}>
              CHILDREN
            </Text>
            <Card style={styles.listCard}>{rows}</Card>
          </>
        )}
      </ScrollView>

      <NotificationPrimingSheet
        visible={primingVisible}
        childName={primingChildName}
        onAccept={handlePrimingAccept}
        onDecline={() => setPrimingVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { paddingVertical: 48, alignItems: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { marginBottom: 12 },
  emptyText: { fontSize: 16, textAlign: 'center', lineHeight: 20 },
  errorCard: { alignItems: 'center', paddingVertical: 24 },
  bannerCard: { marginBottom: 20 },
  bannerHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // The card supplies the chrome; each row inside it is flat, separated by a
  // hairline, so the group reads as one card rather than a stack of cards.
  listCard: { padding: 0, overflow: 'hidden' },
  rowInCard: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0 },
  divider: { height: StyleSheet.hairlineWidth },
  sectionTitle: {
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
});
