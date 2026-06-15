import { normalizeActionLookupValue } from '@/components/trips/tripAiResponseBlocks';
import type {
  ScopeAiActionBlock,
  ScopeAiPendingContextItem,
  ScopeAiPendingScopeAiContext,
} from '@/stores/scopeAiPlanner';

export const STREET_ADDRESS_PATTERN = /\b\d{1,6}\s+[\w'.-]+(?:\s+[\w'.-]+){0,6}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|circle|cir|way|parkway|pkwy|highway|hwy|trail|trl|terrace|ter|plaza|plz|farm(?:\s+to\s+market|-to-market)|fm|county road|cr|route)\b/i;

const SCOPE_AI_STATE_ALIASES: Record<string, string> = {
  alabama: 'Alabama',
  alaska: 'Alaska',
  arizona: 'Arizona',
  arkansas: 'Arkansas',
  california: 'California',
  colorado: 'Colorado',
  connecticut: 'Connecticut',
  delaware: 'Delaware',
  florida: 'Florida',
  georgia: 'Georgia',
  hawaii: 'Hawaii',
  idaho: 'Idaho',
  illinois: 'Illinois',
  indiana: 'Indiana',
  iowa: 'Iowa',
  kansas: 'Kansas',
  kentucky: 'Kentucky',
  louisiana: 'Louisiana',
  maine: 'Maine',
  maryland: 'Maryland',
  massachusetts: 'Massachusetts',
  michigan: 'Michigan',
  minnesota: 'Minnesota',
  mississippi: 'Mississippi',
  missouri: 'Missouri',
  montana: 'Montana',
  nebraska: 'Nebraska',
  nevada: 'Nevada',
  'new hampshire': 'New Hampshire',
  'new jersey': 'New Jersey',
  'new mexico': 'New Mexico',
  'new york': 'New York',
  'north carolina': 'North Carolina',
  'north dakota': 'North Dakota',
  ohio: 'Ohio',
  oklahoma: 'Oklahoma',
  oregon: 'Oregon',
  pennsylvania: 'Pennsylvania',
  'rhode island': 'Rhode Island',
  'south carolina': 'South Carolina',
  'south dakota': 'South Dakota',
  tennessee: 'Tennessee',
  texas: 'Texas',
  utah: 'Utah',
  vermont: 'Vermont',
  virginia: 'Virginia',
  washington: 'Washington',
  'west virginia': 'West Virginia',
  wisconsin: 'Wisconsin',
  wyoming: 'Wyoming',
  al: 'Alabama',
  ak: 'Alaska',
  az: 'Arizona',
  ar: 'Arkansas',
  ca: 'California',
  co: 'Colorado',
  ct: 'Connecticut',
  de: 'Delaware',
  fl: 'Florida',
  ga: 'Georgia',
  hi: 'Hawaii',
  id: 'Idaho',
  il: 'Illinois',
  in: 'Indiana',
  ia: 'Iowa',
  ks: 'Kansas',
  ky: 'Kentucky',
  la: 'Louisiana',
  me: 'Maine',
  md: 'Maryland',
  ma: 'Massachusetts',
  mi: 'Michigan',
  mn: 'Minnesota',
  ms: 'Mississippi',
  mo: 'Missouri',
  mt: 'Montana',
  ne: 'Nebraska',
  nv: 'Nevada',
  nh: 'New Hampshire',
  nj: 'New Jersey',
  nm: 'New Mexico',
  ny: 'New York',
  nc: 'North Carolina',
  nd: 'North Dakota',
  oh: 'Ohio',
  ok: 'Oklahoma',
  or: 'Oregon',
  pa: 'Pennsylvania',
  ri: 'Rhode Island',
  sc: 'South Carolina',
  sd: 'South Dakota',
  tn: 'Tennessee',
  tx: 'Texas',
  ut: 'Utah',
  vt: 'Vermont',
  va: 'Virginia',
  wa: 'Washington',
  wv: 'West Virginia',
  wi: 'Wisconsin',
  wy: 'Wyoming',
};

export interface PendingScopeAiTurnPlan {
  startsNewIntent: boolean;
  isPendingFollowUp: boolean;
  clearReason: 'explicit-new-command' | 'pending-context-new-turn' | null;
}

export function getPendingContextItems(context: ScopeAiPendingScopeAiContext): ScopeAiPendingContextItem[] {
  return [...(context.candidates ?? []), ...(context.results ?? [])].filter((item) => item.label?.trim());
}

