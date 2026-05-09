import type { UserProfile } from '@/types';

export interface MobileNavLink {
  label: string;
  to: string;
  icon: string;
  description: string;
}

// Viewport width below which the desktop nav switches to the mobile drawer UI.
export const MOBILE_NAV_BREAKPOINT = 1024;

const PUBLIC_MOBILE_LINKS: readonly MobileNavLink[] = [
  { label: 'Home', to: '/', icon: 'home', description: 'Trending spots and community highlights' },
  { label: 'Explore', to: '/explore', icon: 'explore', description: 'Discover new cities, vibes, and saved ideas' },
  { label: 'Map', to: '/map', icon: 'map', description: 'Open the live adventure map and nearby pins' },
  { label: 'Trips', to: '/trips', icon: 'route', description: 'Open drafts, shared trip docs, and planned routes' },
  { label: 'New trip', to: '/trips/new', icon: 'plus', description: 'Build a route and generate an AI itinerary' },
  { label: 'Scope AI', to: '/ai/ask', icon: 'sparkle', description: 'Get help choosing places, routes, and trip ideas' },
  { label: 'Friends', to: '/friends', icon: 'friends', description: 'Keep up with your travel crew and invites' },
];

export function buildMobileNavLinks(currentUser: UserProfile | null | undefined): MobileNavLink[] {
  const links: MobileNavLink[] = [...PUBLIC_MOBILE_LINKS];

  if (currentUser) {
    links.push(
      {
        label: 'Profile',
        to: `/profile/${currentUser.id}`,
        icon: 'user',
        description: 'Review your stats, adventures, and saved journeys',
      },
      {
        label: 'Settings',
        to: '/settings',
        icon: 'settings',
        description: 'Tune preferences, privacy, and appearance controls',
      },
    );
  }

  return links;
}
