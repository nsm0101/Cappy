# Shipping the Android beta

Cappy is an Expo-managed project with no committed `android/` folder, so
there's nothing to open in Android Studio and no local SDK setup needed.
EAS Build compiles the whole app in the cloud from `app.json` + `eas.json`.
This can't be triggered from an automated session — it needs your own
authenticated `eas` CLI session — so run these steps yourself.

## One-time setup

```bash
npm install -g eas-cli        # or: npx eas-cli <command>, no global install
eas login                     # opens a browser to sign in to your Expo account
```

Use the Expo account tied to this project (`owner: "closedose"` in
`app.json`, project id `0e2eeb80-067e-4a75-bd36-665e7486c744`). If you don't
have access yet, create a free account at expo.dev and ask whoever owns the
`closedose` Expo organization to invite you.

## Build the beta

```bash
cd app
eas build --platform android --profile preview
```

The `preview` profile in `eas.json` is already set up for this:
- `"distribution": "internal"` — produces an installable `.apk` with a
  private install link, no Play Store listing or review needed
- Points at the `cappy-dev` Supabase project (safe to test against — not
  production data)
- `appVersionSource: "remote"` in the `cli` block means EAS auto-increments
  the Android `versionCode` on its own servers for each build — you don't
  need to hand-edit `app.json` between beta builds

The build runs in Expo's cloud (10–20 minutes typically). When it finishes,
the CLI prints a build details URL — that's also the distribution page.

## Send it to a tester

1. Open the build details URL (or run `eas build:list --platform android
   --limit 1` later to find it again) — it shows a QR code and an **Install**
   button.
2. Send that URL to your tester (text, email, Slack — anything). They need
   to open it **on the Android phone itself**, not scan it from a second
   device, unless they're scanning with that phone's camera.
3. Tapping Install downloads the APK straight from Expo's servers. Android
   will ask to allow "install unknown apps" for whichever app they opened
   the link in (Chrome, Gmail, etc.) — that's expected for a non-Play-Store
   install; they approve it once.
4. The app installs and opens like any other app. No Play Console account,
   no app listing, no review wait.

## Before you hand it off

- Make sure the tester has a physical Android phone with NFC hardware (the
  core flow is tap-a-sticker-to-log-a-dose). HCE "tap to send an invite" now
  degrades gracefully on phones without HCE support (see the fix in
  `plugins/withNfcHce.js`) — it just won't offer that specific feature, it
  won't block installing or using the app.
- Program at least one NTAG213/215/216 sticker with
  `https://cappy.closedose.com/t/ace-child` or `.../t/ibu-child` (NFC Tools
  app on Android, or any NDEF-URI writer) so there's something to tap.
- Have the tester sign up, create or join a family, add a child with a
  weight, then tap the sticker to log a dose.

## Re-running for a new beta build

Just re-run `eas build --platform android --profile preview` after pushing
new commits — no version bumps or config changes needed for routine beta
iterations.

---

# Push notifications on Android (ADR-0009)

Everything on the app side is already in the repo: the `POST_NOTIFICATIONS`
permission is declared in `app.json`, and the `dose-activity` channel is
created at runtime on every launch by `src/api/notifications.ts`. Nothing
below can be done from an automated session — each step needs your own
authenticated `eas` / Cloudflare / Firebase session.

Until steps 1 and 2 are done, an Android build installs and runs fine, but
`getExpoPushTokenAsync()` fails, no row lands in `device_tokens`, and that
device silently receives nothing. That is by design — token capture fails
soft — so **the absence of an error is not evidence that this works.** Check
for a `device_tokens` row.

## 1. FCM v1 credentials (~30 min, one-time)

Expo Push delivers to Android through Firebase Cloud Messaging, so the
project needs an FCM v1 service account key.

1. Create a Firebase project (free Spark tier is enough) at
   <https://console.firebase.google.com> and add an **Android app** to it with
   package name **`com.closedose.cappy`** — it must match `android.package` in
   `app.json` exactly.
2. Download the generated `google-services.json`, save it to `app/`, and add
   it to `.gitignore` — it is a config file, not a secret, but there is no
   reason to commit it.
3. Point `app.json` at it by adding one key inside the `android` block:

   ```json
   "googleServicesFile": "./google-services.json"
   ```

   This line is deliberately **not** committed yet: `expo prebuild` and every
   EAS build fail immediately if the file it references is missing, which
   would block everyone else on the project. Add it in the same commit as the
   file.
4. In the Firebase console: **Project settings → Service accounts → Generate
   new private key**. That downloads a JSON key.
