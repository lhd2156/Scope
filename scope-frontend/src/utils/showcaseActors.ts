import type { UserProfile } from '@/types';

type ShowcaseCatalogUser = UserProfile & { isShowcase?: boolean };

const SHOWCASE_SEED_ID_BY_DEMO_ID: Record<string, string> = {
  'demo-user-1': '11111111-1111-1111-1111-111111111111',
  'demo-user-2': '22222222-2222-2222-2222-222222222222',
  'demo-user-3': '33333333-3333-3333-3333-333333333333',
  'demo-user-4': '44444444-4444-4444-4444-444444444441',
  'demo-user-5': '55555555-5555-5555-5555-555555555551',
  'demo-user-6': '66666666-6666-6666-6666-666666666661',
  'demo-user-7': '77777777-7777-7777-7777-777777777771',
  'demo-user-8': '88888888-8888-8888-8888-888888888881',
  'demo-user-9': '99999999-9999-9999-9999-999999999991',
  'demo-user-10': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'demo-user-11': 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  'demo-user-12': 'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'demo-user-13': 'dddddddd-dddd-dddd-dddd-ddddddddddd1',
  'demo-user-14': 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee9',
  'demo-user-15': 'ffffffff-ffff-ffff-ffff-fffffffffff9',
  'demo-user-16': 'abababab-abab-abab-abab-ababababab01',
  'demo-user-17': 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbc01',
  'demo-user-18': 'cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcd01',
};

