# App Store Submission Checklist — Cappy iOS

A practical, ordered checklist to take this build from "opens in Xcode" to
"submitted for review." Items marked **(code done)** are already handled in this
repo; the rest require your Apple Developer account and App Store Connect.

## 1. Signing & capabilities
- [ ] Set **Team** for both `Cappy` and `CappyWidgetExtension` targets.
- [ ] Confirm the App ID (`com.closedose.cappy`) has these capabilities enabled
      in the developer portal (entitlements are already committed — **code done**):
  - [ ] NFC Tag Reading
  - [ ] Sign in with Apple
  - [ ] Associated Domains — `applinks:cappy.closedose.com`
  - [ ] App Groups — `group.com.closedose.cappy`
- [ ] Host the AASA file at `https://cappy.closedose.com/.well-known/apple-app-site-association`
      for Universal Links (the repo already has `aasa-worker.js` at the root).

## 2. Backend
- [X] Supabase Apple provider enabled with `com.closedose.cappy` as an authorized
      client ID.
- [X] `avatars` storage bucket exists and is private (**already in migrations**).
- [X] Edge Functions `nfc-resolve` and `accept-invite` deployed (**already in repo**).

## 3. App metadata (App Store Connect)
- [ ] App name, subtitle, category (Medical or Health & Fitness).
- [ ] Privacy Policy URL + Terms URL (drafts in `/legal`).
- [ ] **App Privacy** answers — mirror `Cappy/Resources/PrivacyInfo.xcprivacy`
      (**code done**): collects Name, Email, Health (weight), Photos — all linked
      to identity, none used for tracking.
- [ ] Age rating questionnaire (note: handles children's health data).
- [ ] Export compliance: uses only exempt encryption (`ITSAppUsesNonExemptEncryption = false`, **code done**).

## 4. Assets
- [X] 1024×1024 App Icon (**code done** — `AppIcon-1024.png`, no alpha).
- [ ] Screenshots for 6.7" and 6.1" iPhones (Home, Scan, Dose sheet, Timeline).
- [ ] Create App Preview video.

## 5. Medical-app review notes (important)
- [ ] In *App Review Information → Notes*, state clearly that **Cappy is a
      coordination tool, not a medical device**: it records doses and shows
      timing, and does not diagnose, calculate a substitute for professional
      advice, or auto-administer. This framing is reinforced throughout the UI
      (disclaimers on the dose sheet, sign-in, and settings).
- [ ] Provide a demo account (email + password) so reviewers can sign in without
      Apple ID, plus a note that NFC is device-only with an in-app manual
      fallback.

## 6. Build & upload
- [ ] Select a real device or "Any iOS Device" and **Product → Archive**.
- [ ] Validate the archive (checks entitlements, icons, privacy manifest).
- [ ] Upload to App Store Connect via the Organizer.
- [ ] Attach the build to your version, answer compliance, and submit.

## 7. Pre-flight smoke test (device)
- [ ] Sign in with Apple and with email/password.
- [ ] Complete caregiver setup (name, DOB ≥ 18, consent).
- [ ] Create a family, add a child, record a weight (manual entry).
- [ ] Tap an NFC sticker → dose sheet → log a dose → success + reminder.
- [ ] Confirm the dose appears on Timeline on a second device within seconds.
- [ ] Add the Home Screen widget; confirm a Live Activity appears after logging.
- [ ] Toggle Light/Dark in Settings.

---
Generated for the native iOS rebuild. Keep in sync with `README.md`.
