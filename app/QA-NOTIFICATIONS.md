# QA matrix — caregiver dose notifications (ADR-0009, ticket 11)

Push notifications **cannot be tested on a simulator or emulator**. Both
platforms require physical hardware with a real APNs/FCM registration. This
document is the test plan; running it is a manual, device-bound task that no
automated session can do for you.

Scope: the delivery path from `dose_events` INSERT through to a tapped
notification opening the right screen. It does not re-test dose logging
itself — that is covered by the existing suite.

---

## Preconditions

- Two physical devices, each signed into a **different** caregiver account,
  both active members of the **same** family, with at least one child.
- Both installed from the same EAS build (`preview` profile, which points at
  `cappy-dev`).
- Migration `20260801100000_dose_notifications.sql` applied to the target
  project, and the `notify-dose` Edge Function deployed.
- The trigger's function URL and shared secret configured — see the header
  comment block in the migration for exact names.
- Android: FCM v1 credentials uploaded via `eas credentials`, and
  `assetlinks.json` live at `https://cappy.closedose.com/.well-known/assetlinks.json`
  with the **real** signing-cert fingerprint (see `ANDROID-BETA-GUIDE.md`).

Verify App Links resolution before starting, or every deep-link row below
will fail for the wrong reason:

```
adb shell pm get-app-links com.closedose.cappy
```

Every domain must read `verified`. If it reads `legacy_failure`, the
fingerprint in `assetlinks.json` does not match the build's signing cert.

---

## The matrix

2 devices × 2 platforms × 3 app states. Device A logs the dose; device B is
the recipient under test.

| # | Recipient platform | App state on B | Expected |
|---|---|---|---|
| 1 | iOS | Foreground | Banner appears; Realtime already updated the row — no duplicate UI |
| 2 | iOS | Background | Banner + badge; tap opens the read-only dose view for that dose |
| 3 | iOS | Killed (swiped away) | Notification delivered; cold-launch tap lands on the dose, not Home |
| 4 | Android | Foreground | Heads-up on `dose-activity` channel |
| 5 | Android | Background | Notification in tray; tap opens the dose view |
| 6 | Android | Killed | Delivered; cold-launch tap routes correctly |

### Cross-platform pairs

Run at least these four actor→recipient combinations. A token-type or
payload-shape bug frequently only shows on one leg:

- iOS → iOS
- iOS → Android
- Android → iOS
- Android → Android

---

## Behavioural assertions

These are the ones that catch real bugs. Each maps to a decision in ADR-0009.

**Actor exclusion.** The caregiver who logged the dose must NOT be notified.
Check on the logging device, all three app states.

**Fire-and-forget.** With the Edge Function deliberately broken (bad URL, or
the shared secret rotated), logging a dose must still succeed with no
user-visible delay. This is the single most important assertion in this
document — the dose write is the critical operation, the notification is
best-effort. Confirm the row lands and the success overlay appears as normal.
Also verify with the device in airplane mode that the *server-side* path is
unaffected once connectivity returns.

**Per-child mute.** Mute child X on device B. Log a dose for X → no
notification. Log a dose for sibling Y in the same family → notification
arrives. Unmute X → notifications resume.

**Default-on for new caregivers.** Accept a family invite on a fresh account
and log a dose from the other device *without* visiting the Notifications
screen first. It must arrive. (ADR decision 1: the safe state is the
automatic one.)

**Dedup.** Double-tap Log, or log the same client-generated dose UUID twice
after a network retry. Exactly one notification.

**Token rotation.** Reinstall the app on B, sign in, foreground it, then log
a dose from A. It must arrive on the new token. Then confirm the old row was
pruned rather than left to accumulate.

**`DeviceNotRegistered` pruning.** Uninstall on B, log a dose from A, wait
for the receipt pass, and confirm the `device_tokens` row is gone.

**Permission denied.** Deny at the OS prompt. The Notifications screen must
show the banner and render every toggle disabled — a toggle must never look
functional when nothing can be delivered. The deep link to OS settings must
open the right pane on both platforms.

**Priming is never cold.** On a fresh install, confirm the OS dialog does not
appear until after the first successful dose log and an explicit Accept on
the priming sheet. Declining must not fire the OS prompt at all — there is
one chance per install.

**Time Sensitive / channel importance.** iOS: enable a Focus mode and confirm
the notification breaks through. Android: confirm the notification lands on
`dose-activity` at IMPORTANCE_HIGH (Settings → Apps → Cappy → Notifications
should list the channel by name).

---

## Copy review — run this on real notifications, not on the source

Read every delivered notification on the lock screen. Per `AGENTS.md` and the
ADR's copy rules, the body is **actor + amount + child + time** and nothing
more. Reject the build if any notification implies clinical guidance —
"due for a dose", "time for Emma's medication", or similar. A push arrives
stripped of the `dose-safety` line that gives it context in-app, so the bar
is higher here than anywhere else in the product.

---

## Latency

Record wall-clock from tapping Log on A to the banner appearing on B, across
at least 10 sends per platform. ADR-0009 migration signal #1 is a p95 above
30s. Note the number even when it passes — it is the baseline that later
builds get compared against.

---

## Known gaps in this build

- **Adult-recipient doses do not notify.** `dose_events` allows a dose whose
  recipient is an adult caregiver (`caregiver_user_id`); ADR-0009's
  subscription model is per-child only, so the trigger skips those rows.
  Logging a dose for an adult produces no notification for anyone. Deliberate
  for this release, tracked as a follow-up — do not file it as a bug.
- **No read receipts.** There is no way to confirm a caregiver saw a
  notification. Explicitly a non-goal (ADR-0009 "Non-Goals").
- **Delivery is best-effort and a drop is silent.** Acceptable *precisely
  because* push is not the safety mechanism. If anyone on the team starts
  treating a notification as the thing that prevents a double dose, that
  assumption is now the bug — the scan sheet is the safety mechanism.