const SHOWCASE_USER_PROFILES: ShowcaseCatalogUser[] = [
  {
    id: 'demo-user-1',
    username: 'alex.morgan',
    email: 'alex.morgan@showcase.scope.local',
    displayName: 'Alex Morgan',
    avatarUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for food-first city routes, late dinners, and walkable culture loops.',
    homeBase: 'Fort Worth, TX',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 5, trips: 2, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-2',
    username: 'maya.chen',
    email: 'maya.chen@showcase.scope.local',
    displayName: 'Maya Chen',
    avatarUrl: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for gardens, museums, and design-forward weekend pacing.',
    homeBase: 'Dallas, TX',
    interests: ['scenic', 'culture', 'shopping'],
    stats: { spots: 4, trips: 1, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-3',
    username: 'elijah.brooks',
    email: 'elijah.brooks@showcase.scope.local',
    displayName: 'Elijah Brooks',
    avatarUrl: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for outdoor resets, strong coffee, and high-energy city walks.',
    homeBase: 'Austin, TX',
    interests: ['adventure', 'food', 'nature'],
    stats: { spots: 4, trips: 1, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-4',
    username: 'sofia.ramirez',
    email: 'sofia.ramirez@showcase.scope.local',
    displayName: 'Sofia Ramirez',
    avatarUrl: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for market mornings, heritage districts, and food-led itineraries.',
    homeBase: 'San Antonio, TX',
    interests: ['food', 'culture', 'shopping'],
    stats: { spots: 3, trips: 1, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-5',
    username: 'jordan.reed',
    email: 'jordan.reed@showcase.scope.local',
    displayName: 'Jordan Reed',
    avatarUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for scenic overlooks, rail stations, and daylight-efficient routes.',
    homeBase: 'Denver, CO',
    interests: ['scenic', 'nature', 'adventure'],
    stats: { spots: 3, trips: 1, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-6',
    username: 'aisha.bello',
    email: 'aisha.bello@showcase.scope.local',
    displayName: 'Aisha Bello',
    avatarUrl: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for waterfront walks, art districts, and polished group dinners.',
    homeBase: 'Houston, TX',
    interests: ['culture', 'food', 'scenic'],
    stats: { spots: 2, trips: 1, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-7',
    username: 'theo.alvarez',
    email: 'theo.alvarez@showcase.scope.local',
    displayName: 'Theo Alvarez',
    avatarUrl: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for markets, architecture, and late-night city energy.',
    homeBase: 'Barcelona, ES',
    interests: ['culture', 'shopping', 'nightlife'],
    stats: { spots: 2, trips: 1, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-8',
    username: 'priya.nair',
    email: 'priya.nair@showcase.scope.local',
    displayName: 'Priya Nair',
    avatarUrl: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for gardens, skyline walks, and compact international stopovers.',
    homeBase: 'Singapore',
    interests: ['scenic', 'culture', 'food'],
    stats: { spots: 1, trips: 1, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-9',
    username: 'camille.laurent',
    email: 'camille.laurent@showcase.scope.local',
    displayName: 'Camille Laurent',
    avatarUrl: 'https://images.pexels.com/photos/697509/pexels-photo-697509.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for museum mornings, city walks, and design-forward neighborhoods.',
    homeBase: 'Paris, FR',
    interests: ['culture', 'shopping', 'scenic'],
    stats: { spots: 5, trips: 2, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-10',
    username: 'noah.kim',
    email: 'noah.kim@showcase.scope.local',
    displayName: 'Noah Kim',
    avatarUrl: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for mountain gateways, waterfront walks, and low-friction outdoor days.',
    homeBase: 'Vancouver, CA',
    interests: ['nature', 'adventure', 'scenic'],
    stats: { spots: 5, trips: 2, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-11',
    username: 'luca.moretti',
    email: 'luca.moretti@showcase.scope.local',
    displayName: 'Luca Moretti',
    avatarUrl: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for rail-linked city breaks, market lunches, and late scenic walks.',
    homeBase: 'Lisbon, PT',
    interests: ['scenic', 'food', 'nightlife'],
    stats: { spots: 5, trips: 2, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-12',
    username: 'harper.singh',
    email: 'harper.singh@showcase.scope.local',
    displayName: 'Harper Singh',
    avatarUrl: 'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for national parks, gear-light adventures, and efficient road-trip stops.',
    homeBase: 'Denver, CO',
    interests: ['adventure', 'shopping', 'nature'],
    stats: { spots: 6, trips: 3, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-13',
    username: 'emilia.soto',
    email: 'emilia.soto@showcase.scope.local',
    displayName: 'Emilia Soto',
    avatarUrl: 'https://images.pexels.com/photos/3760854/pexels-photo-3760854.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for heritage markets, neighborhood food walks, and big-city cultural anchors.',
    homeBase: 'Buenos Aires, AR',
    interests: ['culture', 'food', 'shopping'],
    stats: { spots: 5, trips: 2, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-14',
    username: 'lena.ortiz',
    email: 'lena.ortiz@showcase.scope.local',
    displayName: 'Lena Ortiz',
    avatarUrl: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for desert color, gallery blocks, and warm-weather weekend pacing.',
    homeBase: 'Phoenix, AZ',
    interests: ['scenic', 'shopping', 'culture'],
    stats: { spots: 4, trips: 2, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-15',
    username: 'marcus.grant',
    email: 'marcus.grant@showcase.scope.local',
    displayName: 'Marcus Grant',
    avatarUrl: 'https://images.pexels.com/photos/3775534/pexels-photo-3775534.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for live music, food halls, historic streets, and energetic group nights.',
    homeBase: 'Nashville, TN',
    interests: ['nightlife', 'food', 'culture'],
    stats: { spots: 5, trips: 3, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-16',
    username: 'nia.okafor',
    email: 'nia.okafor@showcase.scope.local',
    displayName: 'Nia Okafor',
    avatarUrl: 'https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for public art, civic parks, and culture-first urban routes.',
    homeBase: 'Atlanta, GA',
    interests: ['culture', 'scenic', 'food'],
    stats: { spots: 4, trips: 2, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-17',
    username: 'owen.park',
    email: 'owen.park@showcase.scope.local',
    displayName: 'Owen Park',
    avatarUrl: 'https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for coastal trails, markets, coffee stops, and weather-aware scenic days.',
    homeBase: 'Seattle, WA',
    interests: ['nature', 'scenic', 'food'],
    stats: { spots: 5, trips: 2, friends: 0 },
    showActivityStatus: true,
  },
  {
    id: 'demo-user-18',
    username: 'clara.jensen',
    email: 'clara.jensen@showcase.scope.local',
    displayName: 'Clara Jensen',
    avatarUrl: 'https://images.pexels.com/photos/3824771/pexels-photo-3824771.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Scope starter profile for riverfront paths, museums, and relaxed city-to-nature weekends.',
    homeBase: 'Minneapolis, MN',
    interests: ['culture', 'nature', 'scenic'],
    stats: { spots: 4, trips: 2, friends: 0 },
    showActivityStatus: true,
  },
];

const SHOWCASE_ACTORS: Record<string, Omit<UserProfile, 'id'>> = Object.fromEntries(
  SHOWCASE_USER_PROFILES.flatMap((user) => {
    const seedId = SHOWCASE_SEED_ID_BY_DEMO_ID[user.id];
    if (!seedId) {
      return [];
    }
    const { id: _id, ...profile } = user;
    return [[normalizeShowcaseActorKey(seedId), profile]];
  }),
);

const SHOWCASE_ID_BY_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(SHOWCASE_SEED_ID_BY_DEMO_ID).map(([_demoId, seedId]) => [
    normalizeShowcaseActorKey(seedId),
    seedId,
  ]),
);

const SHOWCASE_KEYS_BY_ALIAS: Record<string, string> = Object.fromEntries(
  SHOWCASE_USER_PROFILES.flatMap((user) => {
    const seedId = SHOWCASE_SEED_ID_BY_DEMO_ID[user.id];
    if (!seedId) {
      return [];
    }
    const key = normalizeShowcaseActorKey(seedId);
    return [
      [user.id.toLowerCase(), key],
      [user.username.toLowerCase(), key],
    ];
  }),
);

const SHOWCASE_ACTORS_BY_REPEATED_DIGIT: Record<string, Omit<UserProfile, 'id'>> = Object.fromEntries(
  Object.entries(SHOWCASE_ACTORS)
    .map(([key, actor]) => {
      const repeatedDigit = key.match(/^([1-9a-f])\1{7,}/)?.[1];
      return repeatedDigit ? [repeatedDigit, actor] : undefined;
    })
    .filter((entry): entry is [string, Omit<UserProfile, 'id'>] => Boolean(entry)),
);

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

  const repeatedDigit = key.match(/^([1-9a-f])\1{7,}/)?.[1];
  return repeatedDigit ? SHOWCASE_ACTORS_BY_REPEATED_DIGIT[repeatedDigit] : undefined;
}

export function resolveShowcaseUserProfile(userId: string | undefined): UserProfile | undefined {
  const key = resolveAliasKey(userId) ?? normalizeShowcaseActorKey(userId);
  const actor = resolveActorTemplate(key);

  return actor
    ? {
      id: userId || SHOWCASE_ID_BY_KEY[key] || key,
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
