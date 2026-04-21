import 'vue-router';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

type RouteMetaResolver = (route: RouteLocationNormalizedLoaded) => string | false;

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    title?: string | RouteMetaResolver;
    description?: string | RouteMetaResolver;
    robots?: string | RouteMetaResolver;
    canonicalPath?: string | false | RouteMetaResolver;
    image?: string | RouteMetaResolver;
    type?: string | RouteMetaResolver;
  }
}

export {};
