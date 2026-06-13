import type { UserProfile } from '@/types';

const SHOWCASE_ACTORS: Record<string, Omit<UserProfile, 'id'>> = {
  '11111111111111111111111111111111': {
    username: 'alex.morgan',
    email: '',
    displayName: 'Alex Morgan',
    avatarUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for food-first city routes, late dinners, and walkable culture loops.',
    homeBase: 'Fort Worth, TX',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 18, trips: 5, friends: 96 },
    showActivityStatus: true,
  },
  '22222222222222222222222222222222': {
    username: 'maya.chen',
    email: '',
    displayName: 'Maya Chen',
    avatarUrl: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for gardens, museums, and design-forward weekend pacing.',
    homeBase: 'Dallas, TX',
    interests: ['scenic', 'culture', 'shopping'],
    stats: { spots: 16, trips: 6, friends: 112 },
    showActivityStatus: true,
  },
  '33333333333333333333333333333333': {
    username: 'elijah.brooks',
    email: '',
    displayName: 'Elijah Brooks',
    avatarUrl: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for outdoor resets, strong coffee, and high-energy city walks.',
    homeBase: 'Austin, TX',
    interests: ['adventure', 'food', 'nature'],
    stats: { spots: 21, trips: 7, friends: 88 },
    showActivityStatus: true,
  },
  '44444444444444444444444444444441': {
    username: 'sofia.ramirez',
    email: '',
    displayName: 'Sofia Ramirez',
    avatarUrl: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for market mornings, heritage districts, and food-led itineraries.',
    homeBase: 'San Antonio, TX',
    interests: ['food', 'culture', 'shopping'],
    stats: { spots: 22, trips: 8, friends: 134 },
    showActivityStatus: true,
  },
  '55555555555555555555555555555551': {
    username: 'jordan.reed',
    email: '',
    displayName: 'Jordan Reed',
    avatarUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for scenic overlooks, rail stations, and daylight-efficient routes.',
    homeBase: 'Denver, CO',
    interests: ['scenic', 'nature', 'adventure'],
    stats: { spots: 19, trips: 5, friends: 76 },
    showActivityStatus: true,
  },
  '66666666666666666666666666666661': {
    username: 'aisha.bello',
    email: '',
    displayName: 'Aisha Bello',
    avatarUrl: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for waterfront walks, art districts, and polished group dinners.',
    homeBase: 'Houston, TX',
    interests: ['culture', 'food', 'scenic'],
    stats: { spots: 17, trips: 6, friends: 101 },
    showActivityStatus: true,
  },
  '77777777777777777777777777777771': {
    username: 'theo.alvarez',
    email: '',
    displayName: 'Theo Alvarez',
    avatarUrl: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for markets, architecture, and late-night city energy.',
    homeBase: 'Barcelona, ES',
    interests: ['culture', 'shopping', 'nightlife'],
    stats: { spots: 24, trips: 9, friends: 143 },
    showActivityStatus: true,
  },
  '88888888888888888888888888888881': {
    username: 'priya.nair',
    email: '',
    displayName: 'Priya Nair',
    avatarUrl: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for gardens, skyline walks, and compact international stopovers.',
    homeBase: 'Singapore',
    interests: ['scenic', 'culture', 'food'],
    stats: { spots: 20, trips: 7, friends: 118 },
    showActivityStatus: true,
  },
};

const SHOWCASE_ACTORS_BY_REPEATED_DIGIT: Record<string, Omit<UserProfile, 'id'>> = {
  '1': SHOWCASE_ACTORS['11111111111111111111111111111111'],
  '2': SHOWCASE_ACTORS['22222222222222222222222222222222'],
  '3': SHOWCASE_ACTORS['33333333333333333333333333333333'],
  '4': SHOWCASE_ACTORS['44444444444444444444444444444441'],
  '5': SHOWCASE_ACTORS['55555555555555555555555555555551'],
  '6': SHOWCASE_ACTORS['66666666666666666666666666666661'],
  '7': SHOWCASE_ACTORS['77777777777777777777777777777771'],
  '8': SHOWCASE_ACTORS['88888888888888888888888888888881'],
};