export function extractOrdinalSelection(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const ordinalPatterns: Array<[RegExp, number]> = [
    [/\b(?:first|1st|number\s+1|#?1)\b/, 0],
    [/\b(?:second|2nd|number\s+2|#?2)\b/, 1],
    [/\b(?:third|3rd|number\s+3|#?3)\b/, 2],
    [/\b(?:fourth|4th|number\s+4|#?4)\b/, 3],
    [/\b(?:fifth|5th|number\s+5|#?5)\b/, 4],
  ];
  const match = ordinalPatterns.find(([pattern]) => pattern.test(normalized));
  return match ? match[1] : null;
}

export function extractStateQualifier(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const aliases = Object.keys(SCOPE_AI_STATE_ALIASES).sort((left, right) => right.length - left.length);
  const match = aliases.find((alias) => new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized));
  return match ? SCOPE_AI_STATE_ALIASES[match] : null;
}

export function cleanupFollowUpQualifier(value: string): string | null {
  const state = extractStateQualifier(value);
  if (state) {
    return state;
  }

  const match = value.match(/\b(?:in|near|around|by|at|close to|within)\s+(.+)$/i);
  const raw = match?.[1] ?? value;
  const cleaned = raw
    .replace(/\b(?:is|are|there|one|ones|any|the|that|this|exact|match|matches|place|location|city|state|pick|choose|use|please|pls)\b/gi, ' ')
    .replace(/\b(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|#?\d+)\b/gi, ' ')
    .replace(/[?!.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2 || cleaned.split(/\s+/).length > 5) {
    return null;
  }

  return cleaned;
}

export function cleanupReplacementLocationQuery(value: string): string | null {
  let cleaned = value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');

  cleaned = cleaned
    .replace(/^(?:no\s+like|not\s+like|nah\s+like|no|nah|nope|wait|oops|sorry|actually|really|instead|correction|wrong|wrong one|change it|make it|make that|it is|it's|it should be|should be|use|try)\b[\s,:-]*/i, '')
    .replace(/^(?:to|at|in|from|is|as|set|with|be)\s+/i, '')
    .replace(/\s+(?:please|pls|thanks|for real|if that makes sense|no guessing|do not guess|don't guess)$/i, '')
    .trim();

  if (!cleaned || !STREET_ADDRESS_PATTERN.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export function isLikelyStaleRawLocationContext(value: string | undefined): boolean {
  const normalized = (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized || STREET_ADDRESS_PATTERN.test(normalized)) {
    return false;
  }

  return /\b(?:trip|vibe|vibes|nightlife|culture|food|scenic|adventure|nature|shopping|entertainment|bowling|arcade|theme\s*park|family|luxury|budget|pace|travelers?|weather|fuel|gas|route|itinerary|build|find|search|show|help|pick|choose|suggest|recommend)\b/.test(normalized);
}

export function extractLocationDisambiguationQualifier(value: string): string | null {
  const state = extractStateQualifier(value);
  if (state) {
    return state;
  }

  if (!/\b(?:in|near|around|by|at|close to|within)\b/i.test(value)) {
    return null;
  }

  const qualifier = cleanupFollowUpQualifier(value);
  if (!qualifier || /\b(?:more|show|details?|why|compare|source|vibe|trip|route|build|find|search|weather|fuel|gas|budget|pace|travelers?)\b/i.test(qualifier)) {
    return null;
  }

  return qualifier;
}

export function buildPendingLocationFollowUpQuery(
  promptValue: string,
  context: ScopeAiPendingScopeAiContext,
  selected: ScopeAiPendingContextItem | null = selectPendingContextItem(promptValue, context),
): string | null {
  if (selected) {
    return selected.value || selected.label || null;
  }

  const replacementQuery = cleanupReplacementLocationQuery(promptValue);
  if (replacementQuery) {
    return replacementQuery;
  }

  const qualifier = extractLocationDisambiguationQualifier(promptValue);
  if (!qualifier || isLikelyStaleRawLocationContext(context.rawValue)) {
    return null;
  }

  return [context.rawValue, qualifier].filter(Boolean).join(' ').trim() || null;
}

export function selectPendingContextItem(value: string, context: ScopeAiPendingScopeAiContext): ScopeAiPendingContextItem | null {
  const items = getPendingContextItems(context);
  if (!items.length) {
    return null;
  }

  const ordinal = extractOrdinalSelection(value);
  if (ordinal !== null) {
    return items[ordinal] ?? null;
  }

  const qualifier = cleanupFollowUpQualifier(value);
  const normalizedPrompt = normalizeActionLookupValue(qualifier ?? value);
  if (!normalizedPrompt) {
    return null;
  }

  const matches = items.filter((item) => {
    const haystack = normalizeActionLookupValue([
      item.label,
      item.value,
      item.source,
      item.meta?.address,
      item.meta?.city,
      item.meta?.category,
      item.meta?.categoryLabel,
      item.meta?.placeName,
      item.meta?.reason,
    ].filter(Boolean).join(' '));
    return haystack.includes(normalizedPrompt);
  });

  return matches.length === 1 ? matches[0] : null;
}

export function extractRadiusKmFromFollowUp(value: string): number | null {
  const match = value.match(/\b(?:within|under|inside|radius)\s+(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers)?\b/i);
  if (!match?.[1]) {
    return null;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unit = (match[2] ?? 'mi').toLowerCase();
  const km = unit.startsWith('km') || unit.startsWith('kilometer') ? amount : amount * 1.609344;
  return Math.max(1, Math.min(km, 80));
}

export function inferNearbyCategoryFromFollowUp(value: string, fallback?: string): string {
  const normalized = value.toLowerCase();
  if (/\b(coffee|cafe|espresso|latte)\b/.test(normalized)) {
    return 'coffee';
  }
  if (/\b(gas|fuel|station|diesel|charge|charging)\b/.test(normalized)) {
    return 'fuel';
  }
  if (/\b(food|restaurant|lunch|dinner|breakfast|eat)\b/.test(normalized)) {
    return 'food';
  }
  if (/\b(park|trail|outdoor|nature)\b/.test(normalized)) {
    return 'outdoors';
  }
  if (/\b(view|scenic|overlook|photo)\b/.test(normalized)) {
    return 'scenic';
  }
  if (/\b(museum|culture|historic|gallery)\b/.test(normalized)) {
    return 'culture';
  }
  if (/\b(shop|shopping|market)\b/.test(normalized)) {
    return 'shopping';
  }
  if (/\b(entertainment|amusement|theme\s*park|six\s*flags|bowling|arcade|movie|cinema|concert|zoo|aquarium|stadium|arena|escape\s*room|mini\s*golf|laser\s*tag)\b/.test(normalized)) {
    return 'entertainment';
  }

  return fallback?.trim() || 'nearby places';
}

export function buildPendingLocationAction(context: Pick<ScopeAiPendingScopeAiContext, 'targetField'>, query: string): ScopeAiActionBlock | null {
  const targetField = String(context.targetField ?? '').toLowerCase();
  if (targetField === 'stop') {
    return {
      actions: [{
        type: 'ADD_STOP',
        stop: {
          name: query,
          address: query,
        },
      }],
    };
  }

  if (targetField === 'end' || targetField === 'enddestination' || targetField === 'destination') {
    return {
      actions: [{
        type: 'SET_FIELD',
        field: 'end',
        value: query,
      }],
    };
  }

  return {
    actions: [{
      type: 'SET_FIELD',
      field: 'start',
      value: query,
    }],
  };
}

export function filterPendingItemsByFollowUp(value: string, context: ScopeAiPendingScopeAiContext): ScopeAiPendingContextItem[] {
  const qualifier = cleanupFollowUpQualifier(value);
  const normalized = normalizeActionLookupValue(qualifier ?? value);
  if (!normalized) {
    return [];
  }

  return getPendingContextItems(context).filter((item) => {
    const haystack = normalizeActionLookupValue([
      item.label,
      item.value,
      item.source,
      item.meta?.address,
      item.meta?.category,
      item.meta?.categoryLabel,
      item.meta?.reason,
    ].filter(Boolean).join(' '));
    return haystack.includes(normalized);
  });
}

export function getFuelPriceFromPendingItem(item: ScopeAiPendingContextItem): number | null {
  const price = Number(item.meta?.pricePerUnit);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function getDistanceFromPendingItem(item: ScopeAiPendingContextItem): number | null {
  const distance = Number(item.meta?.distanceKm);
  return Number.isFinite(distance) && distance >= 0 ? distance : null;
}

export function isExplicitEndpointRouteCommand(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return (
    /\bfrom\s+.{2,}\s+to\s+.{2,}$/i.test(normalized) ||
    /\b(?:start|starting|origin)\b(?:\s+(?:at|from|is|as|to|=|:))?\s+(?!over\b).{2,}$/i.test(normalized) ||
    /\b(?:destination|final destination|end|finish)\b(?:\s+(?:at|in|to|is|as|=|:))?\s+.{2,}$/i.test(normalized) ||
    /\buse\s+.{2,}\s+as\s+(?:the\s+)?(?:start|starting point|end|destination|final destination)\b/i.test(normalized)
  );
}

export function isPendingFollowUpForContext(value: string, context: ScopeAiPendingScopeAiContext | null): boolean {
  const normalized = value.trim().toLowerCase();
  if (!context) {
    return false;
  }

  if (context.kind === 'fuel-results') {
    return /\b(?:set\s+(?:gas\s*)?price|use\s+(?:that|this)\s+price|cheapest|closest|diesel|premium|regular|midgrade|show more|more|within|radius)\b/i.test(normalized);
  }

  if (context.kind === 'nearby-results') {
    return /\b(?:show more|more|within|radius|near|closest|coffee|food|restaurant|fuel|gas|park|scenic|museum|shopping|entertainment|bowling|arcade|theme\s*park|movie|cinema)\b/i.test(normalized)
      || extractOrdinalSelection(normalized) !== null;
  }

  if (context.kind === 'endpoint-candidates' || context.kind === 'place-candidates') {
    if (/\bendpoint ideas?\b/i.test(normalized) || /\b(?:find|search).*\bendpoint/i.test(normalized)) {
      return false;
    }

    if (/\b(?:route\s+status|check\s+status|weather\s+for|forecast\s+for|start(?:ing)?\s+(?:at|from|place|point|city)|end\s+(?:at|in|place|point|city)|destination|final destination|budget|travelers?|pace|date|vibe|vibes|theme|interests?|focus|fuel|gas|build|generate|tighten|find|search|nearby)\b/i.test(normalized)) {
      return false;
    }

    return Boolean(selectPendingContextItem(value, context))
      || filterPendingItemsByFollowUp(value, context).length > 0
      || /\b(?:closest|scenic|practical|museum|park|coffee|food|cheap|cheapest|second|first|third)\b/i.test(normalized);
  }

  if (context.kind === 'location-resolution' || context.kind === 'weather-location') {
    if (isExplicitEndpointRouteCommand(normalized)) {
      return false;
    }

    if (/\b(?:route\s+status|check\s+status|weather\s+for|forecast\s+for|start(?:ing)?\s+(?:at|from|place|point|city)|end\s+(?:at|in|place|point|city)|destination|final destination|budget|travelers?|pace|date|vibe|vibes|theme|interests?|focus|fuel|gas|build|generate|tighten|find|search|nearby)\b/i.test(normalized)) {
      return false;
    }

    return Boolean(selectPendingContextItem(value, context))
      || Boolean(cleanupReplacementLocationQuery(normalized))
      || Boolean(extractLocationDisambiguationQualifier(normalized));
  }

  if (context.kind === 'planner-setting') {
    return /\b(?:under\s+\d+|below\s+\d+|cap(?: it)? at\s+\d+|make it\s+\d+|for\s+\d+\s+(?:people|travelers|guests?))\b/i.test(normalized);
  }

  if (context.kind === 'explanation') {
    if (/\b(?:endpoint ideas?|weather\s+for|forecast\s+for|start(?:ing)?\s+(?:at|from|place|point|city)|end\s+(?:at|in|place|point|city)|destination|final destination|budget|travelers?|pace|date|fuel|gas|build|generate|tighten|find|search|nearby|places?)\b/i.test(normalized)) {
      return false;
    }

    return /\b(?:why|go deeper|deeper|more detail|details|compare|source|what changed|show more)\b/i.test(normalized);
  }

  return false;
}

export function isExplicitNewScopeAiCommand(value: string, context: ScopeAiPendingScopeAiContext | null = null): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (isExplicitEndpointRouteCommand(normalized)) {
    return true;
  }

  if (isPendingFollowUpForContext(normalized, context)) {
    return false;
  }

  return (
    /^(?:start over|reset|clear|new route|restart)\b/i.test(normalized) ||
    /\b(?:route\s+status|check\s+status|status\s+of\s+(?:the\s+)?route|start(?:ing)?\s+(?:at|from|place|point|city)|end\s+(?:at|in|place|point|city)|destination|final destination|endpoint ideas?|change|replace|set|use .+ as (?:the )?(?:start|end)|build|generate|tighten|weather\s+for|forecast\s+for|find|search|nearby|fuel|gas|budget|travelers?|pace|date|vibe|vibes|theme|interests?|focus|under\s+\d+|below\s+\d+|for\s+\d+\s+(?:people|travelers|guests?))\b/i.test(normalized)
  );
}

export function planPendingScopeAiTurn(value: string, context: ScopeAiPendingScopeAiContext | null): PendingScopeAiTurnPlan {
  if (!context) {
    return {
      startsNewIntent: false,
      isPendingFollowUp: false,
      clearReason: null,
    };
  }

  const startsNewIntent = isExplicitNewScopeAiCommand(value, context);
  if (startsNewIntent) {
    return {
      startsNewIntent,
      isPendingFollowUp: false,
      clearReason: 'explicit-new-command',
    };
  }

  const isPendingFollowUp = isPendingFollowUpForContext(value, context);
  return {
    startsNewIntent,
    isPendingFollowUp,
    clearReason: isPendingFollowUp ? null : 'pending-context-new-turn',
  };
}
