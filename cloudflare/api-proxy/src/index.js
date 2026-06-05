export default {
  fetch(request) {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(request.url);
    upstreamUrl.hostname = 'api.scopetrips.com';

    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set('X-Forwarded-Host', incomingUrl.hostname);

    return fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });
  },
};
