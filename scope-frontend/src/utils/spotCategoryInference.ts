import type { SpotCategory } from '@/types';

type CategoryPattern = {
  category: SpotCategory;
  score: number;
  pattern: RegExp;
};

const SERVICE_PATTERN = /\b(car\s*wash|auto\s*(repair|service|shop)|mechanic|oil\s*change|bank|atm|gas\s*station|fuel|parking|hospital|clinic|dentist|doctor|school|post\s*office|laundromat|dry\s*cleaner|storage|pharmacy)\b/i;

const CATEGORY_PATTERNS: CategoryPattern[] = [
  { category: 'nightlife', score: 8, pattern: /\b(night\s*club|nightclub|club|cocktail|speakeasy|karaoke|pub|bar|lounge|wine\s*bar|brewery|taproom|dance\s*hall)\b/i },
  { category: 'food', score: 8, pattern: /\b(restaurant|fast\s*food|food|coffee|cafe|café|espresso|latte|bakery|diner|brunch|breakfast|lunch|dinner|taco|pizza|burger|sushi|ramen|bbq|barbecue|steakhouse|grill|kitchen|bistro|ice\s*cream|dessert|boba|tea\s*house|eatery)\b/i },
  { category: 'entertainment', score: 8, pattern: /\b(entertainment|amusement\s*park|theme\s*park|six\s*flags|bowling|bowling\s*alley|arcade|movie\s*theater|movie\s*theatre|cinema|concert|music\s*venue|stadium|arena|zoo|aquarium|escape\s*room|laser\s*tag|mini\s*golf|carnival|fair)\b/i },
  { category: 'shopping', score: 7, pattern: /\b(grocery|supermarket|market|store|shop|shopping|mall|retail|boutique|outlet|bookstore|book\s*shop|costco|walmart|target|trader\s*joe'?s|whole\s*foods|convenience\s*store)\b/i },
  { category: 'culture', score: 7, pattern: /\b(museum|gallery|theater|theatre|art|arts|mural|library|historic|history|monument|landmark|cathedral|church|temple|mosque|shrine|cultural|exhibit|exhibition)\b/i },
  { category: 'nature', score: 7, pattern: /\b(park|trail|garden|botanical|arboretum|lake|beach|forest|preserve|river|waterfall|water\s*fall|campground|nature|wildlife|greenway)\b/i },
  { category: 'scenic', score: 7, pattern: /\b(scenic|viewpoint|view\s*point|overlook|lookout|vista|skyline|observation|photo\s*spot|sunset|sunrise|panorama|look\s*out)\b/i },
  { category: 'adventure', score: 6, pattern: /\b(adventure|hike|hiking|climb|climbing|kayak|kayaking|canoe|rafting|zipline|zip\s*line|ski|skiing|snowboard|surf|surfing|outdoor|trailhead)\b/i },
];

export function inferSpotCategoryFromSignals(signals: Array<string | null | undefined>): SpotCategory | null {
  const normalized = signals
    .map((signal) => String(signal ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/[_-]+/g, ' ');

  if (!normalized) {
    return null;
  }

  if (SERVICE_PATTERN.test(normalized)) {
    return 'other';
  }

  let bestMatch: { category: SpotCategory; score: number } | null = null;
  CATEGORY_PATTERNS.forEach((entry) => {
    if (!entry.pattern.test(normalized)) {
      return;
    }

    if (!bestMatch || entry.score > bestMatch.score) {
      bestMatch = { category: entry.category, score: entry.score };
    }
  });

  return bestMatch?.category ?? null;
}
