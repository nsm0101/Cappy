// Cloudflare Worker for cappy.closedose.com.
//
// Serves the two association files that make a tapped link open the Cappy app
// instead of a browser:
//
//   /.well-known/apple-app-site-association  → iOS Universal Links
//   /.well-known/assetlinks.json             → Android App Links
//
// Both are inlined so the correct application/json content-type is guaranteed
// with no static-file detection. Neither file contains PHI — they are public
// by design and carry only a bundle id, a package name, and signing-cert
// fingerprints.
//
// The AASA below must stay in sync with
// app/public/.well-known/apple-app-site-association, which is the checked-in
// mirror. (It drifted once: the worker was missing `/join/*`, so Quick Share
// invite links opened Safari instead of the app. Fixed here.)

const AASA = {
  applinks: {
    details: [
      {
        appIDs: ['H2AGCK2WB8.com.closedose.cappy'],
        components: [
          { '/': '/t/*', comment: 'NFC tag deep links' },
          { '/': '/join/*', comment: 'Quick Share caregiver invite links' },
        ],
      },
    ],
  },
};

const ANDROID_PACKAGE = 'com.closedose.cappy';

// The SHA-256 signing-cert fingerprint is NOT in this repo and must not be
// committed here — it comes from the Android keystore EAS holds. Supply it at
// deploy time as a Worker secret:
//
//   npx wrangler secret put ANDROID_CERT_SHA256
//
// Get the value by running, from `app/`:
//
//   npx eas-cli credentials --platform android
//     → pick the build profile (`preview` for the beta)
//     → "Keystore: Manage everything needed to build your project"
//     → read the "SHA256 Fingerprint" line
//
// Format: colon-separated uppercase hex, e.g. AB:CD:...:EF (32 pairs).
//
// If Cappy is ever distributed through Google Play, Play re-signs the app with
// its own key, so BOTH fingerprints must be listed: the upload key (above) and
// the Play App Signing key (Play Console → Release → Setup → App integrity).
// Put both in the one secret, comma-separated.
const readFingerprints = (env) =>
  String(env?.ANDROID_CERT_SHA256 ?? '')
    .split(',')
    .map((fp) => fp.trim().toUpperCase())
    .filter(Boolean);

const json = (body) =>
  new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600',
    },
  });

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/.well-known/apple-app-site-association') {
      return json(AASA);
    }

    if (pathname === '/.well-known/assetlinks.json') {
      const sha256CertFingerprints = readFingerprints(env);
      if (sha256CertFingerprints.length === 0) {
        // Fail loudly instead of publishing a placeholder. A wrong fingerprint
        // and a missing file both break App Links verification, but only one of
        // them is obvious to whoever curls this URL.
        return new Response(
          'assetlinks.json is not configured: set the ANDROID_CERT_SHA256 Worker ' +
            'secret (see the comment in aasa-worker.js).\n',
          { status: 503, headers: { 'content-type': 'text/plain' } },
        );
      }
      return json([
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: ANDROID_PACKAGE,
            sha256_cert_fingerprints: sha256CertFingerprints,
          },
        },
      ]);
    }

    return new Response('Cappy', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  },
};
