import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Sheet } from './Sheet';

export type NotificationPrimingSheetProps = {
  visible: boolean;
  /** Child the caregiver just logged a dose for — makes the value concrete. */
  childName: string;
  /**
   * The caregiver said yes. The host must call
   * `notifications.requestPermission()` here — this is the only place the OS
   * dialog may be fired, and there is exactly one chance at it per install.
   * May be async; the accept button shows a spinner while it settles.
   */
  onAccept: () => void | Promise<void>;
  /**
   * The caregiver said no, or dismissed the sheet. Must NOT fire the OS
   * dialog. Per ADR-0009 the host may re-prime after a later dose logged by
   * a different caregiver.
   */
  onDecline: () => void;
};

/**
 * Permission priming sheet (ADR-0009, "Permission priming").
 *
 * The OS notification dialog is never fired cold — there is exactly one
 * chance at it per install, and a cold prompt at onboarding wastes it before
 * the caregiver has any reason to say yes. This sheet is shown *after* the
 * first successful dose log, when the value is concrete.
 *
 * Controlled: the screen that triggers it owns `visible` and both outcomes.
 * The sheet itself is presentational and touches no API — mount it like this:
 *
 * ```tsx
 * const [priming, setPriming] = useState(false);
 * // ...after a successful dose write, and only if permission is undetermined:
 * setPriming(true);
 *
 * <NotificationPrimingSheet
 *   visible={priming}
 *   childName={child.display_name}
 *   onAccept={async () => {
 *     setPriming(false);
 *     await notifications.requestPermission();
 *   }}
 *   onDecline={() => setPriming(false)}
 * />
 * ```
 */
export const NotificationPrimingSheet: React.FC<NotificationPrimingSheetProps> = ({
  visible,
  childName,
  onAccept,
  onDecline,
}) => {
  const theme = useTheme();
  const t = theme.tokens;
  const [requesting, setRequesting] = React.useState(false);

  // Reset the in-flight state whenever the sheet is dismissed, so a re-prime
  // after a later dose never opens onto a stuck spinner.
  React.useEffect(() => {
    if (!visible) setRequesting(false);
  }, [visible]);

  const handleAccept = React.useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      await onAccept();
    } finally {
      setRequesting(false);
    }
  }, [onAccept, requesting]);

  return (
    <Sheet
      visible={visible}
      onClose={onDecline}
      accessibilityLabel="Turn on dose notifications"
    >
      <View style={styles.body}>
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: t.brandTint, borderColor: t.border },
          ]}
        >
          <Ionicons name="notifications-outline" size={28} color={t.brand} />
        </View>

        <Text
          accessibilityRole="header"
          style={{
            color: t.fg1,
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.xl,
            fontWeight: '700',
            textAlign: 'center',
            marginTop: theme.spacing.base,
          }}
        >
          Know when a dose is logged
        </Text>

        <Text
          style={{
            color: t.fg2,
            fontFamily: theme.fonts.sans,
            fontSize: theme.fontSize.base,
            lineHeight: theme.lineHeight.base,
            textAlign: 'center',
            marginTop: theme.spacing.sm,
          }}
        >
          Get told when another caregiver logs a dose for {childName} — even when Cappy is
          closed.
        </Text>

        <Text
          style={{
            color: t.fg3,
            fontFamily: theme.fonts.sans,
            fontSize: theme.fontSize.sm,
            lineHeight: theme.lineHeight.sm,
            textAlign: 'center',
            marginTop: theme.spacing.md,
          }}
        >
          Cappy shares what another caregiver has already recorded. It does not tell you when
          to give a dose.
        </Text>
      </View>

      <View style={{ height: theme.spacing.xl }} />

      <Button
        label="Turn on notifications"
        variant="primary"
        size="lg"
        block
        loading={requesting}
        onPress={handleAccept}
        accessibilityLabel="Turn on dose notifications"
        accessibilityHint="Asks your device for permission to send notifications."
      />
      <View style={{ height: theme.spacing.sm }} />
      <Button
        label="Not now"
        variant="ghost"
        block
        disabled={requesting}
        onPress={onDecline}
        accessibilityHint="Closes without asking your device for permission."
      />

      <Text
        style={{
          color: t.fgMuted,
          fontFamily: theme.fonts.sans,
          fontSize: theme.fontSize.xs,
          textAlign: 'center',
          marginTop: theme.spacing.md,
        }}
      >
        You can change this any time in Settings.
      </Text>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});
