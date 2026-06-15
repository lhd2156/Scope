import type { SpotCategory, TripPace } from '@/types';

export type BriefQuestionKey = 'destination' | 'endDestination' | 'duration' | 'interests' | 'pace' | 'travelParty';

export interface BriefQuestion {
  key: BriefQuestionKey;
  text: string;
}

export interface ItineraryBuildDraftDefaults {
  startDate?: string | undefined;
  endDate?: string | undefined;
  durationDays?: number | undefined;
  interests?: SpotCategory[] | undefined;
  pace?: TripPace | undefined;
  groupSize?: number | undefined;
}

export interface ItineraryBriefDraftSnapshot {
  destination?: string | undefined;
  endDestination?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  interests?: SpotCategory[] | undefined;
  pace?: TripPace | '' | undefined;
  groupSize?: number | undefined;
}

export function formatCurrency(value: number | undefined): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  return `$${Math.round(Number(value)).toLocaleString('en-US')}`;
}

export function parsePlannerDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDateRangeDurationDays(startDate: string | undefined, endDate: string | undefined): number | null {
  const start = parsePlannerDate(startDate);
  const end = parsePlannerDate(endDate);

  if (!start || !end || end < start) {
    return null;
  }

  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

export function normalizeDurationDays(value: number | undefined): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(Number(value));
  return rounded >= 1 && rounded <= 30 ? rounded : null;
}

export function getBuildDefaultsDurationDays(defaults: ItineraryBuildDraftDefaults): number | null {
  return normalizeDurationDays(defaults.durationDays)
    ?? getDateRangeDurationDays(defaults.startDate, defaults.endDate);
}

export function formatTravelPartyLabel(groupSize: number | undefined): string {
  const size = Number(groupSize);

  if (!Number.isFinite(size) || size < 1) {
    return '';
  }

  if (size === 1) {
    return 'solo traveler';
  }

  if (size === 2) {
    return '2 travelers, likely a couple or pair';
  }

  return `${size} travelers, group or family`;
}

export function getBriefQuestion(key: BriefQuestionKey): BriefQuestion {
  const questions: Record<BriefQuestionKey, string> = {
    destination: 'What start location should I use for this trip?',
    endDestination: 'What final destination should I use for this itinerary?',
    duration: 'How many days should I plan for?',
    interests: 'What kind of trip should this feel like: food, culture, nature, adventure, nightlife, shopping, entertainment, or balanced?',
    pace: 'What pace should I use: relaxed, balanced, or packed?',
    travelParty: 'Who is coming with you: solo, a couple, a group, or family?',
  };

  return {
    key,
    text: questions[key],
  };
}

export function getBriefQuestions(keys: BriefQuestionKey[]): BriefQuestion[] {
  return keys.map(getBriefQuestion);
}

export function getMissingItineraryBriefQuestions(
  draft: ItineraryBriefDraftSnapshot,
  draftDefaults: ItineraryBuildDraftDefaults = {},
  options: { requireEndDestination?: boolean } = {},
): BriefQuestion[] {
  const hasStart = Boolean((draft.destination ?? '').trim());
  const hasEnd = Boolean(draft.endDestination?.trim());
  const durationDays = getDateRangeDurationDays(draft.startDate, draft.endDate);
  const hasDefaultDuration = Boolean((draftDefaults.startDate && draftDefaults.endDate) || normalizeDurationDays(draftDefaults.durationDays));
  const hasDefaultInterests = Boolean(draftDefaults.interests?.length);
  const hasDefaultPace = Boolean(draftDefaults.pace);
  const hasDefaultTravelParty = Number.isFinite(draftDefaults.groupSize) && Number(draftDefaults.groupSize) > 0;
  const questions: BriefQuestion[] = [];

  if (!hasStart) {
    questions.push(getBriefQuestion('destination'));
  }

  if (options.requireEndDestination && !hasEnd) {
    questions.push(getBriefQuestion('endDestination'));
  }

  if ((!durationDays || durationDays <= 1) && !hasDefaultDuration) {
    questions.push(getBriefQuestion('duration'));
  }

  if (!draft.interests?.length && !hasDefaultInterests) {
    questions.push(getBriefQuestion('interests'));
  }

  if (!draft.pace && !hasDefaultPace) {
    questions.push(getBriefQuestion('pace'));
  }

  if ((!Number.isFinite(draft.groupSize) || Number(draft.groupSize) < 1) && !hasDefaultTravelParty) {
    questions.push(getBriefQuestion('travelParty'));
  }

  return questions;
}

