const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'scopetrips.com';
    return new Response(null, {
      status: 301,
      headers: {
        Location: url.toString(),
        ...SECURITY_HEADERS,
      },
    });
  },
};
