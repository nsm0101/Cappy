// Cloudflare Worker for cappy.closedose.com
//
// 1. Serves the Apple App Site Association file for Universal Links /
//    NFC tap-to-open (inline JSON guarantees the correct content-type).
// 2. Serves a branded HTML fallback page for /t/{slug} and /join/{code}
//    so a QR scan or NFC tap that does NOT open the app (app not
//    installed, link opened in Safari, Android device) lands on a real
//    page with an "Open in Cappy!" button instead of dead plain text.

const AASA = {
  applinks: {
    details: [
      {
        appIDs: ['H2AGCK2WB8.com.closedose.cappy'],
        components: [
          { '/': '/t/*', comment: 'NFC tag deep links' },
          { '/': '/join/*', comment: 'Family invite deep links' },
        ],
      },
    ],
  },
};

const MED_NAMES = {
  'ace-child': "Children's Acetaminophen",
  'ibu-child': "Children's Ibuprofen",
};

// TestFlight public link until the App Store listing is live.
// TODO: replace with the App Store URL at launch.
const STORE_URL = 'https://testflight.apple.com/join/REPLACE_ME';

const esc = (s) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );

const fallbackPage = (kind, value) => {
  const isTag = kind === 't';
  const med = isTag ? MED_NAMES[value.toLowerCase()] : null;
  const deepLink = `cappy://${kind}/${encodeURIComponent(value)}`;
  const title = isTag
    ? med
      ? `Log a ${med} dose`
      : 'Log a dose'
    : "You're invited to a Cappy! family";
  const sub = isTag
    ? 'Open Cappy! to check dose safety and log this medication.'
    : 'Open Cappy! to accept the invite and join the family.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cappy! — ${esc(title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-height: 100dvh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(160deg, #eef7ff 0%, #f7fbff 60%, #eafaf3 100%);
    color: #10324a; padding: 24px;
  }
  @media (prefers-color-scheme: dark) {
    body { background: linear-gradient(160deg, #071722 0%, #0a1e2c 60%, #07231a 100%); color: #e8f4ff; }
    .card { background: rgba(255,255,255,0.06); }
    .hint { color: #9db8c9; }
  }
  .card {
    background: #ffffff; border-radius: 24px; padding: 40px 28px; max-width: 420px; width: 100%;
    text-align: center; box-shadow: 0 12px 40px rgba(16,50,74,0.12);
  }
  .wordmark { font-size: 44px; font-weight: 800; letter-spacing: -1px; margin-bottom: 4px; }
  .wordmark span { color: #1b9aaa; }
  h1 { font-size: 22px; margin: 18px 0 8px; }
  p { font-size: 15px; line-height: 1.5; }
  .hint { color: #5b7a90; font-size: 13px; margin-top: 20px; }
  .btn {
    display: block; margin: 26px auto 0; padding: 16px 22px; border-radius: 16px;
    background: #1b9aaa; color: #fff; font-size: 17px; font-weight: 700;
    text-decoration: none; max-width: 300px;
  }
  .btn.secondary { background: transparent; color: #1b9aaa; border: 2px solid #1b9aaa; margin-top: 12px; padding: 14px 22px; }
</style>
</head>
<body>
  <main class="card">
    <div class="wordmark">Cappy<span>!</span></div>
    <p>Smart, safe dose tracking for the whole family.</p>
    <h1>${esc(title)}</h1>
    <p>${esc(sub)}</p>
    <a class="btn" href="${deepLink}">Open in Cappy!</a>
    <a class="btn secondary" href="${STORE_URL}">Get the app</a>
    <p class="hint">If the app is installed, scanning the sticker opens Cappy! automatically.</p>
  </main>
  <script>
    // Best-effort auto-open: if Cappy! is installed but the Universal Link
    // fell through to Safari, kick over to the custom scheme once.
    setTimeout(function () { window.location.href = ${JSON.stringify(deepLink)}; }, 400);
  </script>
</body>
</html>`;
};

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === '/.well-known/apple-app-site-association' || pathname === '/apple-app-site-association') {
      return new Response(JSON.stringify(AASA), {
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=3600',
        },
      });
    }

    const match = pathname.match(/^\/(t|join)\/([A-Za-z0-9_-]{2,64})\/?$/);
    if (match) {
      return new Response(fallbackPage(match[1], match[2]), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=300',
        },
      });
    }

    return new Response('Cappy', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  },
};