export function summarizeOffQuestionBriefReply(value: string): string {
  if (/\b(budget|inside|under|cap|\$|cost|spend|price|cheap|expensive)\b/i.test(value)) {
    return 'Got the budget guardrail.';
  }

  if (/\b(time|timing|schedule|depart|arrival|arrive|morning|night|late|early)\b/i.test(value)) {
    return 'Got the timing note.';
  }

  if (/\b(stop|food|coffee|gas|place|restaurant|nearby)\b/i.test(value)) {
    return 'Got that route note.';
  }

  return 'I caught that.';
}

export function buildPendingBriefSuggestions(pendingBrief: { missingKeys: BriefQuestionKey[] }): string[] {
  const currentKey = pendingBrief.missingKeys[0];

  if (currentKey === 'duration') {
    return ['1 day', '2 days', 'Surprise me'];
  }

  if (currentKey === 'interests') {
    return ['Balanced', 'Food and culture', 'Nature and scenic'];
  }

  if (currentKey === 'pace') {
    return ['Relaxed pace', 'Balanced pace', 'Packed pace'];
  }

  if (currentKey === 'travelParty') {
    return ['Solo', 'Couple', 'Group of 4'];
  }

  if (currentKey === 'destination') {
    return ['Help me choose a start point', 'I will add the start in the route builder', 'Cancel this build'];
  }

  if (currentKey === 'endDestination') {
    return ['Help me choose an end point', 'I will add the end in the route builder', 'Cancel this build'];
  }

  return ['Surprise me', 'Balanced', 'Cancel this build'];
}

export function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getWeekendDateDefaults(currentStartDate?: string, now = new Date()): ItineraryBuildDraftDefaults {
  const start = parsePlannerDate(currentStartDate) ?? now;
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
    durationDays: 2,
  };
}

export function getDefaultForBriefQuestion(
  key: BriefQuestionKey,
  currentStartDate?: string,
  now = new Date(),
): ItineraryBuildDraftDefaults {
  if (key === 'duration') {
    return getWeekendDateDefaults(currentStartDate, now);
  }

  if (key === 'interests') {
    return { interests: ['food', 'culture', 'scenic'] };
  }

  if (key === 'pace') {
    return { pace: 'moderate' };
  }

  if (key === 'travelParty') {
    return { groupSize: 2 };
  }

  return {};
}

export function mergeItineraryBuildDefaults(
  current: ItineraryBuildDraftDefaults,
  next: ItineraryBuildDraftDefaults,
): ItineraryBuildDraftDefaults {
  return {
    ...current,
    ...next,
    durationDays: normalizeDurationDays(next.durationDays) ?? normalizeDurationDays(current.durationDays) ?? undefined,
    interests: next.interests ? [...next.interests] : current.interests ? [...current.interests] : undefined,
  };
}

export function buildSmartDefaultsForKeys(
  keys: BriefQuestionKey[],
  currentStartDate?: string,
  now = new Date(),
): ItineraryBuildDraftDefaults {
  return keys.reduce<ItineraryBuildDraftDefaults>(
    (defaults, key) => mergeItineraryBuildDefaults(defaults, getDefaultForBriefQuestion(key, currentStartDate, now)),
    {},
  );
}

export function parseDurationReply(value: string, currentStartDate?: string, now = new Date()): ItineraryBuildDraftDefaults | null {
  if (/\bweekend\b/i.test(value)) {
    return getWeekendDateDefaults(currentStartDate, now);
  }

  const explicitMatch = value.match(/\b(\d{1,2})\s*(?:day|days|d)\b/i);
  const bareNumberMatch = value.trim().match(/^(\d{1,2})$/);
  const parsed = Number(explicitMatch?.[1] ?? bareNumberMatch?.[1]);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) {
    return null;
  }

  const start = parsePlannerDate(currentStartDate) ?? now;
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(0, parsed - 1));

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
    durationDays: parsed,
  };
}

