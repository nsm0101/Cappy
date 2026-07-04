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
