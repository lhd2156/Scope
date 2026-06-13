const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; object-src 'none'",
};

const UPSTREAM_FINGERPRINT_HEADERS = [
  'X-Powered-By',
  'X-AspNet-Version',
  'X-AspNetMvc-Version',
];

function withCanonicalSecurityHeaders(response) {
  if (response.webSocket) {
    return response;
  }

  const headers = new Headers(response.headers);

  for (const name of [...Object.keys(SECURITY_HEADERS), ...UPSTREAM_FINGERPRINT_HEADERS]) {
    headers.delete(name);
  }

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(request.url);
    upstreamUrl.hostname = 'api.scopetrips.com';

    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set('X-Forwarded-Host', incomingUrl.hostname);
    upstreamHeaders.set('X-Forwarded-Proto', incomingUrl.protocol.replace(':', ''));

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });

    return withCanonicalSecurityHeaders(upstreamResponse);
  },
};