export function parseExplicitDurationPrompt(value: string, currentStartDate?: string, now = new Date()): ItineraryBuildDraftDefaults | null {
  const normalized = value.trim();
  const explicitMatch = normalized.match(/\b(\d{1,2})\s*-?\s*(?:day|days|d)\b/i);
  const wordDuration = /\b(?:one|single|same)\s*-?\s*day\b/i.test(normalized) ? 1 : null;
  const parsed = Number(explicitMatch?.[1] ?? wordDuration);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) {
    return null;
  }

  const start = parsePlannerDate(currentStartDate) ?? now;
  const end = new Date(start);
  end.setDate(start.getDate() + Math.max(0, parsed - 1));

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
    durationDays: parsed,
  };
}

export function parseInterestReply(value: string): ItineraryBuildDraftDefaults | null {
  const normalized = value.toLowerCase();
  const matched = inferInterestsFromText(normalized);

  if (/\bbalanced|mix|variety|everything\b/.test(normalized)) {
    return { interests: ['food', 'culture', 'scenic'] };
  }

  return matched.length ? { interests: matched } : null;
}

export function inferInterestsFromText(value: string): SpotCategory[] {
  const normalized = value.toLowerCase();
  const matched = new Set<SpotCategory>();

  if (/\bfood|restaurant|coffee|cafe|taco|brewery|drink\b/.test(normalized)) {
    matched.add('food');
  }

  if (/\bnature|park|trail|hike|outdoor|lake|beach\b/.test(normalized)) {
    matched.add('nature');
  }

  if (/\bnightlife|bar|club|music|live music\b/.test(normalized)) {
    matched.add('nightlife');
  }

  if (/\bculture|museum|art|history|historic|gallery|landmark\b/.test(normalized)) {
    matched.add('culture');
  }

  if (/\badventure|active|climb|kayak|bike|explore\b/.test(normalized)) {
    matched.add('adventure');
  }

  if (/\bshopping|shop|market|boutique\b/.test(normalized)) {
    matched.add('shopping');
  }

  if (/\bentertainment|amusement|theme park|six flags|bowling|arcade|movie|cinema|concert|zoo|aquarium|stadium|arena|escape room|mini golf|laser tag\b/.test(normalized)) {
    matched.add('entertainment');
  }

  if (/\bscenic|view|sight|sights|key sights|lookout|photo\b/.test(normalized)) {
    matched.add('scenic');
  }

  return [...matched];
}

export function parseExplicitInterestDefaultsFromPrompt(value: string): ItineraryBuildDraftDefaults | null {
  const matched = inferInterestsFromText(value);
  return matched.length ? { interests: matched } : null;
}

export function parsePaceReply(value: string): ItineraryBuildDraftDefaults | null {
  if (/\brelaxed|slow|chill|easy\b/i.test(value)) {
    return { pace: 'relaxed' };
  }

  if (/\bpacked|busy|full|fast|max\b/i.test(value)) {
    return { pace: 'packed' };
  }

  if (/\bmoderate|balanced|normal|medium\b/i.test(value)) {
    return { pace: 'moderate' };
  }

  return null;
}

export function getPaceLabel(value: TripPace): string {
  if (value === 'packed') {
    return 'Packed';
  }

  if (value === 'relaxed') {
    return 'Relaxed';
  }

  return 'Balanced';
}

export function parseTravelPartyReply(value: string): ItineraryBuildDraftDefaults | null {
  const normalized = value.toLowerCase();
  const explicitMatch = normalized.match(/\b(\d{1,2})\s*(?:people|person|travelers?|friends?|adults?|kids?)\b/);
  const groupOfMatch = normalized.match(/\b(?:group|family|party|crew)\s+of\s+(\d{1,2})\b/);
  const parsed = Number(explicitMatch?.[1] ?? groupOfMatch?.[1]);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 20) {
    return { groupSize: parsed };
  }

  if (/\bsolo|alone|just me\b/.test(normalized)) {
    return { groupSize: 1 };
  }

  if (/\bcouple|pair|partner|date|two of us\b/.test(normalized)) {
    return { groupSize: 2 };
  }

  if (/\bfamily|group|friends\b/.test(normalized)) {
    return { groupSize: 4 };
  }

  return null;
}

