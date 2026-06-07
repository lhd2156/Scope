const CANONICAL_APP_HOST = 'scopetrips.com';
const LEGACY_APP_HOSTS = new Set(['app.scopetrips.com']);

export function onRequest(context) {
  const incomingUrl = new URL(context.request.url);
  if (!LEGACY_APP_HOSTS.has(incomingUrl.hostname)) {
    return context.next();
  }

  incomingUrl.hostname = CANONICAL_APP_HOST;
  return Response.redirect(incomingUrl.toString(), 301);
}
