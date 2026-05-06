import type { SpotSummary } from '@/types';

const ENGAGEMENT_WEIGHT = 14;
const QUALITY_WEIGHT = 9;
const FRESHNESS_WEIGHT = 8;
const FRESHNESS_HALF_LIFE_DAYS = 21;
const MS_PER_DAY = 86_400_000;

function parseCreatedAt(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function freshnessScore(createdAt: string, now = Date.now()): number {
  const timestamp = parseCreatedAt(createdAt);
  if (!timestamp) {
    return 0;
  }

  const ageDays = Math.max(0, (now - timestamp) / MS_PER_DAY);
  return Math.exp(-ageDays / FRESHNESS_HALF_LIFE_DAYS);
}

export function getSpotTrendingScore(spot: SpotSummary, now = Date.now()): number {
  const engagement = Math.log1p(Math.max(0, spot.likesCount ?? 0)) * ENGAGEMENT_WEIGHT;
  const quality = Math.max(0, spot.rating || 0) * QUALITY_WEIGHT;
  const freshness = freshnessScore(spot.createdAt, now) * FRESHNESS_WEIGHT;

  return engagement + quality + freshness;
}

export function rankTrendingSpots(spots: SpotSummary[], limit = spots.length, now = Date.now()): SpotSummary[] {
  return [...spots]
    .sort((left, right) => {
      const scoreDelta = getSpotTrendingScore(right, now) - getSpotTrendingScore(left, now);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return (
        (right.likesCount ?? 0) - (left.likesCount ?? 0) ||
        right.rating - left.rating ||
        parseCreatedAt(right.createdAt) - parseCreatedAt(left.createdAt) ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id)
      );
    })
    .slice(0, Math.max(0, limit));
}
