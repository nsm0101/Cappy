// Cloudflare Worker that serves the Apple App Site Association file for
// Universal Links / NFC tap-to-open. Inline JSON guarantees the correct
// application/json content-type with no static-file detection needed.

const AASA = {
  applinks: {
    details: [
      {
        appIDs: ['H2AGCK2WB8.com.closedose.cappy'],
        components: [{ '/': '/t/*', comment: 'NFC tag deep links' }],
      },
    ],
  },
};

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/.well-known/apple-app-site-association') {
      return new Response(JSON.stringify(AASA), {
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'cache-control': 'public, max-age=3600',
        },
      });
    }
    return new Response('Cappy', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  },
};
