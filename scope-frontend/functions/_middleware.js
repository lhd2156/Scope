const CANONICAL_APP_HOST = 'scopetrips.com';
const LEGACY_APP_HOSTS = new Set(['app.scopetrips.com']);
const REDIRECT_SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function onRequest(context) {
  const incomingUrl = new URL(context.request.url);
  if (!LEGACY_APP_HOSTS.has(incomingUrl.hostname)) {
    return context.next();
  }

  incomingUrl.hostname = CANONICAL_APP_HOST;
  return new Response(null, {
    status: 301,
    headers: {
      Location: incomingUrl.toString(),
      ...REDIRECT_SECURITY_HEADERS,
    },
  });
}