export function parseBriefReplyForKey(
  value: string,
  key: BriefQuestionKey,
  currentStartDate?: string,
  now = new Date(),
): ItineraryBuildDraftDefaults | null {
  if (key === 'duration') {
    return parseDurationReply(value, currentStartDate, now);
  }

  if (key === 'interests') {
    return parseInterestReply(value);
  }

  if (key === 'pace') {
    return parsePaceReply(value);
  }

  if (key === 'travelParty') {
    return parseTravelPartyReply(value);
  }

  return null;
}

export function hasItineraryBuildDefaults(defaults: ItineraryBuildDraftDefaults): boolean {
  return Boolean(
    defaults.startDate ||
    defaults.endDate ||
    normalizeDurationDays(defaults.durationDays) !== null ||
    defaults.interests?.length ||
    defaults.pace ||
    (Number.isFinite(defaults.groupSize) && Number(defaults.groupSize) > 0),
  );
}

export function extractItineraryBuildDefaultsFromPrompt(
  value: string,
  currentStartDate?: string,
  now = new Date(),
): ItineraryBuildDraftDefaults {
  const defaults = [
    parseExplicitDurationPrompt(value, currentStartDate, now),
    parseExplicitInterestDefaultsFromPrompt(value),
    parsePaceReply(value),
    parseTravelPartyReply(value),
  ]
    .filter((candidate): candidate is ItineraryBuildDraftDefaults => Boolean(candidate));

  return defaults.reduce<ItineraryBuildDraftDefaults>(
    (mergedDefaults, nextDefaults) => mergeItineraryBuildDefaults(mergedDefaults, nextDefaults),
    {},
  );
}

export function getInterestLabel(value: SpotCategory | undefined): string {
  const labels: Partial<Record<SpotCategory, string>> = {
    adventure: 'adventure',
    culture: 'culture',
    food: 'food',
    nature: 'nature',
    nightlife: 'nightlife',
    entertainment: 'entertainment',
    scenic: 'scenic',
    shopping: 'shopping',
    other: 'local finds',
  };

  return value ? labels[value] ?? '' : '';
}

export function formatList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

export function buildAssumptionSummary(defaults: ItineraryBuildDraftDefaults): string[] {
  const summary: string[] = [];
  if (defaults.startDate && defaults.endDate) {
    const days = getBuildDefaultsDurationDays(defaults);
    summary.push(days ? `${days} days` : `${defaults.startDate} to ${defaults.endDate}`);
  } else if (normalizeDurationDays(defaults.durationDays)) {
    const days = normalizeDurationDays(defaults.durationDays) as number;
    summary.push(`${days} day${days === 1 ? '' : 's'}`);
  }

  if (defaults.interests?.length) {
    summary.push(`${formatList(defaults.interests.map(getInterestLabel).filter(Boolean))} interests`);
  }

  if (defaults.pace) {
    summary.push(`${getPaceLabel(defaults.pace)} pace`);
  }

  if (defaults.groupSize) {
    summary.push(formatTravelPartyLabel(defaults.groupSize));
  }

  return summary;
}

export function buildRoutePromptWithDefaults(originalPrompt: string, defaults: ItineraryBuildDraftDefaults): string {
  const assumptions = buildAssumptionSummary(defaults);
  return assumptions.length
    ? `${originalPrompt}\nSmart defaults from follow-up: ${assumptions.join('; ')}.`
    : originalPrompt;
}

export function formatRouteEndpointLabel(value: string | undefined): string {
  const parts = (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return '';
  }

  const [primary = '', locality = ''] = parts;
  return locality ? `${primary}, ${locality}` : primary;
}

export function getDateLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) {
    return '';
  }

  return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
}
