// Shared utilities for Edge Functions.
// Deno runtime — note the import URL style.

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
};

export const json = (
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  });

export const problem = (status: number, title: string, detail?: string): Response =>
  new Response(
    JSON.stringify({
      type: 'about:blank',
      title,
      status,
      ...(detail ? { detail } : {}),
    }),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/problem+json',
      },
    },
  );

export const handleCorsPreflight = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  return null;
};

export const getEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};