5. Upload it to EAS, from `app/`:

   ```bash
   eas credentials --platform android
   #   → pick the build profile
   #   → "Google Service Account"
   #   → "Manage your Google Service Account Key for Push Notifications (FCM V1)"
   #   → upload the JSON from step 4
   ```

Rebuild after this. FCM credentials are read at build time, not at runtime.

## 2. App Links — `assetlinks.json` (~20 min, one-time)

`app.json` already declares `autoVerify: true` intent filters for
`cappy.closedose.com`. Android only honours that if it can fetch a matching
`assetlinks.json` from the domain; without it, tapping a link shows a
"open with" chooser dialog instead of going straight to Cappy.

The file is served by the Cloudflare Worker at `/aasa-worker.js` (repo root),
the same one that serves the Apple AASA. It builds the JSON from a Worker
secret, because the signing-cert fingerprint is not in this repo and must not
be committed.

**Get the fingerprint** — from `app/`:

```bash
eas credentials --platform android
#   → pick the build profile (`preview` for the beta)
#   → "Keystore: Manage everything needed to build your project"
#   → read the "SHA256 Fingerprint" line
```

It looks like `AB:CD:EF:...` — 32 colon-separated hex pairs.

**Publish it:**

```bash
# from the repo root
npx wrangler secret put ANDROID_CERT_SHA256
# paste the fingerprint when prompted
npx wrangler deploy
```

**Verify** — the URL must return JSON, not a 503:

```bash
curl -s https://cappy.closedose.com/.well-known/assetlinks.json
```

Then, with the app installed on a device:

```bash
adb shell pm get-app-links com.closedose.cappy
```

Every domain must read `verified`. `legacy_failure` means the published
fingerprint does not match the fingerprint of the installed build — the usual
cause is publishing the upload key while testing a Play-signed build.

> If you later ship through Google Play, Play re-signs the app with its own
> key. You then need **both** fingerprints in the secret, comma-separated: the
> upload key (from `eas credentials`) and the Play App Signing key (Play
> Console → Release → Setup → App integrity).

`app/public/.well-known/assetlinks.json` is a checked-in mirror of the shape
the Worker serves. Its fingerprint value is the literal string
`PLACEHOLDER_NOT_A_REAL_FINGERPRINT_SEE_ANDROID_BETA_GUIDE` — that file is
documentation, it is not what the domain serves, and it must never be
deployed as-is.

## 3. Decisions still open

Two things were deliberately left out of the config rather than guessed at.
Neither blocks the beta.

**The `expo-notifications` config plugin is not in `app.json`.** It is only
needed for a custom Android notification icon/colour and the FCM default
channel, and:

- there is no monochrome notification icon in `src/assets/` — Android needs a
  96×96 all-white-with-transparency PNG, and pointing the plugin at the
  existing full-colour `cappy-icon.png` renders as a white blob;
- the plugin's iOS side writes `aps-environment` into the entitlements, and
  its default is `development`. That is a build-signing decision, not a
  notification decision, and it should be made on purpose.

Consequence today: Android notifications use the default app-icon silhouette,
and the `notify-dose` Edge Function **must** send `channelId: "dose-activity"`
explicitly on every message — there is no default-channel fallback. Add the
plugin once a monochrome icon exists:

```json
["expo-notifications", { "icon": "./src/assets/notification-icon.png",
                         "color": "#36A99A",
                         "defaultChannel": "dose-activity" }]
```

**The iOS Time Sensitive entitlement is not in `app.json`.** ADR-0009
decision 5 calls for `interruptionLevel: "time-sensitive"`, which needs
`com.apple.developer.usernotifications.time-sensitive` in
`ios.entitlements`. It is self-service (no Apple review), but adding an
entitlement changes the provisioning profile and can fail a build if the
capability is not enabled on the App ID — so it belongs in an iOS build that
someone is watching, not in a drive-by config change. Without it, iOS
notifications still deliver; they just do not break through Focus/DND.

## 4. What to check on the device

The full test plan is `QA-NOTIFICATIONS.md`. The Android-specific smoke test:

- Android 13+ shows a runtime permission prompt. It must appear only after
  the in-app priming sheet, never on launch.
- Settings → Apps → Cappy → Notifications lists a channel named
  **Dose activity**, set to "Urgent"/high importance.
- A delivered notification pops as a heads-up banner.
- On a locked screen the channel is set to hide its contents — that is
  intentional, the body names a child and a medication.
- Tapping the notification opens the dose directly, with no chooser dialog.
