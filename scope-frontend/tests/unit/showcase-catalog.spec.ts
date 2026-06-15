import { describe, expect, it } from 'vitest';

import rawFeed from '@/mock/feed.json';
import rawMediaSources from '@/mock/media-sources.json';
import rawSpots from '@/mock/spots.json';
import rawTrips from '@/mock/trips.json';
import rawUsers from '@/mock/users.json';

const ELIJAH_AVATAR = 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600';
const generatedAvatarHosts = ['i.pravatar.cc', 'pravatar.cc', 'ui-avatars.com'];
const existingUsStateByCity = new Map([
  ['Fort Worth', 'TX'],
  ['San Antonio', 'TX'],
  ['Austin', 'TX'],
  ['Dallas', 'TX'],
  ['Houston', 'TX'],
  ['Big Bend National Park', 'TX'],
  ['Chicago', 'IL'],
  ['New York', 'NY'],
  ['Seattle', 'WA'],
  ['Miami', 'FL'],
  ['Los Angeles', 'CA'],
  ['Denver', 'CO'],
  ['New Orleans', 'LA'],
]);

function walk(value: unknown, visitor: (node: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>;
    visitor(node);
    Object.values(node).forEach((item) => walk(item, visitor));
  }
}

describe('showcase production catalog', () => {
  it('has the intended baseline population', () => {
    expect(rawUsers).toHaveLength(18);
    expect(rawSpots).toHaveLength(72);
    expect(rawTrips).toHaveLength(12);
    expect(rawFeed.length).toBeGreaterThanOrEqual(72);
  });

  it('keeps realistic avatar hosts and Elijah consistency', () => {
    const catalogText = JSON.stringify({ rawUsers, rawSpots, rawTrips, rawFeed, rawMediaSources });
    for (const host of generatedAvatarHosts) {
      expect(catalogText).not.toContain(host);
    }

    expect(rawUsers.find((user) => user.displayName === 'Elijah Brooks')?.avatarUrl).toBe(ELIJAH_AVATAR);
    walk({ rawUsers, rawSpots, rawTrips, rawFeed }, (node) => {
      const isElijah = node.displayName === 'Elijah Brooks'
        || node.username === 'elijah.brooks'
        || node.email === 'elijah.brooks@showcase.scope.local';
      if (isElijah && 'avatarUrl' in node) {
        expect(node.avatarUrl).toBe(ELIJAH_AVATAR);
      }
    });
  });

  it('keeps all public spots verified with media metadata', () => {
    const mediaAssetIds = new Set(rawMediaSources.assets.map((asset) => asset.id));

    for (const spot of rawSpots) {
      expect(spot.isPublic).toBe(true);
      expect(spot.verificationStatus).toBe('verified');
      expect(spot.verificationSource).toBeTruthy();
      expect(spot.providerPlaceId).toBeTruthy();
      expect(spot.providerPlaceName).toBeTruthy();
      expect(spot.providerPlaceAddress).toBeTruthy();
      expect(spot.safetyStatus).toBe('clean');
      expect(mediaAssetIds.has(`place-${spot.id}`)).toBe(true);
    }

    for (const user of rawUsers) {
      expect(mediaAssetIds.has(`person-${user.id}`)).toBe(true);
    }
  });

  it('covers enough US states and international destinations for map exploration', () => {
    const states = new Set<string>();
    const internationalDestinations = new Set<string>();

    for (const spot of rawSpots) {
      if (spot.country === 'US') {
        const stateCode = spot.stateCode || existingUsStateByCity.get(spot.city);
        if (stateCode) states.add(stateCode);
      } else {
        internationalDestinations.add(`${spot.city},${spot.country}`);
      }
    }

    expect(states.size).toBeGreaterThanOrEqual(36);
    expect(internationalDestinations.size).toBeGreaterThanOrEqual(20);
  });
});
