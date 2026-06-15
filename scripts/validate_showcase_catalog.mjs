import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const ELIJAH_AVATAR = 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600';
const GENERATED_AVATAR_HOSTS = ['i.pravatar.cc', 'pravatar.cc', 'ui-avatars.com'];

const users = readJson('scope-frontend/src/mock/users.json');
const spots = readJson('scope-frontend/src/mock/spots.json');
const trips = readJson('scope-frontend/src/mock/trips.json');
const feed = readJson('scope-frontend/src/mock/feed.json');
const media = readJson('scope-frontend/src/mock/media-sources.json');
const rootMedia = readJson('scripts/sql/showcase_media_sources.json');
const placeProfiles = readJson('scripts/sql/showcase_place_profiles.json');

const productionCatalogTexts = [
  'scope-frontend/src/mock/users.json',
  'scope-frontend/src/mock/spots.json',
  'scope-frontend/src/mock/trips.json',
  'scope-frontend/src/mock/feed.json',
  'scope-frontend/src/mock/media-sources.json',
  'scope-frontend/src/services/mockData.ts',
  'scope-frontend/src/services/socialMockData.ts',
  'scope-frontend/src/services/tripPlannerPresets.ts',
  'scope-frontend/src/utils/showcaseActors.ts',
  'scope-frontend/index.html',
  'scripts/sql/showcase_media_sources.json',
  'scripts/sql/core/002_core_seed_data.sql',
  'scripts/sql/core/003_showcase_expansion_seed.sql',
  'scripts/sql/content/002_content_seed_data.sql',
  'scripts/sql/content/003_showcase_expansion_seed.sql',
  'scripts/sql/intel/002_intel_seed_data.sql',
  'scripts/sql/intel/003_showcase_expansion_seed.sql',
].map((relativePath) => ({ relativePath, text: readText(relativePath) }));

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function walk(value, visitor) {
  visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) walk(item, visitor);
  }
}

function assertNoGeneratedAvatarHosts() {
  for (const { relativePath, text } of productionCatalogTexts) {
    const matchedHost = GENERATED_AVATAR_HOSTS.find((host) => text.includes(host));
    assert(!matchedHost, `${relativePath} still references generated avatar host ${matchedHost}`);
  }
}

function assertElijahConsistency() {
  assert(
    users.find((user) => user.displayName === 'Elijah Brooks')?.avatarUrl === ELIJAH_AVATAR,
    'Elijah Brooks user avatar drifted from the canonical Pexels URL',
  );

  for (const [label, value] of Object.entries({ users, spots, trips, feed })) {
    walk(value, (node) => {
      if (!node || typeof node !== 'object') return;
      const maybeElijah = node.displayName === 'Elijah Brooks'
        || node.username === 'elijah.brooks'
        || node.email === 'elijah.brooks@showcase.scope.local';
      if (maybeElijah && 'avatarUrl' in node) {
        assert(node.avatarUrl === ELIJAH_AVATAR, `${label} has an Elijah profile with a non-canonical avatar`);
      }
    });
  }
}

function assertSpotVerification() {
  const publicSpots = spots.filter((spot) => spot.isPublic !== false);
  assert(publicSpots.length >= 72, `expected 72+ public spots, found ${publicSpots.length}`);

  for (const spot of publicSpots) {
    assert(spot.verificationStatus === 'verified', `${spot.id} is not verified`);
    assert(Boolean(spot.verificationSource), `${spot.id} is missing verificationSource`);
    assert(Boolean(spot.providerPlaceId), `${spot.id} is missing providerPlaceId`);
    assert(Boolean(spot.providerPlaceName), `${spot.id} is missing providerPlaceName`);
    assert(Boolean(spot.providerPlaceAddress), `${spot.id} is missing providerPlaceAddress`);
    assert(spot.safetyStatus === 'clean', `${spot.id} safetyStatus is not clean`);
    assert(Boolean(spot.safetyReason), `${spot.id} is missing safetyReason`);
  }
}

function assertCoverage() {
  const usStates = new Set();
  const internationalDestinations = new Set();
  for (const spot of spots) {
    if (spot.country === 'US') {
      const stateCode = spot.stateCode || existingUsStateByCity.get(spot.city);
      if (stateCode) usStates.add(stateCode);
    } else {
      internationalDestinations.add(`${spot.city},${spot.country}`);
    }
  }
  assert(usStates.size >= 36, `expected 36+ US states, found ${usStates.size}`);
  assert(internationalDestinations.size >= 20, `expected 20+ international destinations, found ${internationalDestinations.size}`);
}

function assertMediaMetadata() {
  const assetIds = new Set(media.assets.map((asset) => asset.id));
  const rootAssetIds = new Set(rootMedia.assets.map((asset) => asset.id));
  for (const user of users) {
    assert(assetIds.has(`person-${user.id}`), `${user.id} is missing frontend media metadata`);
    assert(rootAssetIds.has(`person-${user.id}`), `${user.id} is missing root media metadata`);
  }
  for (const spot of spots) {
    assert(assetIds.has(`place-${spot.id}`), `${spot.id} is missing frontend media metadata`);
    assert(rootAssetIds.has(`place-${spot.id}`), `${spot.id} is missing root media metadata`);
  }
  for (const asset of [...media.assets, ...rootMedia.assets]) {
    assert(Boolean(asset.sourceUrl), `${asset.id} is missing sourceUrl`);
    assert(Boolean(asset.licenseUrl), `${asset.id} is missing licenseUrl`);
    assert(asset.noEndorsement === true, `${asset.id} must carry noEndorsement=true`);
  }
}

function assertPlaceProfiles() {
  const profileEntries = Object.entries(placeProfiles.profiles ?? {});
  assert(profileEntries.length >= 48, `expected 48+ place profiles, found ${profileEntries.length}`);
  for (const [spotId, profile] of profileEntries) {
    for (const key of [
      'localVsTouristMix',
      'visitorIntent',
      'budgetBand',
      'pace',
      'crowdLevel',
      'seasonTimeFit',
      'groupFit',
      'accessibilityFamilyFit',
      'whyScope',
    ]) {
      assert(Boolean(profile[key]), `${spotId} place profile missing ${key}`);
    }
  }
}

assert(users.length >= 18, `expected 18+ personas, found ${users.length}`);
assert(spots.length >= 72, `expected 72+ spots, found ${spots.length}`);
assert(trips.length >= 12, `expected 12+ trips, found ${trips.length}`);
assert(feed.length >= 72, `expected a populated feed, found ${feed.length}`);
assertNoGeneratedAvatarHosts();
assertElijahConsistency();
assertSpotVerification();
assertCoverage();
assertMediaMetadata();
assertPlaceProfiles();

console.log(`Showcase catalog OK: ${users.length} personas, ${spots.length} spots, ${trips.length} trips, ${feed.length} feed items.`);