const SHOWCASE_ID_BY_KEY: Record<string, string> = {
  '11111111111111111111111111111111': '11111111-1111-1111-1111-111111111111',
  '22222222222222222222222222222222': '22222222-2222-2222-2222-222222222222',
  '33333333333333333333333333333333': '33333333-3333-3333-3333-333333333333',
  '44444444444444444444444444444441': '44444444-4444-4444-4444-444444444441',
  '55555555555555555555555555555551': '55555555-5555-5555-5555-555555555551',
  '66666666666666666666666666666661': '66666666-6666-6666-6666-666666666661',
  '77777777777777777777777777777771': '77777777-7777-7777-7777-777777777771',
  '88888888888888888888888888888881': '88888888-8888-8888-8888-888888888881',
};

const SHOWCASE_KEYS_BY_ALIAS: Record<string, string> = {
  'demo-user-1': '11111111111111111111111111111111',
  'alex.morgan': '11111111111111111111111111111111',
  'demo-user-2': '22222222222222222222222222222222',
  'maya.chen': '22222222222222222222222222222222',
  'demo-user-3': '33333333333333333333333333333333',
  'elijah.brooks': '33333333333333333333333333333333',
  'demo-user-4': '44444444444444444444444444444441',
  'sofia.ramirez': '44444444444444444444444444444441',
  'demo-user-5': '55555555555555555555555555555551',
  'jordan.reed': '55555555555555555555555555555551',
  'demo-user-6': '66666666666666666666666666666661',
  'aisha.bello': '66666666666666666666666666666661',
  'demo-user-7': '77777777777777777777777777777771',
  'theo.alvarez': '77777777777777777777777777777771',
  'demo-user-8': '88888888888888888888888888888881',
  'priya.nair': '88888888888888888888888888888881',
};

export function normalizeShowcaseActorKey(value: string | undefined): string {
  return String(value ?? '').replace(/[^a-f0-9]/gi, '').toLowerCase();
}

function resolveAliasKey(value: string | undefined): string | undefined {
  const alias = String(value ?? '').trim().toLowerCase().replace(/^@+/, '');
  return SHOWCASE_KEYS_BY_ALIAS[alias];
}

function resolveActorTemplate(key: string): Omit<UserProfile, 'id'> | undefined {
  if (SHOWCASE_ACTORS[key]) {
    return SHOWCASE_ACTORS[key];
  }

  const repeatedDigit = key.match(/^([1-8])\1{7,}/)?.[1];
  return repeatedDigit ? SHOWCASE_ACTORS_BY_REPEATED_DIGIT[repeatedDigit] : undefined;
}

export function resolveShowcaseUserProfile(userId: string | undefined): UserProfile | undefined {
  const key = resolveAliasKey(userId) ?? normalizeShowcaseActorKey(userId);
  const actor = resolveActorTemplate(key);

  return actor
    ? {
      id: userId || key,
      ...actor,
    }
    : undefined;
}

export function listShowcaseUserProfiles(): UserProfile[] {
  return Object.entries(SHOWCASE_ACTORS).map(([key, actor]) => ({
    id: SHOWCASE_ID_BY_KEY[key] ?? key,
    ...actor,
  }));
}

export function searchShowcaseUserProfiles(query: string, page = 1, pageSize = 10): UserProfile[] {
  const normalizedQuery = String(query ?? '').trim().toLowerCase().replace(/^@+/, '');
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!queryTerms.length || normalizedQuery.length < 2) {
    return [];
  }

  const matches = listShowcaseUserProfiles().filter((user) => {
    const searchableContent = [
      user.username,
      user.displayName,
      user.email,
      user.homeBase,
      ...(user.interests ?? []),
    ].filter(Boolean).join(' ').toLowerCase();
    return queryTerms.every((term) => searchableContent.includes(term));
  });
  const start = Math.max(0, (page - 1) * pageSize);
  return matches.slice(start, start + pageSize);
}

export function isShowcaseUserId(userId: string | undefined): boolean {
  const key = resolveAliasKey(userId) ?? normalizeShowcaseActorKey(userId);
  return Boolean(resolveActorTemplate(key));
}
