const API_ORIGIN = 'https://api.scopetrips.com';

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function buildUpstreamRequest(request) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, API_ORIGIN);
  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');

  return new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
}

export async function onRequest({ request }) {
  try {
    const upstreamResponse = await fetch(buildUpstreamRequest(request));
    const upstreamContentType = upstreamResponse.headers.get('Content-Type') || '';
    if (
      (upstreamResponse.status >= 520 && upstreamResponse.status <= 530) ||
      (upstreamResponse.status >= 500 && !upstreamContentType.toLowerCase().includes('application/json'))
    ) {
      return jsonResponse(502, {
        error: {
          code: 'api_proxy_unavailable',
          message: 'Scope API is not reachable from Cloudflare yet.',
        },
      });
    }

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set('Cache-Control', 'no-store');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch {
    return jsonResponse(502, {
      error: {
        code: 'api_proxy_unavailable',
        message: 'Scope API is not reachable from Cloudflare yet.',
      },
    });
  }
}
