import 'vue-router';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

type RouteMetaValue = string | false | ((route: RouteLocationNormalizedLoaded) => string | false);

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    title?: RouteMetaValue;
    description?: RouteMetaValue;
    robots?: RouteMetaValue;
    canonicalPath?: RouteMetaValue;
    image?: RouteMetaValue;
    type?: RouteMetaValue;
  }
}
