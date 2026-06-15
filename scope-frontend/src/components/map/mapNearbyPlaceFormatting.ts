import type { MapNearbyPlacePin } from '@/types';

interface PlaceCategoryOverride {
  label: string;
  category: string;
  kind: string;
}

interface PlaceCategoryRule extends PlaceCategoryOverride {
  categoryPattern?: RegExp;
  titlePattern?: RegExp;
}

const GAS_STATION_TITLE_PATTERN = /\b(?:qt|quik\s*trip|quick\s*trip|shell|chevron|exxon|mobil|bp|valero|texaco|circle\s*k|7-eleven|racetrac|race\s*trac|speedway|marathon|sunoco|conoco|phillips\s*66|kum\s*&\s*go|kum\s+and\s+go|casey's|love's|pilot|flying\s*j|travel\s*center|ta\s+travel|petro\s+stopping)\b/i;
const GROCERY_TITLE_PATTERN = /\b(?:albertsons|kroger|safeway|publix|whole\s*foods|trader\s*joe'?s|h\s*-?\s*e\s*-?\s*b|heb|aldi|lidl|winco|food\s*lion|wegmans|meijer|sprouts|market\s*basket|shop\s*rite|shoprite|ralphs|vons|pavilions|tom\s*thumb|giant\s*eagle|stop\s*&\s*shop|stop\s+and\s+shop|walmart\s+neighborhood\s+market|fresh\s+market|central\s+market)\b/i;
const RETAIL_TITLE_PATTERN = /\b(?:target|walmart|costco|sam'?s\s*club|best\s*buy|home\s*depot|lowe'?s|ikea|macy'?s|nordstrom|tj\s*maxx|marshalls|ross|dillard'?s|academy\s*sports|dick'?s\s*sporting\s*goods|bass\s*pro|cabela'?s|dollar\s+general|family\s+dollar|dollar\s+tree|five\s+below|tractor\s+supply)\b/i;
const PHARMACY_TITLE_PATTERN = /\b(?:cvs|walgreens|rite\s*aid|pharmacy|drugstore|drug\s*store)\b/i;
const RESTAURANT_TITLE_PATTERN = /\b(?:mcdonald'?s|burger\s*king|wendy'?s|whataburger|in\s*-?\s*n\s*-?\s*out|chick\s*-?\s*fil\s*-?\s*a|taco\s*bell|chipotle|subway|panera|olive\s*garden|texas\s*roadhouse|ihop|denny'?s|waffle\s*house|applebee'?s|chili'?s|sonic|dairy\s*queen|pizza\s*hut|domino'?s|papa\s+john'?s|popeyes|kfc|raising\s*cane'?s|panda\s*express)\b/i;
const COFFEE_TITLE_PATTERN = /\b(?:starbucks|dunkin|dutch\s*bros|coffee|espresso|cafe|caffe)\b/i;
const BANK_TITLE_PATTERN = /\b(?:bank|credit\s*union|chase|wells\s*fargo|bank\s*of\s*america|capital\s*one|citibank|pnc|truist|td\s*bank|us\s*bank|frost\s*bank)\b/i;
const HOTEL_TITLE_PATTERN = /\b(?:hotel|motel|inn|suites|resort|lodg(?:e|ing)|marriott|hilton|hyatt|holiday\s*inn|hampton|la\s*quinta|best\s*western|courtyard|residence\s+inn|fairfield\s+inn|comfort\s+inn|motel\s*6|super\s*8)\b/i;
const HEALTH_TITLE_PATTERN = /\b(?:hospital|clinic|urgent\s*care|medical|dentist|orthodont|vision|optical|veterinary|vet\s*clinic|pediatrics?|children'?s\s+(?:medical|hospital|clinic|northeast)|cook\s+children'?s)\b/i;
const FITNESS_TITLE_PATTERN = /\b(?:gym|fitness|planet\s*fitness|la\s*fitness|anytime\s*fitness|orangetheory|crossfit|ymca|pilates|yoga)\b/i;
const ENTERTAINMENT_TITLE_PATTERN = /\b(?:entertainment|amusement|theme\s*park|six\s*flags|cinema|theater|theatre|movie|amc|regal|cinemark|bowling|arcade|zoo|aquarium|stadium|arena|ballpark|amphitheater|amphitheatre)\b/i;

const PLACE_CATEGORY_RULES: readonly PlaceCategoryRule[] = [
  {
    label: 'Fire station',
    category: 'fire_station',
    kind: 'civic',
    categoryPattern: /\bfire\s*(?:station|department)?\b/,
    titlePattern: /\bfire\s*(?:station|department)\b/,
  },
  {
    label: 'Police',
    category: 'police',
    kind: 'civic',
    categoryPattern: /\b(?:police|sheriff|law\s+enforcement)\b/,
    titlePattern: /\b(?:police|sheriff)\b/,
  },
  {
    label: 'ATM',
    category: 'atm',
    kind: 'finance',
    categoryPattern: /\batm\b/,
    titlePattern: /\batm\b/,
  },
  {
    label: 'Parking',
    category: 'parking',
    kind: 'parking',
    categoryPattern: /\b(?:parking|car\s+park|parkade)\b/,
    titlePattern: /\bparking\b/,
  },
  {
    label: 'Transit',
    category: 'transit',
    kind: 'transit',
    categoryPattern: /\b(?:airport|bus\s+station|train\s+station|railway|metro|subway|transit|transport|ferry|tram)\b/,
    titlePattern: /\b(?:airport|bus\s+station|train\s+station|rail\s+station|terminal|transit|ferry)\b/,
  },
  {
    label: 'Grocery',
    category: 'grocery',
    kind: 'shopping',
    categoryPattern: /\b(?:grocery|supermarket|food\s+market)\b/,
    titlePattern: GROCERY_TITLE_PATTERN,
  },
  {
    label: 'Pharmacy',
    category: 'pharmacy',
    kind: 'health',
    categoryPattern: /\b(?:pharmacy|drugstore|drug\s+store|chemist)\b/,
    titlePattern: PHARMACY_TITLE_PATTERN,
  },
  {
    label: 'Medical',
    category: 'medical',
    kind: 'health',
    categoryPattern: /\b(?:hospital|clinic|urgent\s+care|emergency\s+room|medical|doctor|dentist|veterinary|optical|health)\b/,
    titlePattern: HEALTH_TITLE_PATTERN,
  },
  {
    label: 'Coffee',
    category: 'coffee',
    kind: 'food',
    categoryPattern: /\b(?:coffee|cafe|cafeteria|espresso)\b/,
    titlePattern: COFFEE_TITLE_PATTERN,
  },
  {
    label: 'Restaurant',
    category: 'restaurant',
    kind: 'food',
    categoryPattern: /\b(?:restaurant|fast\s+food|food\s+and\s+drink|food|diner|eatery|pizza|burger|sandwich|taco|sushi|bbq|barbecue|bakery|ice\s+cream)\b/,
    titlePattern: RESTAURANT_TITLE_PATTERN,
  },
  {
    label: 'Bar',
    category: 'bar',
    kind: 'food',
    categoryPattern: /\b(?:bar|pub|brewery|beer|wine|cocktail|nightclub|nightlife)\b/,
    titlePattern: /\b(?:bar|pub|brewery|taproom|nightclub)\b/,
  },
  {
    label: 'Hotel',
    category: 'hotel',
    kind: 'lodging',
    categoryPattern: /\b(?:hotel|motel|lodging|lodge|resort|hostel|inn)\b/,
    titlePattern: HOTEL_TITLE_PATTERN,
  },
  {
    label: 'Park',
    category: 'park',
    kind: 'park',
    categoryPattern: /\b(?:park|gardens?|trail|nature|beach|campground|playground|picnic|recreation\s+area)\b/,
    titlePattern: /\b(?:park|botanical\s+gardens?|water\s+gardens?|trail|trailhead|nature\s+preserve|beach|campground|playground)\b/,
  },
  {
    label: 'Fitness',
    category: 'fitness',
    kind: 'adventure',
    categoryPattern: /\b(?:gym|fitness|sports\s+club|recreation\s+center|yoga|pilates|climbing)\b/,
    titlePattern: FITNESS_TITLE_PATTERN,
  },
  {
    label: 'Entertainment',
    category: 'entertainment',
    kind: 'entertainment',
    categoryPattern: /\b(?:entertainment|amusement|theme\s+park|cinema|movie|theater|theatre|bowling|arcade|zoo|aquarium|stadium|arena|music\s+venue|performing\s+arts)\b/,
    titlePattern: ENTERTAINMENT_TITLE_PATTERN,
  },
  {
    label: 'Museum',
    category: 'museum',
    kind: 'landmark',
    categoryPattern: /\b(?:museum|gallery|art\s+gallery)\b/,
    titlePattern: /\b(?:museum|gallery)\b/,
  },
  {
    label: 'Landmark',
    category: 'landmark',
    kind: 'landmark',
    categoryPattern: /\b(?:tourist|attraction|landmark|historic|monument|viewpoint|scenic|lookout)\b/,
    titlePattern: /\b(?:landmark|monument|historic|lookout|overlook|viewpoint)\b/,
  },
  {
    label: 'Place of worship',
    category: 'worship',
    kind: 'landmark',
    categoryPattern: /\b(?:church|mosque|temple|synagogue|place\s+of\s+worship|religious)\b/,
    titlePattern: /\b(?:church|mosque|temple|synagogue|cathedral)\b/,
  },
  {
    label: 'Library',
    category: 'library',
    kind: 'landmark',
    categoryPattern: /\blibrary\b/,
    titlePattern: /\blibrary\b/,
  },
  {
    label: 'School',
    category: 'school',
    kind: 'education',
    categoryPattern: /\b(?:school|college|university|education|campus)\b/,
    titlePattern: /\b(?:school|college|university|academy|campus)\b/,
  },
  {
    label: 'Auto service',
    category: 'auto_service',
    kind: 'shopping',
    categoryPattern: /\b(?:auto|automotive|car\s+wash|car\s+repair|car\s+rental|vehicle|tire|tyre|mechanic|dealership)\b/,
    titlePattern: /\b(?:auto|automotive|car\s+wash|car\s+rental|tire|tyre|mechanic|dealership)\b/,
  },
  {
    label: 'Bank',
    category: 'bank',
    kind: 'finance',
    categoryPattern: /\b(?:bank|credit\s+union|finance|financial)\b/,
    titlePattern: BANK_TITLE_PATTERN,
  },
  {
    label: 'Shopping',
    category: 'shopping',
    kind: 'shopping',
    categoryPattern: /\b(?:shop|shopping|store|retail|mall|department\s+store|clothing|hardware|electronics|bookstore|convenience)\b/,
    titlePattern: RETAIL_TITLE_PATTERN,
  },
  {
    label: 'Services',
    category: 'service',
    kind: 'other',
    categoryPattern: /\b(?:salon|spa|barber|laundry|dry\s+cleaner|post\s+office|courthouse|city\s+hall|government|service)\b/,
    titlePattern: /\b(?:salon|spa|barber|laundry|post\s+office|courthouse|city\s+hall)\b/,
  },
] as const;

export function titleCaseMapFeatureCategory(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

export function normalizePlaceCategoryText(...values: Array<string | undefined>): string {
  return values
    .filter(Boolean)
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isFuelPlaceCategory(category: string | undefined, title = ''): boolean {
  const categoryText = normalizePlaceCategoryText(category);
  const titleText = normalizePlaceCategoryText(title);
  if (/gas station|fuel|petrol|service station|ev charging|charging station/.test(categoryText)) {
    return true;
  }

  return GAS_STATION_TITLE_PATTERN.test(titleText) &&
    /gas|fuel|petrol|charging|motorist|convenience|service|store|shop|poi|place/.test(categoryText || 'place');
}

export function getPlaceCategoryOverride(
  rawCategory: string | undefined,
  title: string | undefined,
): PlaceCategoryOverride | null {
  const categoryText = normalizePlaceCategoryText(rawCategory);
  const titleText = normalizePlaceCategoryText(title);
  if (!titleText && !categoryText) {
    return null;
  }

  if (isFuelPlaceCategory(rawCategory, titleText)) return { label: 'Gas station', category: 'gas_station', kind: 'fuel' };

  const matchingRule = PLACE_CATEGORY_RULES.find((rule) =>
    Boolean(
      (categoryText && rule.categoryPattern?.test(categoryText)) ||
      (titleText && rule.titlePattern?.test(titleText)),
    ),
  );

  if (matchingRule) {
    return {
      label: matchingRule.label,
      category: matchingRule.category,
      kind: matchingRule.kind,
    };
  }

  return null;
}

export function resolveNearbyPlaceCategoryValue(rawCategory: string | undefined, title: string | undefined): string {
  return getPlaceCategoryOverride(rawCategory, title)?.category || rawCategory || 'place';
}

export function normalizeNearbyPlaceCategoryLabel(
  label: string | undefined,
  title = '',
  fallback = 'Place',
): string {
  const categoryOverride = getPlaceCategoryOverride(label, title);
  if (categoryOverride) {
    return categoryOverride.label;
  }

  const labelText = normalizePlaceCategoryText(label);
  const titleText = normalizePlaceCategoryText(title);
  const combinedText = `${titleText} ${labelText}`;

  if (/fire station|fire department|\bfire\b/.test(combinedText)) return 'Fire station';
  if (/police|sheriff/.test(combinedText)) return 'Police';
  if (/hospital|clinic|urgent care|emergency room|medical/.test(combinedText)) return 'Medical';
  if (/pharmacy|drugstore/.test(combinedText)) return 'Pharmacy';
  if (isFuelPlaceCategory(label, title)) return 'Gas station';
  if (/motorist/.test(labelText)) return 'Travel stop';
  if (/grocery|supermarket|market/.test(combinedText)) return 'Grocery';
  if (/shop|store|mall|retail/.test(combinedText)) return 'Shopping';
  if (/entertainment|amusement|theme park|cinema|movie|theater|theatre|bowling|arcade|zoo|aquarium|stadium|arena/.test(combinedText)) return 'Entertainment';
  if (/restaurant|diner|food/.test(combinedText)) return 'Restaurant';
  if (/coffee|cafe/.test(combinedText)) return 'Coffee';
  if (/\bbar\b|pub|nightlife/.test(combinedText)) return 'Bar';
  if (/park|trail|garden|nature/.test(combinedText)) return 'Park';
  if (/museum/.test(combinedText)) return 'Museum';
  if (/tourist|landmark|attraction|historic/.test(combinedText)) return 'Landmark';
  if (/hotel|lodg/.test(combinedText)) return 'Hotel';
  if (/school|college|university|education/.test(combinedText)) return 'School';
  if (/parking/.test(combinedText)) return 'Parking';
  if (/\batm\b/.test(combinedText)) return 'ATM';
  if (/bank/.test(combinedText)) return 'Bank';
  if (/shop|store|mall|retail/.test(combinedText)) return 'Shopping';

  return titleCaseMapFeatureCategory(label || fallback);
}

export function formatNearbyPlaceCategory(place: MapNearbyPlacePin): string {
  const label = place.categoryLabel || place.category || (place.kind === 'fuel' ? 'Fuel' : 'Place');
  return normalizeNearbyPlaceCategoryLabel(label, place.title, place.kind === 'fuel' ? 'Gas station' : 'Place');
}

export function formatNearbyPlaceAddress(place: MapNearbyPlacePin): string {
  return place.address || place.subtitle || '';
}

export function buildGoogleMapsAddressUrl(place: MapNearbyPlacePin, address: string): string {
  const query = address.trim() ||
    [place.title, place.latitude.toFixed(6), place.longitude.toFixed(6)].filter(Boolean).join(' ');
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', query);
  return url.toString();
}

export function formatNearbyPlaceDistance(place: MapNearbyPlacePin): string {
  return place.distanceLabel || '';
}

export function getNearbyPlaceKind(place: MapNearbyPlacePin): string {
  if (place.kind === 'fuel') {
    return 'fuel';
  }

  const categoryOverride = getPlaceCategoryOverride(place.categoryLabel || place.category, place.title);
  if (categoryOverride) {
    return categoryOverride.kind;
  }

  const normalizedLabel = normalizeNearbyPlaceCategoryLabel(place.categoryLabel || place.category, place.title);
  const category = `${place.category ?? ''} ${place.categoryLabel ?? ''} ${normalizedLabel} ${place.title ?? ''}`.toLowerCase();
  if (isFuelPlaceCategory(category, place.title)) return 'fuel';
  if (/hospital|clinic|pharmacy|health|medical/.test(category)) return 'health';
  if (/entertainment|amusement|theme park|cinema|movie|theater|theatre|bowling|arcade|zoo|aquarium|stadium|arena/.test(category)) return 'entertainment';
  if (/shop|store|mall|retail|grocery|supermarket|market/.test(category)) return 'shopping';
  if (/school|college|university|education/.test(category)) return 'education';
  if (/food|drink|coffee|restaurant|cafe|bar/.test(category)) return 'food';
  if (/park|trail|garden|nature/.test(category)) return 'park';
  if (/hotel|lodg/.test(category)) return 'lodging';
  if (/gas|fuel|charging/.test(category)) return 'fuel';
  if (/tourist|landmark|museum|historic|attraction|culture/.test(category)) return 'landmark';
  return 'other';
}

export function getNearbyPlaceIconName(place: MapNearbyPlacePin): string {
  if (place.iconName) {
    return place.iconName;
  }

  const kind = getNearbyPlaceKind(place);
  switch (kind) {
    case 'fuel':
      return 'fuel';
    case 'food':
      return 'food';
    case 'park':
      return 'nature';
    case 'shopping':
      return 'shopping';
    case 'entertainment':
      return 'entertainment';
    case 'landmark':
      return 'scenic';
    case 'education':
      return 'culture';
    default:
      return 'pin';
  }
}
