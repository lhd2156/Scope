import api from '@/services/api';
import {
  collapseRepeatedLetters,
  damerauLevenshteinDistance,
  normalizeNoisyCommandTokens,
  normalizeNoisyCommandWord,
  normalizeNoisyScopeAiPrompt,
  normalizeScopeAiCommandText,
  shouldFuzzyNormalizeCommandWord,
} from '@/services/scopeAiCommandNormalizer';
import { sanitizeScopeAiProviderQuery, sanitizeScopeAiVisibleText } from '@/services/scopeAiSafety';
import {
  ACTION_FENCE_PATTERN,
  buildStructuredBackendResponseText,
  extractActionsFromLocalResponse,
  normalizeScopeAiImagePayload,
  type ScopeAiBackendResponse,
  type ScopeAiChatResponse,
  type ScopeAiImageInput,
} from '@/services/scopeAiServiceResponseHelpers';
import { lexScopeAiCommandText, type ScopeAiLexToken } from '@/services/wasmService';

export { normalizeScopeAiCommandText } from '@/services/scopeAiCommandNormalizer';
export type { ScopeAiChatResponse, ScopeAiImageInput } from '@/services/scopeAiServiceResponseHelpers';

export interface ScopeAiChatInput {
  message: string;
  plannerState: object;
  sessionHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  preferences: object;
  images?: ScopeAiImageInput[];
}

const THEME_TERMS = ['culture', 'food', 'scenic', 'adventure', 'shopping', 'entertainment', 'nightlife', 'history', 'nature', 'family', 'luxury'];
const STREET_ADDRESS_PATTERN = /\b\d{1,6}\s+[\w'.-]+(?:\s+[\w'.-]+){0,6}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|circle|cir|way|parkway|pkwy|highway|hwy|trail|trl|terrace|ter|plaza|plz|farm(?:\s+to\s+market|-to-market)|fm|county road|cr|route)\b/i;
const DEFAULT_SCOPE_AI_DATE_YEAR = 2026;
const DATE_TOKEN_PATTERN = /(?:\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{2,4})?|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\.?,?\s+\d{2,4})?)/gi;
const UNCLEAR_SCOPE_AI_REPLY = 'Sorry, I cannot confidently answer that without guessing. Try a clearer trip-planning command like "start at [place]", "destination [place]", "weather for [city]", "find fuel", "set budget 700", or "build the itinerary."';
const UNCLEAR_SCOPE_AI_CHIPS = ['Show examples', 'Check route status', 'Add a start place'];
const CLEAR_SCOPE_AI_TOPIC_TERMS = new Set([
  'address',
  'addresses',
  'arcade',
  'bowling',
  'budget',
  'city',
  'destination',
  'diesel',
  'endpoint',
  'endpoints',
  'entertainment',
  'forecast',
  'fuel',
  'gas',
  'image',
  'images',
  'itinerary',
  'map',
  'mpg',
  'nearby',
  'pace',
  'pack',
  'packing',
  'place',
  'places',
  'photo',
  'photos',
  'picture',
  'pictures',
  'plan',
  'planner',
  'route',
  'spot',
  'spots',
  'start',
  'state',
  'stop',
  'stops',
  'travel',
  'traveler',
  'travelers',
  'trip',
  'verified',
  'vibe',
  'vibes',
  'weather',
]);
const CLEAR_SCOPE_AI_ASK_TERMS = new Set([
  'advice',
  'answer',
  'build',
  'check',
  'choose',
  'clear',
  'compare',
  'confidence',
  'create',
  'delete',
  'detail',
  'details',
  'explain',
  'find',
  'generate',
  'give',
  'help',
  'idea',
  'ideas',
  'make',
  'more',
  'recommend',
  'recommendation',
  'recommendations',
  'remove',
  'reset',
  'inspect',
  'review',
  'show',
  'source',
  'status',
  'suggest',
  'summary',
  'tell',
  'tighten',
  'why',
]);
const CLEAR_SCOPE_AI_FILLER_TERMS = new Set([
  'a',
  'about',
  'an',
  'and',
  'any',
  'are',
  'around',
  'at',
  'can',
  'could',
  'do',
  'for',
  'from',
  'have',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'please',
  'should',
  'that',
  'the',
  'them',
  'there',
  'this',
  'to',
  'under',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'you',
]);
const MONTH_LOOKUP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
const ROUTE_CITY_STATE_QUALIFIERS: Record<string, string> = {
  arlington: 'TX',
  austin: 'TX',
  dallas: 'TX',
  'fort worth': 'TX',
  houston: 'TX',
  plano: 'TX',
  'san antonio': 'TX',
  waco: 'TX',
};

interface LocalPlannerState {
  title?: string | null;
  start?: string | null;
  end?: string | null;
  stops?: unknown[];
  budget_min?: number | null;
  budget_max?: number | null;
  pace?: string | null;
  theme?: string[];
  fuel_type?: string | null;
  start_date?: string | null;
  date?: string | null;
  end_date?: string | null;
  party_size?: number | null;
  mpg?: number | null;
  gas_price?: number | null;
}

interface ExtractedMapCommand {
  command: string;
  query?: string;
}

interface ExtractedRouteEndpointPair {
  start: string;
  end: string;
}

type ScopeAiPlannerIntent =
  | 'none'
  | 'delete_confirmation'
  | 'delete_request'
  | 'map_command'
  | 'save_trip'
  | 'invite_member'
  | 'invite_missing_recipient'
  | 'open_share'
  | 'visibility'
  | 'rename_trip'
  | 'clear_endpoint'
  | 'ambiguous_route_clear'
  | 'nearby_places'
  | 'route_build'
  | 'route_status';

type ScopeAiCommandSafety = 'safe' | 'confirm_required' | 'missing_entity';

interface ParsedScopeCommand {
  original: string;
  normalizedMessage: string;
  normalized: string;
  tokens: Set<string>;
  lexicalTokens: ScopeAiLexToken[];
  intent: ScopeAiPlannerIntent;
  safety: ScopeAiCommandSafety;
  mapCommand?: ExtractedMapCommand;
  clearEndpoint?: 'start' | 'end';
  invite?: { recipient: string; role: 'editor' | 'viewer' };
  visibility?: boolean;
  title?: string;
}

interface ParsedDateToken {
  iso: string;
  explicitYear: boolean;
  index: number;
  raw: string;
}

interface LocalScopeAiResponseContext {
  scopeCommand: ParsedScopeCommand;
  message: string;
  normalized: string;
  plannerState: LocalPlannerState;
}

type LocalScopeAiResponseStage = (context: LocalScopeAiResponseContext) => ScopeAiChatResponse | null;

function escapeScopeAiRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getScopeAiKeywordTokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/gi) ?? []);
}

function mergeScopeAiLexicalKeywordTokens(baseTokens: Set<string>, lexicalTokens: ScopeAiLexToken[]): Set<string> {
  const merged = new Set(baseTokens);

  for (const token of lexicalTokens) {
    if (token.type === 'place_span') {
      continue;
    }

    if (/^[a-z0-9]+$/i.test(token.normalized)) {
      merged.add(token.normalized.toLowerCase());
    }
  }

  return merged;
}

function hasAnyScopeAiKeyword(tokens: Set<string>, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => tokens.has(keyword));
}

function hasScopeAiPhrase(normalized: string, phrase: string): boolean {
  return new RegExp(`\\b${escapeScopeAiRegExp(phrase).replace(/\\s+/g, '\\s+')}\\b`, 'i').test(normalized);
}

function hasAnyScopeAiPhrase(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => hasScopeAiPhrase(normalized, phrase));
}

function cleanupKeywordTargetValue(value: string | null | undefined): string | null {
  const cleaned = cleanupTripDocumentValue(value)
    ?.replace(/^(?:to|as|at|in|on|for|with|the|this|that|my|please|pls|me|it)\s+/i, '')
    .replace(/\s+(?:please|pls|thanks|for me|a little|a bit|some)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || /^(?:to|as|at|in|on|for|with|the|this|that|my|please|pls|me|it)$/i.test(cleaned)) {
    return null;
  }

  return cleaned.length >= 2 ? cleaned : null;
}

function isLikelyUnclearScopeAiPrompt(message: string): boolean {
  const safeMessage = sanitizeScopeAiProviderQuery(message.trim()) || message.trim();
  const normalizedMessage = normalizeNoisyScopeAiPrompt(safeMessage);
  const normalized = normalizedMessage.toLowerCase();

  if (!normalized) {
    return true;
  }

  if (isDeterministicPlannerCommand(normalizedMessage)) {
    return false;
  }

  if (/^(?:hi|hello|hey|thanks|thank you)\b/.test(normalized) && normalized.split(/\s+/).length <= 4) {
    return false;
  }

  const tokens = normalized.match(/[a-z][a-z']*/g) ?? [];
  if (!tokens.length) {
    return !/\d/.test(normalized);
  }

  const contentTokens = tokens.filter((token) => !CLEAR_SCOPE_AI_FILLER_TERMS.has(token));
  const topicTokens = contentTokens.filter((token) => CLEAR_SCOPE_AI_TOPIC_TERMS.has(token));
  const askTokens = contentTokens.filter((token) => CLEAR_SCOPE_AI_ASK_TERMS.has(token));
  const recognizedTokens = contentTokens.filter((token) =>
    CLEAR_SCOPE_AI_TOPIC_TERMS.has(token) ||
    CLEAR_SCOPE_AI_ASK_TERMS.has(token) ||
    THEME_TERMS.includes(token) ||
    MONTH_LOOKUP[token] !== undefined
  );
  const unknownContentTokens = contentTokens.filter((token) => !recognizedTokens.includes(token));
  const hasClearScopePhrase =
    /\bany\b.{0,24}\bideas?\b/.test(normalized) ||
    /\b(?:trip advice|plan my trip|what can you do|route status|check route|tell me about|explain|compare|confidence summary|show more|what source|stops? on the way|nearby places?)\b/.test(normalized);

  if (hasClearScopePhrase) {
    return false;
  }

  if (!topicTokens.length && !askTokens.length) {
    return true;
  }

  if (topicTokens.length && askTokens.length && unknownContentTokens.length <= Math.max(1, recognizedTokens.length)) {
    return false;
  }

  if (recognizedTokens.length >= 2 && unknownContentTokens.length <= recognizedTokens.length) {
    return false;
  }

  return true;
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatTravelerCount(value: number): string {
  return value === 1 ? '1 traveler' : `${value} travelers`;
}

function formatIsoDate(value: string): string {
  return value;
}

function toDateValue(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPlannerDefaultYear(plannerState: LocalPlannerState): number {
  const firstKnownDate = [plannerState.start_date, plannerState.date, plannerState.end_date]
    .map(toDateValue)
    .find((date): date is Date => Boolean(date));

  return firstKnownDate?.getFullYear() ?? DEFAULT_SCOPE_AI_DATE_YEAR;
}

function normalizeYear(value: string | undefined, fallbackYear: number): { year: number; explicitYear: boolean } {
  if (!value) {
    return { year: fallbackYear, explicitYear: false };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { year: fallbackYear, explicitYear: false };
  }

  if (value.length === 2) {
    return { year: 2000 + parsed, explicitYear: true };
  }

  return { year: parsed, explicitYear: true };
}

function buildIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function parseMonthName(value: string): number | null {
  const normalized = value.toLowerCase().replace(/\.$/, '');
  return MONTH_LOOKUP[normalized] ?? null;
}

function parseDateToken(rawToken: string, defaultYear: number): { iso: string; explicitYear: boolean } | null {
  const token = rawToken
    .trim()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ');

  const isoMatch = token.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const iso = buildIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    return iso ? { iso, explicitYear: true } : null;
  }

  const slashMatch = token.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    const { year, explicitYear } = normalizeYear(slashMatch[3], defaultYear);
    const iso = buildIsoDate(year, Number(slashMatch[1]), Number(slashMatch[2]));
    return iso ? { iso, explicitYear } : null;
  }

  const monthFirstMatch = token.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{2,4}))?$/i);
  if (monthFirstMatch) {
    const month = parseMonthName(monthFirstMatch[1] ?? '');
    const { year, explicitYear } = normalizeYear(monthFirstMatch[3], defaultYear);
    const iso = month ? buildIsoDate(year, month, Number(monthFirstMatch[2])) : null;
    return iso ? { iso, explicitYear } : null;
  }

  const dayFirstMatch = token.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:\s+(\d{2,4}))?$/i);
  if (dayFirstMatch) {
    const month = parseMonthName(dayFirstMatch[2] ?? '');
    const { year, explicitYear } = normalizeYear(dayFirstMatch[3], defaultYear);
    const iso = month ? buildIsoDate(year, month, Number(dayFirstMatch[1])) : null;
    return iso ? { iso, explicitYear } : null;
  }

  return null;
}

function extractDateTokens(message: string, defaultYear: number): ParsedDateToken[] {
  const tokens: ParsedDateToken[] = [];
  DATE_TOKEN_PATTERN.lastIndex = 0;
  for (const match of message.matchAll(DATE_TOKEN_PATTERN)) {
    const raw = match[0] ?? '';
    const parsed = parseDateToken(raw, defaultYear);
    if (!parsed) {
      continue;
    }
    tokens.push({
      ...parsed,
      raw,
      index: match.index ?? 0,
    });
  }

  return tokens;
}

function isDatePrompt(message: string): boolean {
  return /\b(date|dates|start date|end date|depart|departure|leave|leaving|arrive|arrival|return|through|until|trip from)\b/i.test(message) ||
    new RegExp(DATE_TOKEN_PATTERN.source, 'i').test(message);
}

function compareIsoDates(left: string, right: string): number {
  const leftDate = toDateValue(left);
  const rightDate = toDateValue(right);
  if (!leftDate || !rightDate) {
    return 0;
  }

  return leftDate.getTime() - rightDate.getTime();
}

function buildDateClarification(plannerState: LocalPlannerState, parsedDate: ParsedDateToken): ScopeAiChatResponse | null {
  const startDate = plannerState.start_date ?? plannerState.date;
  if (!startDate || parsedDate.explicitYear || compareIsoDates(parsedDate.iso, startDate) >= 0) {
    return null;
  }

  return textResponse(
    `I read that as ${formatIsoDate(parsedDate.iso)}, which is before the current start date ${formatIsoDate(startDate)}. I did not change the end date; include the year or update the start date first.`,
    ['Set start date', 'Set end date', 'Check route status'],
  );
}

function extractDateCommand(message: string, plannerState: LocalPlannerState): ScopeAiChatResponse | null {
  if (!isDatePrompt(message)) {
    return null;
  }

  const defaultYear = getPlannerDefaultYear(plannerState);
  const dateTokens = extractDateTokens(message, defaultYear);
  if (!dateTokens.length) {
    return null;
  }

  const normalized = message.toLowerCase();
  const hasStartDateIntent = /\b(start(?:ing)?\s+date|depart(?:ure)?|leave|leaving|begin(?:ning)?\s+date)\b/.test(normalized);
  const hasEndDateIntent = /\b(end\s+date|return\s+date|finish(?:ing)?\s+date|arriv(?:e|al)|until|through)\b/.test(normalized);
  const hasDateRangeIntent = dateTokens.length >= 2 && (
    /\b(trip|dates?|travel|plan)\b/.test(normalized) ||
    /\bfrom\b[\s\S]*\b(?:to|through|until|-)\b/.test(normalized) ||
    /\bbetween\b[\s\S]*\band\b/.test(normalized)
  );

  if (hasDateRangeIntent) {
    const [firstDate, secondDate] = dateTokens;
    if (!firstDate || !secondDate) {
      return null;
    }

    const startDate = compareIsoDates(firstDate.iso, secondDate.iso) <= 0 ? firstDate.iso : secondDate.iso;
    const endDate = compareIsoDates(firstDate.iso, secondDate.iso) <= 0 ? secondDate.iso : firstDate.iso;
    return actionResponse(
      [
        { type: 'SET_FIELD', field: 'start_date', value: startDate },
        { type: 'SET_FIELD', field: 'end_date', value: endDate },
      ],
      `Set the trip dates to ${formatIsoDate(startDate)} - ${formatIsoDate(endDate)}.`,
      ['Build for these dates', 'Set pace', 'Check weather'],
    );
  }

  const [dateToken] = dateTokens;
  if (!dateToken) {
    return null;
  }

  if (hasEndDateIntent) {
    const clarification = buildDateClarification(plannerState, dateToken);
    if (clarification) {
      return clarification;
    }

    return actionResponse(
      [{ type: 'SET_FIELD', field: 'end_date', value: dateToken.iso }],
      `Set the trip end date to ${formatIsoDate(dateToken.iso)}.`,
      ['Check timing', 'Build the route', 'Check weather'],
    );
  }

  if (hasStartDateIntent) {
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'start_date', value: dateToken.iso }],
      `Set the trip start date to ${formatIsoDate(dateToken.iso)}.`,
      ['Set end date', 'Check timing', 'Build the route'],
    );
  }

  return null;
}

function normalizeBudgetAmount(rawValue: string, suffix?: string): number | null {
  const amount = Number(rawValue.replace(/,/g, '')) * (suffix?.toLowerCase() === 'k' ? 1000 : 1);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function hasNegativeBudgetAmount(message: string): boolean {
  const normalized = message.toLowerCase();
  if (!/\bbudget\b|\bmax\b|\bminimum\b|\bmin\b|\blimit\b|\bunder\b|\bcap\b|\bceiling\b|\bfloor\b|\bcost\b|\bspend\b/.test(normalized)) {
    return false;
  }

  return /(^|[^\w])-+\s*\$?\s*\d/.test(normalized);
}

function isExactSingleBudgetCommand(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/\b(?:max(?:imum)?|under|below|cap|limit|ceiling|up to|less than)\b/.test(normalized)) {
    return false;
  }

  return /\b(?:set\s+)?(?:the\s+)?budget\s*(?:to|at|is|=|:)?\s*\$?\s*\d/.test(normalized);
}

function normalizePlannerBudgetMinimum(plannerState: LocalPlannerState): number | null {
  const value = Number(plannerState.budget_min);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function buildSingleBudgetActions(
  amount: number,
  plannerState: LocalPlannerState,
  options: { exact?: boolean } = {},
): object[] {
  const normalizedAmount = Math.max(0, Math.round(amount));
  const currentMinimum = normalizePlannerBudgetMinimum(plannerState);
  const actions: object[] = [];

  if (options.exact || (currentMinimum !== null && currentMinimum > normalizedAmount)) {
    actions.push({ type: 'SET_FIELD', field: 'budget_min', value: normalizedAmount });
  }

  actions.push({ type: 'SET_FIELD', field: 'budget_max', value: normalizedAmount });
  return actions;
}

function normalizeChips(chips: string[]): string[] {
  return [
    ...chips,
    'Add a start place',
    'Add an end place',
    'Build a balanced route',
  ].filter((chip, index, values) => values.indexOf(chip) === index).slice(0, 3);
}

function actionResponse(actions: object[], confirmation: string, chips: string[]): ScopeAiChatResponse {
  return {
    responseText: [
      '```action',
      JSON.stringify({ actions }),
      '```',
      confirmation,
      `CHIPS: ${JSON.stringify(normalizeChips(chips))}`,
    ].join('\n'),
    model: 'scope-ai-local',
  };
}

function textResponse(confirmation: string, chips: string[]): ScopeAiChatResponse {
  return {
    responseText: `${confirmation}\nCHIPS: ${JSON.stringify(normalizeChips(chips))}`,
    model: 'scope-ai-local',
  };
}

function addUniqueAction(actions: object[], action: object): void {
  const key = JSON.stringify(action);
  if (!actions.some((existing) => JSON.stringify(existing) === key)) {
    actions.push(action);
  }
}

function extractBudgetRange(message: string): [number, number] | null {
  const money = String.raw`\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?`;
  const directPatterns = [
    new RegExp(String.raw`\bbetween\s+${money}\s+(?:and|to|-)\s+${money}`, 'i'),
    new RegExp(String.raw`${money}\s*(?:-|to|through)\s*${money}`, 'i'),
    new RegExp(String.raw`\bbudget\s+${money}\s*(?:and|to|-)\s*${money}`, 'i'),
  ];

  for (const pattern of directPatterns) {
    const match = message.match(pattern);
    if (!match) {
      continue;
    }

    const left = normalizeBudgetAmount(match[1], match[2]);
    const right = normalizeBudgetAmount(match[3], match[4]);
    if (left !== null && right !== null) {
      return [Math.min(left, right), Math.max(left, right)];
    }
  }

  const labeledValues: Array<{ kind: 'min' | 'max'; value: number }> = [];
  const labelBeforeAmountPattern = new RegExp(String.raw`\b(min(?:imum)?|floor|least|low(?:er)?|from|max(?:imum)?|ceiling|cap|limit|under)\b(?:\s+(?:budget|cost|price|spend))?\s*(?:is|of|at|to|=|:)?\s*${money}`, 'gi');
  const amountBeforeLabelPattern = new RegExp(String.raw`${money}\s*(?:as|for|is)?\s*\b(min(?:imum)?|floor|least|low(?:er)?|max(?:imum)?|ceiling|cap|limit)\b`, 'gi');

  for (const match of message.matchAll(labelBeforeAmountPattern)) {
    const value = normalizeBudgetAmount(match[2], match[3]);
    if (value === null) {
      continue;
    }
    labeledValues.push({
      kind: /^min|floor|least|low|from/i.test(match[1]) ? 'min' : 'max',
      value,
    });
  }

  for (const match of message.matchAll(amountBeforeLabelPattern)) {
    const value = normalizeBudgetAmount(match[1], match[2]);
    if (value === null) {
      continue;
    }
    labeledValues.push({
      kind: /^min|floor|least|low/i.test(match[3]) ? 'min' : 'max',
      value,
    });
  }

  const minValues = labeledValues.filter((entry) => entry.kind === 'min').map((entry) => entry.value);
  const maxValues = labeledValues.filter((entry) => entry.kind === 'max').map((entry) => entry.value);
  const minValue = minValues.length ? Math.min(...minValues) : undefined;
  const maxValue = maxValues.length ? Math.max(...maxValues) : undefined;
  if (minValue === undefined || maxValue === undefined) {
    return null;
  }

  return [Math.min(minValue, maxValue), Math.max(minValue, maxValue)];
}

function extractSingleBudget(message: string): number | null {
  const normalized = message.toLowerCase();
  if (!/\bbudget\b|\bmax\b|\blimit\b|\bunder\b|\bcap\b/.test(normalized)) {
    return null;
  }

  const match = normalized.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)(k)?/);
  if (!match) {
    return null;
  }

  return normalizeBudgetAmount(match[1], match[2]);
}

function extractPartySize(message: string): number | null {
  const normalized = message
    .toLowerCase()
    .replace(/[\u2019]/g, "'")
    .replace(/[^\w'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const explicitPatterns = [
    /\b(?:set\s+)?(?:travelers?|travellers?|people|party|group|guests?|adults?)\s*(?:count|size)?\s*(?:to|as|at|=|is|for)?\s*(\d{1,2})\b/i,
    /\b(?:for|with)\s+(\d{1,2})\s*(?:travelers?|travellers?|people|persons?|guests?|adults?|friends?|kids?)\b/i,
    /\b(\d{1,2})\s*(?:travelers?|travellers?|people|persons?|guests?|adults?|friends?|kids?)\b/i,
    /\bparty\s+of\s+(\d{1,2})\b/i,
    /\bgroup\s+of\s+(\d{1,2})\b/i,
  ];

  for (const pattern of explicitPatterns) {
    const parsed = Number(normalized.match(pattern)?.[1]);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 20) {
      return parsed;
    }
  }

  if (/\b(solo|alone|just me|only me)\b/.test(normalized)) {
    return 1;
  }

  if (/\b(couple|pair|partner|date|two of us|2 of us)\b/.test(normalized)) {
    return 2;
  }

  if (/\b(family|friends|group trip)\b/.test(normalized)) {
    return 4;
  }

  return null;
}

function extractPlaceAfter(message: string, pattern: RegExp): string | null {
  const match = message.match(pattern);
  const value = match?.[1]?.trim().replace(/[.!?]+$/g, '');
  return value || null;
}

function cleanupEndpointCommandValue(value: string): string | null {
  let cleaned = value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+(?:please|pls|thanks|for real|if that makes sense|no guessing|do not guess|don't guess)$/i, '')
    .replace(/\s+/g, ' ');

  cleaned = cleaned
    .replace(/^(?:no\s+like|not\s+like|nah\s+like|no|nah|nope|wait|oops|sorry|actually|really|instead|correction|wrong|wrong one|change it|make it|make that|it is|it's|it should be|should be|use|try)\b[\s,:-]*/i, '')
    .replace(/^(?:to|at|in|from|is|as|set|with|be)\s+/i, '')
    .replace(/\s+(?:please|pls|thanks|for real|if that makes sense|no guessing|do not guess|don't guess)$/i, '')
    .trim();

  const correctionAfterComma = cleaned.match(/^(?:not\s+)?[^,;]+[,;]\s*(.+)$/i);
  if (correctionAfterComma && /^(?:not|wrong|old|previous)\b/i.test(cleaned)) {
    cleaned = correctionAfterComma[1].trim();
  }

  cleaned = cleaned
    .replace(/^(?:no\s+like|not\s+like|nah\s+like|no|nah|nope|wait|oops|sorry|actually|really|instead|correction|wrong|wrong one|change it|make it|make that|it is|it's|it should be|should be|use|try)\b[\s,:-]*/i, '')
    .replace(/^(?:to|at|in|from|is|as|set|with|be)\s+/i, '')
    .trim();

  return cleaned.length >= 2 ? cleaned : null;
}

function cleanupRouteEndpointValue(value: string): string | null {
  const trimmed = value
    .replace(/\b(?:under|below|less\s+than|up\s+to|over|above|max(?:imum)?|min(?:imum)?|budget|limit|cap|ceiling|floor|with|for|including)\b[\s\S]*$/i, '')
    .replace(/\b(?:this|next|coming)?\s*(?:weekend|morning|afternoon|evening|tonight|today|tomorrow)\b[\s\S]*$/i, '')
    .trim();
  const cleaned = cleanupEndpointCommandValue(trimmed);
  if (!cleaned || /^(?:trip|route|plan|itinerary|budget|travelers?|travellers?|people|party|group)$/i.test(cleaned)) {
    return null;
  }

  return cleaned;
}

function extractRouteEndpointPair(message: string): ExtractedRouteEndpointPair | null {
  const normalized = message.replace(/\s+/g, ' ').trim();
  if (!normalized || /\bhow\s+(?:far|long|much)\b/i.test(normalized) || isEndpointCorrectionCommand(normalized)) {
    return null;
  }

  const patterns = [
    /\bfrom\s+(.{2,120}?)\s+\bto\s+(.{2,160})(?:[?.!]|$)/i,
    /\bbetween\s+(.{2,120}?)\s+\band\s+(.{2,160})(?:[?.!]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const start = cleanupRouteEndpointValue(match[1]);
    const end = cleanupRouteEndpointValue(match[2]);
    if (start && end && /[a-z]/i.test(start) && /[a-z]/i.test(end)) {
      return {
        start: qualifyKnownRouteCity(start),
        end: qualifyKnownRouteCity(end),
      };
    }
  }

  return null;
}

function qualifyKnownRouteCity(value: string): string {
  if (/,/.test(value) || /\b(?:tx|texas|usa|united states)\b/i.test(value)) {
    return value;
  }

  const key = value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const qualifier = ROUTE_CITY_STATE_QUALIFIERS[key];
  return qualifier ? `${value}, ${qualifier}` : value;
}

function isStartCityRecommendationRequest(message: string): boolean {
  const normalized = message.replace(/[?!.\s]+$/g, '').trim();
  if (!normalized || STREET_ADDRESS_PATTERN.test(normalized)) {
    return false;
  }

  if (/\b(how|what button|which button|click|tap|disabled|route canvas)\b/i.test(normalized)) {
    return false;
  }

  const startTarget = String.raw`(?:start(?:ing)?\s*(?:point|place|city|cities|region|regions)?|departure\s*(?:city|cities|point|place|region|regions)|origin\s*(?:city|cities|point|place|region|regions)?)`;
  return (
    new RegExp(String.raw`\b(?:help\s+me\s+)?(?:choose|pick|suggest|recommend|compare|find)\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:good\s+|best\s+|strong\s+|practical\s+|easy\s+)?${startTarget}\b`, 'i').test(normalized) ||
    /\bwhere\s+should\s+(?:i|we)\s+(?:start|begin|leave|depart)\b/i.test(normalized) ||
    /\b(?:suggest|recommend|find|compare)\s+(?:some\s+)?(?:start(?:ing)?|departure|origin)\s+(?:cities|regions|places|ideas)\b/i.test(normalized)
  );
}

function extractBareAddressStartCommand(message: string, plannerState: LocalPlannerState): string | null {
  if (/\b(?:start|starting|origin|begin|leave|leaving|from|end|finish|destination|final destination|to)\b/i.test(message)) {
    return null;
  }

  const cleaned = cleanupEndpointCommandValue(message);
  if (!cleaned || !STREET_ADDRESS_PATTERN.test(cleaned)) {
    return null;
  }

  return plannerState.start?.trim() ? null : cleaned;
}

function extractEndpointCommand(message: string, target: 'start' | 'end'): string | null {
  if (target === 'start' && isStartCityRecommendationRequest(message)) {
    return null;
  }

  const patterns = target === 'start'
    ? [
      /\b(?:change|replace|correct|update|switch)\s+(?:the\s+)?start(?:ing)?(?:\s+(?:place|point|location|city|address))?(?:\s+from\s+.+?)?\s+(?:to|with|as)\s+(.+)$/i,
      /\b(?:use|try)\s+(.+?)\s+as\s+(?:the\s+)?start(?:ing)?(?:\s+(?:place|point|location|city|address))?$/i,
      /\b(?:set\s+)?start(?:ing)?(?:\s+(?:place|point|location|city|address))?\s*(?:set\s*)?(?:to|as|at|in|from|is|should\s+be|=)?\s+(.+)$/i,
      /\b(?:begin|leave|leaving)\s+(?:at|in|from)\s+(.+)$/i,
      /\bfrom\s+(.+)$/i,
    ]
    : [
      /\b(?:change|replace|correct|update|switch)\s+(?:the\s+)?(?:end|finish|destination|final destination)(?:\s+(?:place|point|location|city|address))?(?:\s+from\s+.+?)?\s+(?:to|with|as)\s+(.+)$/i,
      /\b(?:use|try)\s+(.+?)\s+as\s+(?:the\s+)?(?:end|finish|destination|final destination)(?:\s+(?:place|point|location|city|address))?$/i,
      /\b(?:set\s+)?(?:end|finish|destination|final destination)(?:\s+(?:place|point|location|city|address))?\s*(?:set\s*)?(?:to|as|at|in|is|should\s+be|=)?\s+(.+)$/i,
      /\bto\s+(.+)$/i,
    ];

  for (const pattern of patterns) {
    const value = extractPlaceAfter(message, pattern);
    if (value && !/^(?:to|at|in|from|is|set)\s*$/i.test(value)) {
      const cleaned = cleanupEndpointCommandValue(value);
      return cleaned ? qualifyKnownRouteCity(cleaned) : null;
    }
  }

  return null;
}

function isEndpointRecommendationRequest(message: string): boolean {
  const normalized = message.replace(/[?!.\s]+$/g, '').trim();
  if (!normalized) {
    return false;
  }

  if (/\b(how|what button|which button|click|tap|disabled|route canvas)\b/i.test(normalized)) {
    return false;
  }

  const endTarget = String.raw`(?:end\s*point|endpoint|end\s+place|end\s+city|destination|final\s+destination|finish(?:ing)?\s+(?:place|point|city)?)`;
  return (
    new RegExp(String.raw`\b(?:help\s+me\s+)?(?:choose|pick|suggest|recommend|find)\s+(?:a\s+|an\s+|the\s+)?(?:good\s+|best\s+|strong\s+|practical\s+|scenic\s+)?${endTarget}\b`, 'i').test(normalized) ||
    /\bwhere\s+should\s+(?:i|we)\s+(?:end|finish|go|head)\b/i.test(normalized) ||
    /\b(?:what'?s|what\s+is)\s+(?:a\s+)?(?:good|best|fun|cool|nice)\s+(?:place|destination|city|spot)\s+to\s+(?:go|head|visit)(?:\s+to)?\b/i.test(normalized) ||
    /\bwhere\s+should\s+(?:i|we)\s+go\b/i.test(normalized) ||
    /\b(?:suggest|recommend|find|pick|choose)\s+(?:a\s+)?(?:good|best|fun|cool|nice)?\s*(?:place|destination|city)\s+to\s+(?:go|head|visit)(?:\s+to)?\b/i.test(normalized) ||
    /\b(?:suggest|recommend|find)\s+(?:some\s+)?(?:places?|ideas?)\s+to\s+(?:end|finish)\b/i.test(normalized) ||
    /\bshow\s+more\s+endpoint\s+ideas\b/i.test(normalized) ||
    /\bfind\s+(?:practical|scenic)\s+endpoints?\b/i.test(normalized)
  );
}

function extractClearEndpointField(message: string): 'start' | 'end' | null {
  const normalized = message.replace(/[?!.\s]+$/g, '').trim();
  if (!/\b(?:remove|clear|delete|reset)\b/i.test(normalized)) {
    return null;
  }

  if (/\b(?:remove|clear|delete|reset)\s+(?:the\s+|my\s+|this\s+|that\s+)?(?:start|starting\s+(?:place|point|city|address)|origin)(?:\s+(?:place|point|city|address))?\b/i.test(normalized)) {
    return 'start';
  }

  if (/\b(?:remove|clear|delete|reset)\s+(?:the\s+|my\s+|this\s+|that\s+)?(?:end|endpoint|end\s+(?:place|point|city|address)|destination|final\s+destination|finish)(?:\s+(?:place|point|city|address))?\b/i.test(normalized)) {
    return 'end';
  }

  const tokens = getScopeAiKeywordTokens(normalized);
  const hasClearAction = hasAnyScopeAiKeyword(tokens, ['remove', 'clear', 'delete', 'reset']);
  if (hasClearAction && hasAnyScopeAiKeyword(tokens, ['start', 'starting', 'origin'])) {
    return 'start';
  }
  if (hasClearAction && hasAnyScopeAiKeyword(tokens, ['end', 'endpoint', 'destination', 'finish'])) {
    return 'end';
  }

  return null;
}

function cleanupTripDocumentValue(value: string | null | undefined): string | null {
  const cleaned = sanitizeScopeAiVisibleText(String(value ?? ''))
    .replace(/^[\s"'`]+|[\s"'`.!?]+$/g, '')
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

function extractTripTitleCommand(message: string): string | null {
  const patterns = [
    /\b(?:call it|rename (?:this|the)?\s*(?:trip|draft|route)?\s*(?:to|as)?|name (?:this|the)?\s*(?:trip|draft|route)?|title (?:it|this|the trip|this trip)?(?:\s+to| as)?)\s+(.+)$/i,
    /\b(?:change|set|update)\s+(?:the\s+)?title\s+(?:to|as)\s+(.+)$/i,
    /\b(?:trip|draft|route)\s+(?:title|name)\s+(.+)$/i,
    /\b(?:rename|title|name|call)\b(?:\s+(?:this|the|my|trip|draft|route|it|to|as))*\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const value = extractPlaceAfter(message, pattern);
    const cleaned = cleanupKeywordTargetValue(value);
    if (cleaned && !/^(?:to|as|it|this|trip|draft|route)$/i.test(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

function extractTripVisibilityCommand(normalized: string): boolean | null {
  if (/\b(?:make|set|turn|mark)\s+(?:this\s+|the\s+|my\s+)?(?:trip|draft|route|it)?\s*(?:as\s+)?private\b|\b(?:unpublish|hide)\s+(?:this\s+|the\s+|my\s+)?(?:trip|draft|route|it)\b|\b(?:crew only|member only|members only|friends only|private trip|trip private)\b/.test(normalized)) {
    return false;
  }

  const tokens = getScopeAiKeywordTokens(normalized);
  const hasVisibilityCommand = hasAnyScopeAiKeyword(tokens, ['make', 'set', 'turn', 'mark', 'switch', 'change', 'toggle', 'publish', 'publicize', 'unpublish', 'hide']);
  const hasTripTarget = hasAnyScopeAiKeyword(tokens, ['trip', 'draft', 'route', 'it', 'this', 'planner', 'document', 'access']);
  const hasPublicKeyword = hasAnyScopeAiKeyword(tokens, ['public', 'publish', 'published', 'publicize']);
  const hasPrivateKeyword = hasAnyScopeAiKeyword(tokens, ['private', 'unpublish', 'hide', 'crew', 'member', 'members', 'friend', 'friends']);

  if (
    /\b(?:not|no longer)\s+public\b|\bpublic\s+off\b/.test(normalized) ||
    hasAnyScopeAiPhrase(normalized, ['crew only', 'member only', 'members only', 'friends only']) ||
    (hasPrivateKeyword && (hasVisibilityCommand || hasTripTarget))
  ) {
    return false;
  }

  if (/\b(?:make|set|turn|mark)\s+(?:this\s+|the\s+|my\s+)?(?:trip|draft|route|it)?\s*(?:as\s+)?public\b|\b(?:publish|publicize)\s+(?:this\s+|the\s+|my\s+)?(?:trip|draft|route|it)\b|\b(?:trip|draft|route)\s+public\b/.test(normalized)) {
    return true;
  }

  if (hasPublicKeyword && (hasVisibilityCommand || hasTripTarget)) {
    return true;
  }

  return null;
}

function normalizeInviteRole(message: string): 'editor' | 'viewer' {
  return /\b(?:viewer|view only|read only|can view|view)\b/i.test(message) ? 'viewer' : 'editor';
}

function cleanupInviteRecipientValue(value: string | null | undefined): string | null {
  const cleaned = cleanupTripDocumentValue(value)
    ?.replace(/\s+(?:as\s+)?(?:an?\s+)?(?:editor|viewer|view only|read only|can view|view)$/i, '')
    .replace(/\s+(?:please|pls|thanks|for me)$/i, '')
    .trim();

  if (!cleaned || /^(?:this|the|my|trip|draft|route|it|crew|share|sharing|modal|panel|drawer)$/i.test(cleaned) || /\b(?:friend|friends|member|traveler|traveller|person|someone|user)\b/i.test(cleaned)) {
    return null;
  }

  return cleaned;
}

function extractInviteRecipient(message: string): { recipient: string; role: 'editor' | 'viewer' } | null {
  const patterns = [
    /\b(?:share|send)(?:\s+(?:this\s+|the\s+|my\s+)?(?:trip|draft|route|it))?\s+(?:with|to)\s+(.+?)(?:\s+as\s+(?:an?\s+)?(?:editor|viewer|view only|read only))?$/i,
    /\binvite\s+(.+?)(?:\s+as\s+(?:an?\s+)?(?:editor|viewer|view only|read only))?$/i,
    /\badd\s+(.+?)\s+(?:to|onto)\s+(?:this\s+|the\s+|my\s+)?(?:trip|draft|route|crew)(?:\s+as\s+(?:an?\s+)?(?:editor|viewer|view only|read only))?$/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const recipient = cleanupInviteRecipientValue(match?.[1]);
    if (!recipient) {
      continue;
    }

    return {
      recipient,
      role: normalizeInviteRole(message),
    };
  }

  const tokens = getScopeAiKeywordTokens(message);
  if (hasAnyScopeAiKeyword(tokens, ['share', 'send', 'invite', 'add'])) {
    const emailRecipient = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const usernameRecipient = message.match(/@[a-z0-9_.-]+/i)?.[0];
    const recipient = cleanupInviteRecipientValue(emailRecipient ?? usernameRecipient);
    if (recipient) {
      return {
        recipient,
        role: normalizeInviteRole(message),
      };
    }
  }

  return null;
}

function isOpenShareCommand(normalized: string): boolean {
  const tokens = getScopeAiKeywordTokens(normalized);
  const hasShareKeyword = hasAnyScopeAiKeyword(tokens, ['share', 'sharing', 'invite']);
  const hasOpenKeyword = hasAnyScopeAiKeyword(tokens, ['open', 'show', 'launch']);
  const hasPanelKeyword = hasAnyScopeAiKeyword(tokens, ['modal', 'panel', 'drawer', 'menu', 'dialog']);

  return /^(?:share|open sharing|open share|share this|share trip|share draft|share route)\b/.test(normalized) ||
    /\b(?:open|show)\s+(?:the\s+)?(?:share|sharing|invite)\s+(?:modal|panel|drawer)\b/.test(normalized) ||
    (hasShareKeyword && (hasOpenKeyword || hasPanelKeyword || hasAnyScopeAiKeyword(tokens, ['trip', 'draft', 'route', 'this', 'it'])));
}

function isSaveTripCommand(normalized: string): boolean {
  const tokens = getScopeAiKeywordTokens(normalized);
  const hasDirectSaveKeyword = hasAnyScopeAiKeyword(tokens, ['save', 'autosave', 'store']);
  const hasKeepKeyword = hasAnyScopeAiKeyword(tokens, ['keep']);
  const hasTripTarget = hasAnyScopeAiKeyword(tokens, ['trip', 'draft', 'route', 'this', 'it', 'planner', 'document']);
  const hasExplicitDocumentTarget = hasAnyScopeAiKeyword(tokens, ['trip', 'draft', 'route', 'planner', 'document']);
  const hasBudgetOrVisibilityConstraint = hasAnyScopeAiKeyword(tokens, [
    'budget',
    'inside',
    'under',
    'cap',
    'limit',
    'cost',
    'price',
    'spend',
    'cheap',
    'expensive',
    'money',
    'public',
    'private',
    'crew',
    'member',
    'members',
    'friend',
    'friends',
  ]);
  const isBareSaveDraftCommand = /^(?:save|autosave|store)(?:\s+(?:please|pls|it|this|draft|trip|route|for me))*$/.test(normalized);

  if ((hasDirectSaveKeyword || hasKeepKeyword) && hasAnyScopeAiKeyword(tokens, ['gas', 'fuel', 'stop', 'stops', 'station', 'stations', 'place', 'places', 'spot', 'spots']) && !hasExplicitDocumentTarget && !isBareSaveDraftCommand) {
    return false;
  }

  return /^(?:save|autosave|store|save this|save draft|save trip|save route|store this|store draft|store trip|store route)\b/.test(normalized) ||
    /\b(?:save|autosave|store)\s+(?:this\s+|the\s+|my\s+)?(?:trip|draft|route)\b/.test(normalized) ||
    isBareSaveDraftCommand ||
    (hasDirectSaveKeyword && hasTripTarget && !hasAnyScopeAiKeyword(tokens, ['gas', 'fuel', 'money'])) ||
    (hasKeepKeyword && hasExplicitDocumentTarget && !hasBudgetOrVisibilityConstraint);
}

function isDeleteTripConfirmation(normalized: string): boolean {
  return /^(?:confirm\s+delete|yes\s+delete|delete\s+it)[.!?]*$/.test(normalized);
}

function isDeleteTripRequest(normalized: string): boolean {
  const tokens = getScopeAiKeywordTokens(normalized);
  const hasDeleteKeyword = hasAnyScopeAiKeyword(tokens, ['delete', 'remove', 'discard', 'clear']);
  const hasTripTarget = hasAnyScopeAiKeyword(tokens, ['trip', 'draft', 'route', 'this', 'it', 'planner', 'document']);
  const hasEndpointTarget = hasAnyScopeAiKeyword(tokens, ['start', 'starting', 'origin', 'end', 'endpoint', 'destination', 'finish']);

  return /\b(?:delete|remove)\s+(?:this\s+|the\s+|my\s+)?(?:trip|draft|route)\b|\bstart over by deleting\b|\bdelete it\b/.test(normalized) ||
    (hasDeleteKeyword && hasTripTarget && !hasEndpointTarget);
}

function isAmbiguousRouteClearCommand(normalized: string): boolean {
  const tokens = getScopeAiKeywordTokens(normalized);
  const hasRouteTarget = hasAnyScopeAiKeyword(tokens, ['route', 'itinerary', 'planner', 'trip']);
  const hasEndpointTarget = hasAnyScopeAiKeyword(tokens, ['start', 'starting', 'origin', 'end', 'endpoint', 'destination', 'finish']);
  const hasMapTarget = hasAnyScopeAiKeyword(tokens, ['map', 'mapbox']);
  const hasClearResetKeyword = hasAnyScopeAiKeyword(tokens, ['clear', 'reset', 'remove', 'wipe']);
  const hasExplicitTripDelete = hasAnyScopeAiKeyword(tokens, ['delete', 'discard']);

  return hasClearResetKeyword &&
    hasRouteTarget &&
    !hasEndpointTarget &&
    !hasMapTarget &&
    !hasExplicitTripDelete;
}

function cleanupMapTargetQuery(value: string | null | undefined): string | null {
  const cleaned = cleanupTripDocumentValue(value)
    ?.replace(/\b(?:on|in|for)\s+(?:the\s+)?map\b/gi, ' ')
    .replace(/\b(?:map\s+view|mapbox|planner\s+map)\b/gi, ' ')
    .replace(/^(?:the\s+)?map\s+/gi, ' ')
    .replace(/\s+(?:(?:on|in|for)\s+)?(?:the\s+)?map$/gi, ' ')
    .replace(/\b(?:please|pls|for me|a little|a bit|some)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || /^(?:it|this|that|the map|map|dark|light|bright|reset|recenter|home|route|fit route|locate me|my location)(?:\s+mode)?$/i.test(cleaned)) {
    return null;
  }

  return cleaned.length >= 2 ? cleaned : null;
}

function isBareGlobalMapFocusQuery(value: string): boolean {
  return /\b(?:country|japan|australia|canada|mexico|france|spain|italy|germany|india|brazil|united kingdom|uk|england|tokyo|paris|london|sydney|melbourne|toronto|vancouver|mexico city|rome|madrid|barcelona|berlin|seoul|bangkok|dubai|delhi|mumbai|singapore|amsterdam|dublin|lisbon)\b/i.test(value);
}

function extractMapFocusQuery(normalized: string): string | null {
  const patterns = [
    /\bzoom(?:ing)?\s+in\s+(?!a\s+(?:little|bit)\b|(?:little|bit|some)\b)(?:on\s+|to\s+|into\s+|the\s+)?(.+)$/i,
    /\bzoom(?:ing)?\s+(?:in\s+)?(?:to|into|on|around|near)\s+(?:the\s+)?(.+)$/i,
    /\bzoom(?:ing)?\s+(?!in\b|out\b|a\s+(?:little|bit)\b|(?:little|bit|some|closer|farther|further)\b)(.+)$/i,
    /\b(?:map|mapbox|planner\s+map)\s+(.+?)\s+(?:zoom(?:ing)?|center|centre|focus|fly|pan|move)(?:\s+in)?$/i,
    /\b(.+?)\s+(?:on\s+|in\s+|for\s+)?(?:the\s+)?(?:map|mapbox|planner\s+map)\s+(?:zoom(?:ing)?|center|centre|focus|fly|pan|move)(?:\s+in)?$/i,
    /\b(?:center|centre|focus|fly|pan|move|take me|go)\s+(?:the\s+)?map\s+(?:to|on|around|near)\s+(.+)$/i,
    /\b(?:center|centre|focus|fly|pan|move|take me|go)\s+(?:to|on|around|near)\s+(.+?)\s+(?:on|in|for)\s+(?:the\s+)?map$/i,
    /\b(?:show|open)\s+(.+?)\s+(?:on|in|for)\s+(?:the\s+)?map$/i,
    /\b(?:on|in|for)\s+(?:the\s+)?map\s+(?:show|open|center|centre|focus|fly|pan|move|go|zoom(?:\s+in)?(?:\s+to|\s+into)?)\s+(.+)$/i,
    /\b(?:map|mapbox|planner\s+map)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const query = cleanupMapTargetQuery(normalized.match(pattern)?.[1]);
    if (query) {
      return query;
    }
  }

  const bareGlobalQuery = cleanupMapTargetQuery(normalized.match(/^\s*(?:show|open|view|see)\s+(.+)$/i)?.[1]);
  if (bareGlobalQuery && isBareGlobalMapFocusQuery(bareGlobalQuery)) {
    return bareGlobalQuery;
  }

  return null;
}

function extractMapCommand(normalized: string): ExtractedMapCommand | null {
  const tokens = getScopeAiKeywordTokens(normalized);
  const hasMapKeyword = hasAnyScopeAiKeyword(tokens, ['map', 'mapbox']);

  if (/\b(?:make|set|switch|change|turn|toggle)\s+(?:the\s+)?map\s+(?:to\s+)?(?:light|bright)(?:\s+mode)?\b|\b(?:light|bright)\s+map\b|\b(?:on|in|for)\s+(?:the\s+)?map\b.{0,36}\b(?:make|set|switch|change|turn|toggle)\s+(?:it\s+|the\s+map\s+)?(?:to\s+)?(?:light|bright)(?:\s+mode)?\b|\b(?:make|set|switch|change|turn|toggle)\s+(?:it\s+)?(?:to\s+)?(?:light|bright)(?:\s+mode)?\s+(?:on|in|for)\s+(?:the\s+)?map\b/.test(normalized)) {
    return { command: 'map_style_light' };
  }
  if (/\b(?:make|set|switch|change|turn|toggle)\s+(?:the\s+)?map\s+(?:to\s+)?dark(?:\s+mode)?\b|\bdark\s+map\b|\b(?:on|in|for)\s+(?:the\s+)?map\b.{0,36}\b(?:make|set|switch|change|turn|toggle)\s+(?:it\s+|the\s+map\s+)?(?:to\s+)?dark(?:\s+mode)?\b|\b(?:make|set|switch|change|turn|toggle)\s+(?:it\s+)?(?:to\s+)?dark(?:\s+mode)?\s+(?:on|in|for)\s+(?:the\s+)?map\b/.test(normalized)) {
    return { command: 'map_style_dark' };
  }
  if (hasMapKeyword && hasAnyScopeAiKeyword(tokens, ['light', 'bright'])) {
    return { command: 'map_style_light' };
  }
  if (hasMapKeyword && hasAnyScopeAiKeyword(tokens, ['dark'])) {
    return { command: 'map_style_dark' };
  }

  const hasNearbyDiscoveryContext = hasAnyScopeAiKeyword(tokens, [
    'nearby',
    'near',
    'around',
    'food',
    'restaurant',
    'coffee',
    'entertainment',
    'bowling',
    'arcade',
    'restroom',
    'bathroom',
    'shopping',
    'nightlife',
    'scenic',
    'outdoors',
    'park',
    'stop',
    'stops',
    'place',
    'places',
    'spot',
    'spots',
    'fuel',
    'gas',
  ]);
  if (
    !hasNearbyDiscoveryContext &&
    (
      /\b(?:zoom|center|centre|focus|show|view|open|frame|fit)\b[\s\S]{0,40}\b(?:whole\s+|full\s+)?route\b/.test(normalized) ||
      (hasMapKeyword && /\b(?:whole\s+|full\s+)?route\b[\s\S]{0,40}\b(?:zoom|center|centre|focus|show|view|open|frame|fit)\b/.test(normalized)) ||
      (hasMapKeyword && hasAnyScopeAiKeyword(tokens, ['route']) && hasAnyScopeAiKeyword(tokens, ['zoom', 'center', 'centre', 'focus', 'show', 'view', 'open', 'frame', 'fit']))
    )
  ) {
    return { command: 'fit_route' };
  }

  const focusQuery = extractMapFocusQuery(normalized);
  if (focusQuery) {
    return { command: 'zoom_to_place', query: focusQuery };
  }

  if (/\b(?:zoom(?:ing)? in|map in|closer)\b/.test(normalized) || (hasAnyScopeAiKeyword(tokens, ['zoom', 'zooming']) && hasAnyScopeAiKeyword(tokens, ['in', 'closer']))) {
    return { command: 'zoom_in' };
  }
  if (/\b(?:zoom out|map out|farther|further out)\b/.test(normalized) || (hasAnyScopeAiKeyword(tokens, ['zoom']) && hasAnyScopeAiKeyword(tokens, ['out', 'farther', 'further']))) {
    return { command: 'zoom_out' };
  }
  if (/\b(?:reset|recenter|restore)\s+(?:the\s+)?map\b|\bmap\s+reset\b/.test(normalized) || (hasMapKeyword && hasAnyScopeAiKeyword(tokens, ['reset', 'recenter', 'restore', 'home']))) {
    return { command: 'reset_map' };
  }
  if (/\b(?:fit|show|frame)\s+(?:the\s+)?(?:route|whole route|full route)\b|\bfit route\b/.test(normalized) || (hasAnyScopeAiKeyword(tokens, ['route']) && hasAnyScopeAiKeyword(tokens, ['fit', 'frame', 'whole', 'full']))) {
    return { command: 'fit_route' };
  }
  if (/\b(?:locate me|find me|center on me|centre on me|my location|show my location)\b/.test(normalized) || (hasAnyScopeAiKeyword(tokens, ['locate', 'location']) && hasAnyScopeAiKeyword(tokens, ['me', 'my', 'user']))) {
    return { command: 'locate_user' };
  }

  return null;
}

function isRouteBuildCommand(normalized: string, tokens: Set<string>): boolean {
  return (
    /\b(build|generate|make|create)\b.*\b(route|itinerary|plan|draft)\b/.test(normalized) ||
    (hasAnyScopeAiKeyword(tokens, ['build', 'generate', 'create', 'make']) &&
      hasAnyScopeAiKeyword(tokens, ['route', 'itinerary', 'plan', 'draft']))
  );
}

function isRouteTightenCommand(normalized: string, tokens: Set<string>): boolean {
  return (
    /\b(tighten|remove filler|clean up|simplify|rebalance|trim)\b/.test(normalized) ||
    hasAnyScopeAiKeyword(tokens, ['tighten', 'simplify', 'rebalance', 'trim'])
  );
}

function isRouteStatusCommand(normalized: string, tokens: Set<string>): boolean {
  return (
    /\bstatus\b|\bwhat.*next\b|\bwhere.*at\b/.test(normalized) ||
    (hasAnyScopeAiKeyword(tokens, ['route', 'trip', 'planner']) &&
      hasAnyScopeAiKeyword(tokens, ['status', 'state', 'current', 'next']))
  );
}

function parseScopeAiPlannerCommand(original: string): ParsedScopeCommand {
  const normalizedMessage = normalizeNoisyScopeAiPrompt(original);
  const normalized = normalizedMessage.toLowerCase();
  const lexicalTokens = lexScopeAiCommandText(normalizedMessage);
  const tokens = mergeScopeAiLexicalKeywordTokens(getScopeAiKeywordTokens(normalized), lexicalTokens);
  const base = {
    original,
    normalizedMessage,
    normalized,
    tokens,
    lexicalTokens,
  };

  // Safety first: confirmation is a tiny grammar, not a fuzzy "delete-ish" guess.
  if (isDeleteTripConfirmation(normalized)) {
    return {
      ...base,
      intent: 'delete_confirmation',
      safety: 'safe',
    };
  }

  const mapCommand = extractMapCommand(normalized);
  if (mapCommand) {
    return {
      ...base,
      intent: 'map_command',
      safety: 'safe',
      mapCommand,
    };
  }

  if (isSaveTripCommand(normalized)) {
    return {
      ...base,
      intent: 'save_trip',
      safety: 'safe',
    };
  }

  if (isAmbiguousRouteClearCommand(normalized)) {
    return {
      ...base,
      intent: 'ambiguous_route_clear',
      safety: 'missing_entity',
    };
  }

  if (isDeleteTripRequest(normalized)) {
    return {
      ...base,
      intent: 'delete_request',
      safety: 'confirm_required',
    };
  }

  const invite = extractInviteRecipient(normalizedMessage);
  if (invite) {
    return {
      ...base,
      intent: 'invite_member',
      safety: 'safe',
      invite,
    };
  }

  if (/\b(?:invite|add|share with|send to)\b/.test(normalized) && /\b(?:friend|member|traveler|person|someone|user)\b/.test(normalized)) {
    return {
      ...base,
      intent: 'invite_missing_recipient',
      safety: 'missing_entity',
    };
  }

  if (isOpenShareCommand(normalized)) {
    return {
      ...base,
      intent: 'open_share',
      safety: 'safe',
    };
  }

  const visibility = extractTripVisibilityCommand(normalized);
  if (visibility !== null) {
    return {
      ...base,
      intent: 'visibility',
      safety: 'safe',
      visibility,
    };
  }

  const title = extractTripTitleCommand(normalizedMessage);
  if (title) {
    return {
      ...base,
      intent: 'rename_trip',
      safety: 'safe',
      title,
    };
  }

  const clearEndpoint = extractClearEndpointField(normalizedMessage);
  if (clearEndpoint) {
    return {
      ...base,
      intent: 'clear_endpoint',
      safety: 'safe',
      clearEndpoint,
    };
  }

  if (isNearbyPlacesCommand(normalized)) {
    return {
      ...base,
      intent: 'nearby_places',
      safety: 'safe',
    };
  }

  if (isRouteBuildCommand(normalized, tokens) || isRouteTightenCommand(normalized, tokens)) {
    return {
      ...base,
      intent: 'route_build',
      safety: 'safe',
    };
  }

  if (isRouteStatusCommand(normalized, tokens)) {
    return {
      ...base,
      intent: 'route_status',
      safety: 'safe',
    };
  }

  return {
    ...base,
    intent: 'none',
    safety: 'safe',
  };
}

function isEndpointCorrectionCommand(message: string): boolean {
  return /\b(?:change|replace|correct|update|switch)\s+(?:the\s+)?(?:start|starting|end|finish|destination|final destination)\b/i.test(message);
}

function isStartCorrectionCommand(message: string): boolean {
  return /\b(?:change|replace|correct|update|switch)\s+(?:the\s+)?start(?:ing)?\b/i.test(message);
}

function isEndCorrectionCommand(message: string): boolean {
  return /\b(?:change|replace|correct|update|switch)\s+(?:the\s+)?(?:end|finish|destination|final destination)\b/i.test(message);
}

function formatRouteLabel(plannerState: LocalPlannerState): string {
  const start = plannerState.start?.trim();
  const end = plannerState.end?.trim();
  if (start && end) {
    return `${start} to ${end}`;
  }

  if (start) {
    return `${start} to final destination not set`;
  }

  if (end) {
    return `start not set to ${end}`;
  }

  return 'no endpoints selected yet';
}

function buildStateAwareNextMove(plannerState: LocalPlannerState): { text: string; chips: string[] } {
  const start = plannerState.start?.trim();
  const end = plannerState.end?.trim();
  const stopCount = Array.isArray(plannerState.stops) ? plannerState.stops.length : 0;
  const pace = plannerState.pace === 'standard' ? 'moderate' : plannerState.pace ?? 'relaxed';
  const budget = plannerState.budget_max ? `up to ${formatMoney(plannerState.budget_max)}` : 'not locked yet';
  const dates = plannerState.start_date || plannerState.end_date
    ? `${plannerState.start_date ?? 'start date not set'} to ${plannerState.end_date ?? 'end date not set'}`
    : 'dates not locked yet';

  if (start && !end) {
    return {
      text: `I already have the start as ${start}. I will not ask for it again. Next, choose an endpoint from that start, add midpoint stops, or set dates/budget before building. Current brief: ${dates}, ${budget}, ${pace} pace, ${stopCount} stop${stopCount === 1 ? '' : 's'}.`,
      chips: ['Find practical endpoints', 'Find scenic endpoints', 'Set end date'],
    };
  }

  if (!start && end) {
    return {
      text: `I already have the final destination as ${end}. Next, add a start place or ask me to suggest one that fits the trip. Current brief: ${dates}, ${budget}, ${pace} pace, ${stopCount} stop${stopCount === 1 ? '' : 's'}.`,
      chips: ['Add a start place', 'Help me choose a start point', 'Check route status'],
    };
  }

  if (start && end) {
    return {
      text: `I have the route from ${start} to ${end} with ${stopCount} stop${stopCount === 1 ? '' : 's'}, ${dates}, ${budget}, and ${pace} pace. Next, I can build the itinerary, tighten stops, check timing/weather, or find fuel and nearby places from the mapped route.`,
      chips: ['Build the itinerary', 'Tighten this route', 'Find fuel nearby'],
    };
  }

  return {
    text: `I do not have route endpoints yet. Add a start, a final destination, or ask me to help choose one; then I can recommend stops, check weather/fuel, and build the itinerary.`,
    chips: ['Add a start place', 'Add an end place', 'Help me choose an endpoint'],
  };
}

function extractRadiusKm(message: string): number | null {
  const match = message.match(/\b(?:within|inside|radius|nearby|around)?\s*(\d{1,3})\s*(mi|mile|miles|km|kilometer|kilometers)\b/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unit = match[2]?.toLowerCase() ?? 'km';
  const km = unit.startsWith('mi') ? amount * 1.60934 : amount;
  return Math.max(1, Math.min(Math.round(km), 80));
}

function extractNearbyCategory(normalized: string): string | null {
  if (/\bfood|restaurant|brunch|lunch|dinner|breakfast|eat\b/.test(normalized)) {
    return 'food';
  }

  if (/\bcoffee|cafe\b/.test(normalized)) {
    return 'coffee';
  }

  if (/\b(restrooms?|bathrooms?)\b/.test(normalized)) {
    return 'restrooms';
  }

  if (/\bshopping|shop|market\b/.test(normalized)) {
    return 'shopping';
  }

  if (/\b(entertainment|amusement|theme\s*park|six\s*flags|bowling|arcade|movie|cinema|concert|zoo|aquarium|stadium|arena|escape\s*room|mini\s*golf|laser\s*tag)\b/.test(normalized)) {
    return 'entertainment';
  }

  if (/\bnightlife|bar|club|music\b/.test(normalized)) {
    return 'nightlife';
  }

  if (/\bscenic|view|overlook|photo\b/.test(normalized)) {
    return 'scenic';
  }

  if (/\b(outdoors?|outdoor\s+activities|parks?|nature|trails?|hikes?)\b/.test(normalized)) {
    return 'outdoors';
  }

  return null;
}

function isNearbyPlacesCommand(normalized: string): boolean {
  const tokens = getScopeAiKeywordTokens(normalized);
  const hasLookupKeyword = hasAnyScopeAiKeyword(tokens, ['find', 'show', 'search', 'research', 'recommend', 'suggest', 'pick', 'choose', 'what', 'where', 'nearby', 'good', 'best']);
  const hasPlaceKeyword = hasAnyScopeAiKeyword(tokens, [
    'nearby',
    'near',
    'around',
    'route',
    'stop',
    'stops',
    'place',
    'places',
    'spot',
    'spots',
    'food',
    'restaurant',
    'coffee',
    'entertainment',
    'bowling',
    'arcade',
    'restroom',
    'bathroom',
    'shopping',
    'nightlife',
    'scenic',
    'outdoors',
    'park',
  ]);

  return (
    /\b(what'?s nearby|best places? around|good places? around|what'?s good around|find .* near|research .* near|nearby places|coffee spots|bowling spots|entertainment spots|find restrooms?|midpoint stop|halfway stop|on the way|nearby stops?|stops nearby)\b/.test(normalized) ||
    /\b(?:find|show|search|recommend|suggest|pick)\b[\s\S]{0,60}\b(?:verified\s+|provider-backed\s+|good\s+|best\s+)?(?:stops?|places?|spots?)\b/.test(normalized) ||
    (hasLookupKeyword && hasPlaceKeyword && !hasAnyScopeAiKeyword(tokens, ['gas', 'fuel', 'diesel', 'charging', 'weather', 'forecast']))
  );
}

function cleanupLocationRecommendationQuery(value: string | null | undefined): string | null {
  const cleaned = cleanupTripDocumentValue(value)
    ?.replace(/^(?:me|here|my location|current location)\s+(?:around|near|in)\s+/i, ' ')
    ?.replace(/\b(?:this|next|coming)?\s*(?:weekend|morning|afternoon|evening|tonight|today|tomorrow)\b/gi, ' ')
    .replace(/\b(?:for|with)\s+(?:kids?|children|family|families|teens?|teenagers?|couples?|friends?|solo|dogs?|pets?|date\s+night)\b.*$/gi, ' ')
    .replace(/\b(?:for|on)\s+(?:the\s+)?(?:weekend|morning|afternoon|evening|night|today|tomorrow)\b/gi, ' ')
    .replace(/\b(?:on|for)\s+(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi, ' ')
    .replace(/\b(?:please|pls|thanks|thank you)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return null;
  }

  if (/^(?:here|near me|me|my location|current location|route|the route|this route|start|the start|origin|destination|the destination|end|the end|nearby|around|in)$/i.test(cleaned)) {
    return null;
  }

  if (/^(?:food|restaurants?|coffee|nightlife|parks?|places?|spots?|things?|activities)$/i.test(cleaned)) {
    return null;
  }

  if (
    /\b(?:pick|choose|find|show|recommend|suggest)\b/i.test(cleaned) ||
    /\bstart\s+city\b/i.test(cleaned) ||
    /\bcity\s+for\b/i.test(cleaned) ||
    /\bfor\s+(?:a|an|the)\b/i.test(cleaned)
  ) {
    return null;
  }

  if (/\b(?:the\s+route|this\s+route|route|stops?|nearby|trip|vibe|vibes|theme|interests?)\b/i.test(cleaned)) {
    return null;
  }

  const cleanedTokens = cleaned.toLowerCase().match(/[a-z][a-z']*/g) ?? [];
  const nonLocationTokens = new Set([
    ...THEME_TERMS,
    'activity',
    'activities',
    'bar',
    'bars',
    'brunch',
    'coffee',
    'food',
    'museum',
    'museums',
    'outdoor',
    'outdoors',
    'park',
    'parks',
    'place',
    'places',
    'restaurant',
    'restaurants',
    'shop',
    'shopping',
    'shops',
    'spot',
    'spots',
    'trail',
    'trails',
    'view',
    'views',
  ]);
  if (cleanedTokens.length > 0 && cleanedTokens.every((token) => nonLocationTokens.has(token))) {
    return null;
  }

  return cleaned.length >= 2 ? cleaned : null;
}

export function extractExplicitLocationRecommendationQuery(message: string): string | null {
  const normalizedMessage = normalizeNoisyScopeAiPrompt(message);

  if (
    /\b(?:set|change|replace|correct|clear|delete|remove|rename|budget|mpg|invite|share|save|publish|private|public)\b/i.test(normalizedMessage) ||
    isEndpointCorrectionCommand(normalizedMessage)
  ) {
    return null;
  }

  const patterns = [
    /\b(?:what(?:'s|\s+is)?|what\s+should\s+(?:i|we)|what\s+can\s+(?:i|we)|what\s+to\s+do|things?\s+to\s+do|where\s+should\s+(?:i|we)\s+(?:go|eat)|recommend|suggest|show|find|best|good|fun)\b[\s\S]{0,90}\b(?:around|near|in)\s+(.+)$/i,
    /\b(?:nightlife|bars?|pubs?|clubs?|lounges?|cocktails?|live music|music venues?|restaurants?|brunch|food|coffee|shopping|shops?|markets?|scenic\s+(?:views?|spots?)|views?|outdoor\s+activities|outdoors?|parks?|trails?|hikes?|entertainment|bowling|arcade|movies?|cinemas?|concerts?|museums?|activities|things?\s+to\s+do)\b[\s\S]{0,60}\b(?:around|near|in)\s+(.+)$/i,
    /^([a-z][\w\s.,'-]{1,80})\s+(?:fun\s+things(?:\s+to\s+do)?|cool\s+things(?:\s+to\s+do)?)\b/i,
    /^([a-z][\w\s.,'-]{1,80})\s+scenic\s+(?:views?|spots?)\b/i,
    /\b(?:what\s+to\s+do|fun\s+things(?:\s+to\s+do)?|cool\s+things(?:\s+to\s+do)?|things?\s+to\s+do|activities|best\s+(?:restaurants?|brunch)|good\s+restaurants?|restaurants?|brunch|food|coffee|shopping|shops?|markets?|scenic\s+(?:views?|spots?)|views?|outdoor\s+activities|outdoors?|parks?|trails?|hikes?|entertainment|bowling|arcade|movies?|cinemas?|concerts?|nightlife|bars?|pubs?|clubs?|lounges?|cocktails?|live music|music venues?|museums?|where\s+should\s+(?:i|we)\s+eat)\s+([a-z][\w\s.,'-]{1,80})$/i,
    /^([a-z][\w\s.,'-]{1,80})\s+(?:things?\s+to\s+do|activities|restaurants?|brunch|food|coffee|shopping|shops?|markets?|scenic\s+(?:views?|spots?)|views?|outdoor\s+activities|outdoors?|parks?|trails?|hikes?|entertainment|bowling|arcade|movies?|cinemas?|concerts?|nightlife|bars?|pubs?|clubs?|museums?)\b/i,
    /\b(?:around|near|in)\s+([a-z][\w\s.,'-]{1,80})\b[\s\S]{0,40}\b(?:what\s+should|what\s+can|things?\s+to\s+do|recommend|suggest|find|show)\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedMessage.match(pattern);
    const location = cleanupLocationRecommendationQuery(match?.[1]);
    if (location) {
      return location;
    }
  }

  return null;
}

function buildLocationRecommendationFallback(location: string, normalized: string): ScopeAiChatResponse {
  const category = extractNearbyCategory(normalized);
  const isDallas = /\bdallas\b/i.test(location);
  const categoryLead = category
    ? `For ${category} specifically, use ${location} as the anchor and cluster picks by neighborhood so the plan does not turn into backtracking.`
    : `Use ${location} as the anchor, then build the day around one walkable area, one outdoor or cultural reset, one food stop, and one evening option.`;
  const dallasCategorySuggestions: Partial<Record<string, string>> = {
    nightlife: 'For Dallas nightlife, start with Deep Ellum for live music and late-night energy, compare Bishop Arts for calmer cocktail bars, and use Lower Greenville or the Design District when you want dinner close to the evening stop.',
    food: 'For Dallas food, cluster the plan around Bishop Arts, Trinity Groves, or Lower Greenville so dinner, dessert, and a short walkable reset stay close together.',
    entertainment: 'For Dallas entertainment, compare the Arts District, Deep Ellum, and Victory Park by event time first, then pick dinner nearby so the night does not turn into cross-town backtracking.',
    scenic: 'For Dallas scenic time, pair Klyde Warren Park or the Arts District with White Rock Lake when you want an outdoor reset before dinner.',
    outdoors: 'For Dallas outdoor time, use White Rock Lake, Klyde Warren Park, or the Trinity overlook areas as the anchor, then keep food nearby instead of crossing the city twice.',
    shopping: 'For Dallas shopping, Bishop Arts and Knox-Henderson work better as walkable clusters, while NorthPark is stronger when you want one indoor anchor.',
  };
  const suggestions = isDallas
    ? dallasCategorySuggestions[category ?? ''] ?? 'For Dallas, a strong weekend shape is Klyde Warren Park and the Arts District for a daytime loop, Bishop Arts for food and small shops, Deep Ellum for live music or nightlife, White Rock Lake for an outdoor reset, and Trinity Groves or the Design District for dinner.'
    : `${categoryLead} I would ask the live planner for current hours, events, and distance-ranked places before locking the route.`;
  const liveNote = 'I cannot verify current hours, events, or provider rankings without the Scope AI backend, so treat this as a planning starter instead of live availability.';

  return textResponse(
    `${suggestions} ${liveNote}`,
    [`Use ${location} as start`, category ? `Find ${category} near ${location}` : `Find food near ${location}`, `Build ${location} weekend`],
  );
}

function extractFuelTypeFromPrompt(normalized: string): 'regular' | 'midgrade' | 'premium' | 'diesel' | 'ev' | null {
  return normalized.includes('diesel')
    ? 'diesel'
    : /\b(ev|electric car)\b/.test(normalized)
      ? 'ev'
      : normalized.includes('premium')
        ? 'premium'
        : normalized.includes('midgrade')
          ? 'midgrade'
          : normalized.includes('regular gas')
            ? 'regular'
            : null;
}

function getPackingSuggestions(plannerState: LocalPlannerState): string[] {
  const suggestions = new Set([
    'Driver license and registration',
    'Phone chargers and cables',
    'Water and road snacks',
    'First aid kit',
    'Sunglasses',
    'Emergency roadside kit',
  ]);

  if (plannerState.theme?.some((theme) => /nature|scenic|adventure/i.test(theme))) {
    suggestions.add('Comfortable walking shoes');
    suggestions.add('Sunscreen');
  }

  if (plannerState.fuel_type === 'ev') {
    suggestions.add('Charging adapter');
  }

  if (plannerState.pace === 'packed') {
    suggestions.add('Portable battery pack');
  }

  return [...suggestions].slice(0, 8);
}

function splitMixedIntentClauses(message: string): string[] {
  return message
    .split(/\s+(?:and|also|then|plus)\s+|[;]+/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length >= 2);
}

function addParsedPlannerCommandAction(
  parsedCommand: ParsedScopeCommand,
  actions: object[],
  confirmations: string[],
): boolean {
  const pushConfirmation = (value: string) => {
    if (!confirmations.includes(value)) {
      confirmations.push(value);
    }
  };

  if (parsedCommand.intent === 'map_command' && parsedCommand.mapCommand) {
    addUniqueAction(actions, parsedCommand.mapCommand.query
      ? { type: 'SET_MAP_COMMAND', command: parsedCommand.mapCommand.command, query: parsedCommand.mapCommand.query }
      : { type: 'SET_MAP_COMMAND', command: parsedCommand.mapCommand.command });
    pushConfirmation('map command');
    return true;
  }

  if (parsedCommand.intent === 'save_trip') {
    addUniqueAction(actions, { type: 'SAVE_TRIP_DRAFT' });
    pushConfirmation('draft save');
    return true;
  }

  if (parsedCommand.intent === 'invite_member' && parsedCommand.invite) {
    addUniqueAction(actions, {
      type: 'INVITE_TRIP_MEMBER',
      recipient: parsedCommand.invite.recipient,
      role: parsedCommand.invite.role,
    });
    pushConfirmation('member invite');
    return true;
  }

  if (parsedCommand.intent === 'open_share') {
    addUniqueAction(actions, { type: 'OPEN_SHARE_MODAL' });
    pushConfirmation('sharing');
    return true;
  }

  if (parsedCommand.intent === 'visibility' && parsedCommand.visibility !== undefined) {
    addUniqueAction(actions, { type: 'SET_TRIP_VISIBILITY', is_public: parsedCommand.visibility });
    pushConfirmation(parsedCommand.visibility ? 'public visibility' : 'private visibility');
    return true;
  }

  if (parsedCommand.intent === 'rename_trip' && parsedCommand.title) {
    addUniqueAction(actions, { type: 'SET_FIELD', field: 'title', value: parsedCommand.title });
    pushConfirmation('trip title');
    return true;
  }

  if (parsedCommand.intent === 'clear_endpoint' && parsedCommand.clearEndpoint) {
    addUniqueAction(actions, { type: 'CLEAR_FIELD', field: parsedCommand.clearEndpoint });
    pushConfirmation(parsedCommand.clearEndpoint === 'start' ? 'start removal' : 'destination removal');
    return true;
  }

  if (parsedCommand.intent === 'nearby_places') {
    const nearbyCategory = extractNearbyCategory(parsedCommand.normalized);
    addUniqueAction(actions, { type: 'SEARCH_NEARBY_PLACES', ...(nearbyCategory ? { category: nearbyCategory } : {}), radius_km: 10, limit: 6 });
    pushConfirmation('nearby places');
    return true;
  }

  return false;
}

function buildMixedIntentResponse(message: string, normalized: string, plannerState: LocalPlannerState): ScopeAiChatResponse | null {
  if (!/\b(and|also|then|plus)\b|;/.test(normalized)) {
    return null;
  }

  const actions: object[] = [];
  const confirmations: string[] = [];
  const clauses = splitMixedIntentClauses(message).slice(0, 5);

  for (const clause of clauses) {
    const clauseNormalized = clause.toLowerCase();
    const parsedClauseCommand = parseScopeAiPlannerCommand(clause);

    if (parsedClauseCommand.intent === 'delete_confirmation' || parsedClauseCommand.intent === 'delete_request') {
      return textResponse(
        'For safety, send delete requests by themselves. I did not delete or change the draft from that mixed command.',
        ['Confirm delete', 'Cancel delete', 'Check route status'],
      );
    }

    const dateCommand = extractDateCommand(clause, plannerState);
    for (const action of extractActionsFromLocalResponse(dateCommand)) {
      addUniqueAction(actions, action);
    }
    if (dateCommand && !confirmations.includes('dates')) {
      confirmations.push('dates');
    }

    if (hasNegativeBudgetAmount(clause)) {
      confirmations.push('budget unchanged because it needs a positive number');
      continue;
    }

    const budgetRange = extractBudgetRange(clause);
    if (budgetRange) {
      addUniqueAction(actions, { type: 'SET_FIELD', field: 'budget_min', value: budgetRange[0] });
      addUniqueAction(actions, { type: 'SET_FIELD', field: 'budget_max', value: budgetRange[1] });
      confirmations.push('budget range');
      continue;
    }

    const singleBudget = extractSingleBudget(clause);
    if (singleBudget !== null) {
      for (const action of buildSingleBudgetActions(singleBudget, plannerState, {
        exact: isExactSingleBudgetCommand(clause),
      })) {
        addUniqueAction(actions, action);
      }
      confirmations.push(isExactSingleBudgetCommand(clause) ? 'budget' : 'max budget');
    }

    const travelers = isDatePrompt(clause) ? null : extractPartySize(clauseNormalized);
    if (travelers !== null) {
      addUniqueAction(actions, { type: 'SET_FIELD', field: 'party_size', value: travelers });
      confirmations.push('travelers');
    }

    const fuelType = extractFuelTypeFromPrompt(clauseNormalized);
    if (fuelType) {
      addUniqueAction(actions, { type: 'SET_FIELD', field: 'fuel_type', value: fuelType });
      confirmations.push('fuel type');
    }

    if (/\b(find|search|show|nearest|closest|cheap|cheapest|best price)\b[\s\S]{0,60}\b(gas|fuel|diesel|charging|ev chargers?)\b/.test(clauseNormalized)) {
      const radiusKm = extractRadiusKm(clause) ?? 10;
      addUniqueAction(actions, {
        type: 'SEARCH_NEARBY_FUEL',
        sort_by: /\b(cheap|cheapest|best price|low(?:est)? price)\b/.test(clauseNormalized) ? 'best_price' : 'closest',
        radius_km: radiusKm,
        limit: 5,
      });
      confirmations.push('fuel lookup');
    }

    if (addParsedPlannerCommandAction(parsedClauseCommand, actions, confirmations)) {
      continue;
    }

    if (parsedClauseCommand.intent === 'ambiguous_route_clear' && !confirmations.includes('ambiguous route clear left unchanged')) {
      confirmations.push('ambiguous route clear left unchanged');
      continue;
    }

    const start = !isDatePrompt(clause) && /\bstart|starting\b/i.test(clause) ? extractEndpointCommand(clause, 'start') : null;
    if (start) {
      addUniqueAction(actions, { type: 'SET_FIELD', field: 'start', value: start });
      confirmations.push('start place');
    }

    const end = !isDatePrompt(clause) && /\b(end|destination|final destination|finish)\b/i.test(clause) ? extractEndpointCommand(clause, 'end') : null;
    if (end) {
      addUniqueAction(actions, { type: 'SET_FIELD', field: 'end', value: end });
      confirmations.push('final destination');
    }
  }

  if (!actions.length) {
    return null;
  }

  return actionResponse(
    actions,
    `I understood multiple planner updates and applied the verified ones: ${[...new Set(confirmations)].join(', ')}. I left any unclear extra wording unchanged so I do not guess.`,
    ['Check route status', 'Find verified stops', 'Build the itinerary'],
  );
}

const MAP_COMMAND_CONFIRMATIONS: Partial<Record<string, string>> = {
  zoom_in: 'Zooming the planner map in.',
  zoom_out: 'Zooming the planner map out.',
  reset_map: 'Resetting the planner map view.',
  fit_route: 'Fitting the planner map to the route.',
  locate_user: 'Centering the planner map on your location if the browser allows it.',
  map_style_light: 'Switching only the planner map to bright mode.',
  map_style_dark: 'Switching only the planner map to dark mode.',
};

function buildMapCommandResponse(mapCommand: ExtractedMapCommand): ScopeAiChatResponse {
  const action = mapCommand.query
    ? { type: 'SET_MAP_COMMAND', command: mapCommand.command, query: mapCommand.query }
    : { type: 'SET_MAP_COMMAND', command: mapCommand.command };
  const confirmation = mapCommand.command === 'zoom_to_place'
    ? `Zooming the planner map to ${mapCommand.query ?? 'that place'}.`
    : MAP_COMMAND_CONFIRMATIONS[mapCommand.command] ?? 'Updating the planner map.';

  return actionResponse(
    [action],
    confirmation,
    ['Check route status', 'Find verified stops', 'Build the itinerary'],
  );
}

function buildParsedScopeCommandResponse(scopeCommand: ParsedScopeCommand): ScopeAiChatResponse | null {
  if (scopeCommand.intent === 'delete_confirmation') {
    return actionResponse(
      [{ type: 'DELETE_TRIP_DRAFT' }],
      'Confirmed delete request.',
      ['Start a new route', 'Open trips', 'Cancel delete'],
    );
  }

  const mapCommand = scopeCommand.intent === 'map_command' ? scopeCommand.mapCommand : null;
  if (mapCommand) {
    return buildMapCommandResponse(mapCommand);
  }

  if (scopeCommand.intent === 'save_trip') {
    return actionResponse(
      [{ type: 'SAVE_TRIP_DRAFT' }],
      'Saving this trip draft.',
      ['Share this trip', 'Make it public', 'Build the itinerary'],
    );
  }

  if (scopeCommand.intent === 'ambiguous_route_clear') {
    return textResponse(
      'I will not guess on "clear route" because it can mean clearing endpoints/stops or deleting the draft. Say "remove the start", "delete destination", or "delete this draft" and I will do the exact safe action.',
      ['Remove the start', 'Delete destination', 'Delete this draft'],
    );
  }

  if (scopeCommand.intent === 'delete_request') {
    return actionResponse(
      [{ type: 'REQUEST_DELETE_TRIP_DRAFT' }],
      'I can delete this trip draft, but I need one confirmation first. Reply "confirm delete" to delete it.',
      ['Confirm delete', 'Cancel delete', 'Save this draft'],
    );
  }

  const inviteCommand = scopeCommand.intent === 'invite_member' ? scopeCommand.invite : null;
  if (inviteCommand) {
    return actionResponse(
      [{ type: 'INVITE_TRIP_MEMBER', recipient: inviteCommand.recipient, role: inviteCommand.role }],
      `Inviting ${inviteCommand.recipient} as ${inviteCommand.role === 'viewer' ? 'a viewer' : 'an editor'}.`,
      ['Open sharing', 'Make private', 'Check route status'],
    );
  }

  if (scopeCommand.intent === 'invite_missing_recipient') {
    return textResponse(
      'Tell me the registered Scope username, name, or account email to invite, like "invite @maya as viewer."',
      ['Open sharing', 'Invite @maya', 'Share this trip'],
    );
  }

  if (scopeCommand.intent === 'open_share') {
    return actionResponse(
      [{ type: 'OPEN_SHARE_MODAL' }],
      'Opening sharing for this trip draft.',
      ['Invite a member', 'Make private', 'Save this draft'],
    );
  }

  const visibility = scopeCommand.intent === 'visibility' ? scopeCommand.visibility ?? null : null;
  if (visibility !== null) {
    return actionResponse(
      [{ type: 'SET_TRIP_VISIBILITY', is_public: visibility }],
      visibility ? 'Making this trip public.' : 'Making this trip private.',
      visibility ? ['Share this trip', 'Invite a member', 'Build the itinerary'] : ['Open sharing', 'Make public', 'Check route status'],
    );
  }

  const title = scopeCommand.intent === 'rename_trip' ? scopeCommand.title : null;
  if (title) {
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'title', value: title }],
      `Renamed the trip to ${title}.`,
      ['Set dates', 'Add a start place', 'Build the route'],
    );
  }

  const parsedClearEndpointField = scopeCommand.intent === 'clear_endpoint' ? scopeCommand.clearEndpoint : null;
  if (parsedClearEndpointField) {
    return actionResponse(
      [{ type: 'CLEAR_FIELD', field: parsedClearEndpointField }],
      parsedClearEndpointField === 'start'
        ? 'Removed the start place from the planner.'
        : 'Removed the final destination from the planner.',
      parsedClearEndpointField === 'start'
        ? ['Add a start place', 'Check route status', 'Help me choose an endpoint']
        : ['Add an end place', 'Check route status', 'Find practical endpoints'],
    );
  }

  return null;
}

function buildRouteEndpointPairResponse(message: string, plannerState: LocalPlannerState): ScopeAiChatResponse | null {
  const routeEndpointPair = extractRouteEndpointPair(message);
  if (!routeEndpointPair) {
    return null;
  }

  const actions: object[] = [
    { type: 'SET_FIELD', field: 'start', value: routeEndpointPair.start },
    { type: 'SET_FIELD', field: 'end', value: routeEndpointPair.end },
  ];
  const applied = [`route endpoints to ${routeEndpointPair.start} and ${routeEndpointPair.end}`];
  const routeBudgetRange = extractBudgetRange(message);

  if (routeBudgetRange) {
    const [budgetMin, budgetMax] = routeBudgetRange;
    actions.push(
      { type: 'SET_FIELD', field: 'budget_min', value: budgetMin },
      { type: 'SET_FIELD', field: 'budget_max', value: budgetMax },
    );
    applied.push(`budget to ${formatMoney(budgetMin)} - ${formatMoney(budgetMax)}`);
  } else {
    const routeBudget = extractSingleBudget(message);
    if (routeBudget !== null) {
      const exactBudget = isExactSingleBudgetCommand(message);
      actions.push(...buildSingleBudgetActions(routeBudget, plannerState, { exact: exactBudget }));
      applied.push(exactBudget ? `budget to ${formatMoney(routeBudget)}` : `max budget to ${formatMoney(routeBudget)}`);
    }
  }

  const routePartySize = extractPartySize(message);
  if (routePartySize !== null) {
    actions.push({ type: 'SET_FIELD', field: 'party_size', value: routePartySize });
    applied.push(`travel party to ${formatTravelerCount(routePartySize)}`);
  }

  return actionResponse(
    actions,
    `Set ${applied.join(', ')}.`,
    ['Find stops nearby', 'Check the timing', 'Build the day'],
  );
}

function buildStandaloneBudgetResponse(message: string, plannerState: LocalPlannerState): ScopeAiChatResponse | null {
  const budgetRange = extractBudgetRange(message);
  if (budgetRange) {
    const [budgetMin, budgetMax] = budgetRange;
    return actionResponse(
      [
        { type: 'SET_FIELD', field: 'budget_min', value: budgetMin },
        { type: 'SET_FIELD', field: 'budget_max', value: budgetMax },
      ],
      `Set the trip budget to ${formatMoney(budgetMin)} - ${formatMoney(budgetMax)}.`,
      ['Build within this budget', 'Find free stops', 'Add endpoints'],
    );
  }

  const singleBudget = extractSingleBudget(message);
  if (singleBudget !== null) {
    const exactBudget = isExactSingleBudgetCommand(message);
    const actions = buildSingleBudgetActions(singleBudget, plannerState, { exact: exactBudget });
    const adjustedMinimum = actions.some((action) =>
      typeof action === 'object' &&
      action !== null &&
      (action as { field?: string }).field === 'budget_min',
    );

    return actionResponse(
      actions,
      exactBudget
        ? `Set the trip budget to ${formatMoney(singleBudget)}.`
        : adjustedMinimum
          ? `Set the max trip budget to ${formatMoney(singleBudget)}. Matched the minimum so the range stays valid.`
          : `Set the max trip budget to ${formatMoney(singleBudget)}.`,
      ['Keep it under budget', 'Find free stops', 'Add endpoints'],
    );
  }

  return null;
}

function buildPriorityCommandResponse(
  context: LocalScopeAiResponseContext,
): ScopeAiChatResponse | null {
  const { message, normalized, plannerState, scopeCommand } = context;
  if (/\bundo\b|\bgo back\b/.test(normalized)) {
    return actionResponse(
      [{ type: 'UNDO' }],
      'Undid the last Scope AI planner change.',
      ['Redo that change', 'Show route status', 'Build the next draft'],
    );
  }

  if (isStartCityRecommendationRequest(message)) {
    return textResponse(
      'I can help choose a strong start city, but I need one real anchor so I do not geocode trip vibes as an address. Tell me a state, region, current location, or final destination and I will suggest start candidates before anything gets set.',
      ['Tell me a state', 'Use current location', 'Add a final destination'],
    );
  }

  if (
    /\b(?:near me|around me|near here|where i am|my location|current location)\b/.test(normalized) &&
    /\b(?:what should|what can|things? to do|nearby|find|show|recommend|suggest|food|restaurants?|coffee|nightlife|bars?|weather|forecast)\b/.test(normalized)
  ) {
    return textResponse(
      'I need a real location before I can rank options near you. Share current location, add a start place, or name a city and I will use live/provider-backed context when it is available.',
      ['Use current location', 'Add a start place', 'Search near a city'],
    );
  }

  if (/\bhow\b.*\b(add|set|choose|pick)\b.*\bstart\b|\bshow me\b.*\bstart place\b/.test(normalized)) {
    return textResponse(
      'To add a start place, type it into the Start city, address, or place field, click Start on the map, or tell me "start at [place]" and I will set it for you.',
      ['Start at my location', 'Start at Dallas', 'Pick start on map'],
    );
  }

  const mixedIntentResponse = buildMixedIntentResponse(message, normalized, plannerState);
  if (mixedIntentResponse) {
    return mixedIntentResponse;
  }

  const parsedCommandResponse = buildParsedScopeCommandResponse(scopeCommand);
  if (parsedCommandResponse) {
    return parsedCommandResponse;
  }

  return null;
}

function buildDateAndPackingResponse(
  context: LocalScopeAiResponseContext,
): ScopeAiChatResponse | null {
  const { message, normalized, plannerState } = context;
  const dateCommand = extractDateCommand(message, plannerState);
  if (dateCommand) {
    return dateCommand;
  }

  if (isDatePrompt(message) && new RegExp(DATE_TOKEN_PATTERN.source, 'i').test(message)) {
    return textResponse(
      'I could not turn that into a valid trip date, so I left the planner dates unchanged.',
      ['Set start date', 'Set end date', 'Check route status'],
    );
  }

  const packingAdd = extractPlaceAfter(message, /\badd\s+(.+?)\s+(?:to|on)\s+(?:the\s+)?packing(?:\s+list)?$/i);
  if (packingAdd) {
    return actionResponse(
      [{ type: 'ADD_PACKING_ITEM', label: packingAdd }],
      `Added ${packingAdd} to the packing list.`,
      ['Add sunscreen', 'What should I pack?', 'Build the route'],
    );
  }

  const packingRemove = extractPlaceAfter(message, /\bremove\s+(.+?)\s+(?:from\s+)?(?:the\s+)?packing(?:\s+list)?$/i);
  if (packingRemove) {
    return actionResponse(
      [{ type: 'REMOVE_PACKING_ITEM', item_id: packingRemove }],
      `Removed ${packingRemove} from the packing list if it was there.`,
      ['What should I pack?', 'Add sunscreen', 'Build the route'],
    );
  }

  if (/\b(what should i pack|packing checklist|pack for|packing list|what to bring)\b/.test(normalized)) {
    const suggestions = getPackingSuggestions(plannerState);
    return textResponse(
      `For this trip, pack: ${suggestions.join(', ')}. I can also add specific items to the checklist if you say "add [item] to packing."`,
      ['Add sunscreen to packing', 'Add water to packing', 'Check weather'],
    );
  }

  return null;
}

function buildFuelAndLocationResponse(
  context: LocalScopeAiResponseContext,
): ScopeAiChatResponse | null {
  const { message, normalized, plannerState, scopeCommand } = context;
  const mpgMatch = normalized.match(/\b(\d{1,3}(?:\.\d+)?)\s*mpg\b|\bmpg\s*(?:is|at|to|=)?\s*(\d{1,3}(?:\.\d+)?)\b/);
  if (mpgMatch) {
    const mpg = Number(mpgMatch[1] ?? mpgMatch[2]);
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'mpg', value: mpg }],
      `Set vehicle efficiency to ${mpg} mpg.`,
      ['Set gas price', 'Find cheap gas', 'Build fuel cost'],
    );
  }

  const gasPriceMatch = normalized.match(/\b(?:gas\s+)?(?:price|cost)\s*(?:is|at|to|=|costs?)?\s*\$?(\d+(?:\.\d{1,2})?)\b|\bgas\s+(?:is|costs?)\s+\$?(\d+(?:\.\d{1,2})?)\b/);
  if (gasPriceMatch) {
    const gasPrice = Number(gasPriceMatch[1] ?? gasPriceMatch[2]);
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'gas_price', value: gasPrice }],
      `Set gas price to $${gasPrice.toFixed(2)} per gallon.`,
      ['Find cheap gas', 'Set MPG', 'Build fuel cost'],
    );
  }

  if (
    /\b(find|search|show|where|nearest|closest|cheap|cheapest|best price|prices?|nearby|within)\b[\s\S]{0,80}\b(gas|fuel|diesel|premium|regular gas|charging|ev chargers?)\b/.test(normalized) ||
    /\b(find cheap gas|gas stations? near|where should i fuel|closest gas station|nearest gas|gas prices|fuel nearby|find fuel|charging stations?|ev chargers?)\b/.test(normalized)
  ) {
    const radiusKm = extractRadiusKm(message) ?? 10;
    const sortBy = /\b(cheap|cheapest|best price|low(?:est)? price)\b/.test(normalized)
      ? 'best_price'
      : /\b(closest|nearest)\b/.test(normalized)
        ? 'closest'
        : 'best_price';
    const fuelType = extractFuelTypeFromPrompt(normalized);
    const actions = [
      ...(fuelType ? [{ type: 'SET_FIELD', field: 'fuel_type', value: fuelType }] : []),
      { type: 'SEARCH_NEARBY_FUEL', sort_by: sortBy, radius_km: radiusKm, limit: 5 },
    ];
    return actionResponse(
      actions,
      'Checking nearby fuel options from the first mapped route point.',
      ['Use cheapest gas price', 'Find nearby food', 'Add an end place'],
    );
  }

  const explicitLocationRecommendation = extractExplicitLocationRecommendationQuery(message);
  if (explicitLocationRecommendation) {
    return buildLocationRecommendationFallback(explicitLocationRecommendation, normalized);
  }

  const nearbyCategory = extractNearbyCategory(normalized);
  if (scopeCommand.intent === 'nearby_places' && !isEndpointRecommendationRequest(message)) {
    return actionResponse(
      [{ type: 'SEARCH_NEARBY_PLACES', ...(nearbyCategory ? { category: nearbyCategory } : {}), radius_km: 10, limit: 6 }],
      'Checking provider-backed stop options from the first mapped route point.',
      ['Add the best one', 'Find cheap gas', 'Build the itinerary'],
    );
  }

  if (/\b(weather|forecast|rain|storm|hot|cold|wind|snow)\b/.test(normalized)) {
    const route = formatRouteLabel(plannerState);
    return textResponse(
      plannerState.start || plannerState.end
        ? `I can check weather against ${route} using the planner's existing weather lookup. If live weather is unavailable, I will say so instead of guessing.`
        : 'Add a city, address, start, or final destination and I can check weather with the existing planner weather lookup. If live weather is unavailable, I will say so.',
      ['Check weather for start', 'Check weather for end', 'Find indoor backup stops'],
    );
  }

  const fuelType = extractFuelTypeFromPrompt(normalized);
  if (fuelType) {
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'fuel_type', value: fuelType }],
      `Set fuel type to ${fuelType}.`,
      ['Find cheap gas', 'Set MPG', 'Build fuel cost'],
    );
  }

  return null;
}

function buildPlannerSettingsResponse(
  context: LocalScopeAiResponseContext,
): ScopeAiChatResponse | null {
  const { message, normalized, plannerState } = context;
  if (hasNegativeBudgetAmount(message)) {
    return textResponse(
      'Budget needs a positive number, so I left the current budget unchanged.',
      ['Set budget to 500', 'Set budget range', 'Check route status'],
    );
  }

  const routeEndpointPairResponse = buildRouteEndpointPairResponse(message, plannerState);
  if (routeEndpointPairResponse) {
    return routeEndpointPairResponse;
  }

  const standaloneBudgetResponse = buildStandaloneBudgetResponse(message, plannerState);
  if (standaloneBudgetResponse) {
    return standaloneBudgetResponse;
  }

  const partySize = extractPartySize(message);
  if (partySize !== null) {
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'party_size', value: partySize }],
      `Set the travel party to ${formatTravelerCount(partySize)}.`,
      ['Set a budget', 'Add endpoints', 'Build a balanced route'],
    );
  }

  const pace = normalized.includes('packed')
    ? 'packed'
    : normalized.includes('relaxed') || normalized.includes('chill')
      ? 'relaxed'
      : normalized.includes('moderate') || normalized.includes('standard') || normalized.includes('balanced')
        ? 'standard'
        : null;
  if (pace && /\bpace\b|\bchill\b|\bpacked\b|\brelaxed\b|\bmoderate\b|\bbalanced\b/.test(normalized)) {
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'pace', value: pace }],
      `Set the trip pace to ${pace === 'standard' ? 'moderate' : pace}.`,
      ['Build for this pace', 'Add scenic stops', 'Check route status'],
    );
  }

  const themes = THEME_TERMS.filter((theme) => normalized.includes(theme));
  if (themes.length && /\btheme\b|\bvibe\b|\baround\b|\binterests?\b|\bfocus\b/.test(normalized)) {
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'theme', value: themes }],
      `Set the trip vibe to ${themes.join(', ')}.`,
      ['Build around these vibes', 'Add food stops', 'Add scenic stops'],
    );
  }

  return null;
}

function buildEndpointResponse(
  context: LocalScopeAiResponseContext,
): ScopeAiChatResponse | null {
  const { message, normalized, plannerState } = context;
  if (isEndpointRecommendationRequest(message)) {
    return textResponse(
      'I can suggest endpoint ideas from the current start place. I will show candidates first so you can choose one before I set the final destination.',
      ['Find scenic endpoints', 'Find practical endpoints', 'Add an end place'],
    );
  }

  const bareStartAddress = extractBareAddressStartCommand(message, plannerState);
  if (bareStartAddress) {
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'start', value: bareStartAddress }],
      `Set the start place to ${bareStartAddress}.`,
      ['Add an end place', 'Find stops nearby', 'Build from here'],
    );
  }

  const isCorrection = isEndpointCorrectionCommand(message);
  const start = !isCorrection || isStartCorrectionCommand(message)
    ? extractEndpointCommand(message, 'start')
    : null;
  if (start && !/\bhow\b/.test(normalized)) {
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'start', value: start }],
      `Set the start place to ${start}.`,
      ['Add an end place', 'Find stops nearby', 'Build from here'],
    );
  }

  const end = !isCorrection || isEndCorrectionCommand(message)
    ? extractEndpointCommand(message, 'end')
    : null;
  if (end && !/\bhow\b/.test(normalized)) {
    return actionResponse(
      [{ type: 'SET_FIELD', field: 'end', value: end }],
      `Set the end place to ${end}.`,
      ['Add a start place', 'Fit the route', 'Build the day'],
    );
  }

  return null;
}

function buildRouteGuidanceResponse(
  context: LocalScopeAiResponseContext,
): ScopeAiChatResponse | null {
  const { normalized, plannerState } = context;
  const routeActionTokens = getScopeAiKeywordTokens(normalized);
  if (isRouteBuildCommand(normalized, routeActionTokens)) {
    const nextMove = buildStateAwareNextMove(plannerState);
    if (plannerState.start && plannerState.end) {
      return textResponse(
        `Ready to build from the current planner state: ${formatRouteLabel(plannerState)}. I will use the existing dates, budget, travelers, pace, and vibes shown in the planner; if the live build provider is unavailable, I will say so plainly.`,
        ['Build the itinerary', 'Tighten this route', 'Check route status'],
      );
    }

    return textResponse(
      `I can build once the route has enough shape. ${nextMove.text}`,
      nextMove.chips,
    );
  }

  if (isRouteTightenCommand(normalized, routeActionTokens)) {
    const nextMove = buildStateAwareNextMove(plannerState);
    return textResponse(
      plannerState.start || plannerState.end
        ? `I will tighten against the route state I already have: ${formatRouteLabel(plannerState)}. I will not ask for endpoints that are already filled.`
        : nextMove.text,
      ['Tighten this route', 'Build the itinerary', 'Find one practical midpoint stop'],
    );
  }

  if (isRouteStatusCommand(normalized, routeActionTokens)) {
    const nextMove = buildStateAwareNextMove(plannerState);
    return textResponse(
      `Route status: ${formatRouteLabel(plannerState)}. ${nextMove.text}`,
      nextMove.chips,
    );
  }

  if (/\b(help|what can you do|assist|plan my trip|trip advice)\b/.test(normalized)) {
    const nextMove = buildStateAwareNextMove(plannerState);
    return textResponse(
      `${nextMove.text} I can also handle budget, dates, travelers, pace, vibes, weather, packing, fuel, nearby stops, and endpoint recommendations from this same planner state.`,
      nextMove.chips,
    );
  }

  return null;
}

function buildLocalScopeAiFallbackResponse(
  context: LocalScopeAiResponseContext,
): ScopeAiChatResponse {
  const { message, plannerState } = context;
  if (isLikelyUnclearScopeAiPrompt(message)) {
    return textResponse(
      UNCLEAR_SCOPE_AI_REPLY,
      UNCLEAR_SCOPE_AI_CHIPS,
    );
  }

  const nextMove = buildStateAwareNextMove(plannerState);
  return textResponse(
    nextMove.text,
    nextMove.chips,
  );
}

const LOCAL_SCOPE_AI_RESPONSE_STAGES: readonly LocalScopeAiResponseStage[] = [
  buildPriorityCommandResponse,
  buildDateAndPackingResponse,
  buildFuelAndLocationResponse,
  buildPlannerSettingsResponse,
  buildEndpointResponse,
  buildRouteGuidanceResponse,
];

function buildLocalScopeAiResponse(input: ScopeAiChatInput): ScopeAiChatResponse {
  const safeMessage = sanitizeScopeAiProviderQuery(input.message.trim()) || input.message.trim();
  const scopeCommand = parseScopeAiPlannerCommand(safeMessage);
  const context: LocalScopeAiResponseContext = {
    scopeCommand,
    message: scopeCommand.normalizedMessage,
    normalized: scopeCommand.normalized,
    plannerState: input.plannerState as LocalPlannerState,
  };

  for (const stage of LOCAL_SCOPE_AI_RESPONSE_STAGES) {
    const response = stage(context);
    if (response) {
      return response;
    }
  }

  return buildLocalScopeAiFallbackResponse(context);
}

function isDeterministicPlannerCommand(message: string): boolean {
  const parsedCommand = parseScopeAiPlannerCommand(message);
  const normalizedMessage = parsedCommand.normalizedMessage;
  const normalized = parsedCommand.normalized;
  const tokens = parsedCommand.tokens;
  const hasBudgetCommand = extractBudgetRange(normalizedMessage) !== null || extractSingleBudget(normalizedMessage) !== null;

  return (
    parsedCommand.intent !== 'none' ||
    hasBudgetCommand ||
    (/\b(date|dates|start date|end date|depart|departure|leave|leaving|arrive|arrival|return|through|until)\b/.test(normalized) && new RegExp(DATE_TOKEN_PATTERN.source, 'i').test(normalizedMessage)) ||
    /\bundo\b|\bgo back\b/.test(normalized) ||
    /\bpace\b|\bchill\b|\bpacked\b|\brelaxed\b|\bmoderate\b|\bbalanced\b/.test(normalized) ||
    /\btheme\b|\bvibe\b|\baround\b|\binterests?\b|\bfocus\b/.test(normalized) ||
    /\b(call it|rename|name (?:this|the)?\s*(?:trip|draft|route)|title|packing|pack|weather|forecast|mpg|fuel|gas|diesel|electric car|cheap gas|nearby|restroom|coffee|travelers?|travellers?|people|party|group|solo|couple)\b/.test(normalized) ||
    isRouteBuildCommand(normalized, tokens) ||
    isRouteTightenCommand(normalized, tokens) ||
    /\b(find practical endpoints?|find scenic endpoints?|show more endpoint ideas|choose .*endpoint|pick .*destination|where should .*end|where should .*go|good place to go)\b/.test(normalized) ||
    /\b(what can you do|plan my trip)\b/.test(normalized) ||
    isRouteStatusCommand(normalized, tokens) ||
    /\b(start|begin|leave|leaving|from|end|finish|destination|final destination|to)\b(?:\s+(?:at|in|from|to|is|as))?\s+.+/i.test(normalizedMessage)
  );
}

function isStaleMissingRouteReply(responseText: string, plannerState: LocalPlannerState): boolean {
  const hasKnownRoutePiece = Boolean(plannerState.start?.trim() || plannerState.end?.trim());
  if (!hasKnownRoutePiece) {
    return false;
  }

  return /\b(tell me|need|add|provide)\b[\s\S]{0,80}\b(start|origin)\b[\s\S]{0,80}\b(end|destination|finish)\b/i.test(responseText) ||
    /\badd your start and (?:finish|end|destination)\b/i.test(responseText) ||
    /\b(?:do not|don't|doesn't|does not|missing|need|add|provide)\b[\s\S]{0,80}\b(?:start|origin|destination|endpoint|end point)\b/i.test(responseText);
}

function shouldUseLocalResponse(message: string, responseText: string, plannerState: LocalPlannerState): boolean {
  const needsAction = isDeterministicPlannerCommand(message);
  const isAnswerOnlyRouteQuestion = /\b(confidence summary|explain|why|is .*worth|should i|should we|compare|tell me about|what do you think)\b/i.test(message);
  const explicitLocationRecommendation = extractExplicitLocationRecommendationQuery(message);

  return (
    /Scope found relevant source material|strongest matches are|API endpoint index|Frontend routes/i.test(responseText) ||
    isStaleMissingRouteReply(responseText, plannerState) ||
    (needsAction && !isAnswerOnlyRouteQuestion && !explicitLocationRecommendation && !ACTION_FENCE_PATTERN.test(responseText))
  );
}

export const __scopeAiServiceCoverage = import.meta.env.MODE === 'test'
  ? {
      actionResponse,
      addParsedPlannerCommandAction,
      addUniqueAction,
      buildDateClarification,
      buildIsoDate,
      buildLocationRecommendationFallback,
      buildLocalScopeAiResponse,
      buildMixedIntentResponse,
      buildSingleBudgetActions,
      buildStateAwareNextMove,
      cleanupEndpointCommandValue,
      cleanupInviteRecipientValue,
      cleanupKeywordTargetValue,
      cleanupLocationRecommendationQuery,
      cleanupMapTargetQuery,
      cleanupTripDocumentValue,
      collapseRepeatedLetters,
      compareIsoDates,
      damerauLevenshteinDistance,
      escapeScopeAiRegExp,
      extractActionsFromLocalResponse,
      extractBareAddressStartCommand,
      extractBudgetRange,
      extractClearEndpointField,
      extractDateCommand,
      extractDateTokens,
      extractEndpointCommand,
      extractFuelTypeFromPrompt,
      extractInviteRecipient,
      extractExplicitLocationRecommendationQuery,
      extractMapCommand,
      extractMapFocusQuery,
      extractNearbyCategory,
      extractPartySize,
      extractPlaceAfter,
      extractRadiusKm,
      extractSingleBudget,
      extractTripTitleCommand,
      formatIsoDate,
      formatMoney,
      formatRouteLabel,
      formatTravelerCount,
      getPackingSuggestions,
      getPlannerDefaultYear,
      getScopeAiKeywordTokens,
      hasAnyScopeAiKeyword,
      hasAnyScopeAiPhrase,
      hasNegativeBudgetAmount,
      hasScopeAiPhrase,
      isAmbiguousRouteClearCommand,
      isBareGlobalMapFocusQuery,
      isDatePrompt,
      isDeleteTripConfirmation,
      isDeleteTripRequest,
      isDeterministicPlannerCommand,
      isEndpointCorrectionCommand,
      isEndpointRecommendationRequest,
      isExactSingleBudgetCommand,
      isLikelyUnclearScopeAiPrompt,
      isNearbyPlacesCommand,
      isOpenShareCommand,
      isRouteBuildCommand,
      isRouteStatusCommand,
      isRouteTightenCommand,
      isSaveTripCommand,
      isStaleMissingRouteReply,
      isStartCityRecommendationRequest,
      isStartCorrectionCommand,
      isEndCorrectionCommand,
      mergeScopeAiLexicalKeywordTokens,
      normalizeBudgetAmount,
      normalizeChips,
      normalizeScopeAiImagePayload,
      normalizeNoisyCommandTokens,
      normalizeNoisyCommandWord,
      normalizeNoisyScopeAiPrompt,
      normalizePlannerBudgetMinimum,
      normalizeScopeAiCommandText,
      normalizeYear,
      parseDateToken,
      parseMonthName,
      parseScopeAiPlannerCommand,
      shouldFuzzyNormalizeCommandWord,
      shouldUseLocalResponse,
      splitMixedIntentClauses,
      textResponse,
      toDateValue,
    }
  : undefined;

export async function callScopeAi(input: ScopeAiChatInput): Promise<ScopeAiChatResponse> {
  const localResponse = buildLocalScopeAiResponse(input);
  const plannerState = input.plannerState as LocalPlannerState;
  const imagePayload = normalizeScopeAiImagePayload(input.images);
  const hasImages = imagePayload.length > 0;
  const imageAwarePrompt = hasImages && /\b(attached|image|images|inspect|look|photo|photos|picture|pictures|review|see|visible)\b/i.test(input.message);
  const explicitLocationRecommendation = extractExplicitLocationRecommendationQuery(input.message);
  const parsedCommand = parseScopeAiPlannerCommand(input.message);
  const shouldResolveLocally =
    isStartCityRecommendationRequest(input.message) ||
    (parsedCommand.intent === 'nearby_places' && !explicitLocationRecommendation);

  if (
    shouldResolveLocally ||
    (isDeterministicPlannerCommand(input.message) && !imageAwarePrompt && !explicitLocationRecommendation) ||
    (!hasImages && isLikelyUnclearScopeAiPrompt(input.message) && !explicitLocationRecommendation)
  ) {
    return localResponse;
  }

  try {
    const safeBackendMessage = sanitizeScopeAiProviderQuery(input.message) || 'trip planning request';
    const safeSessionHistory = input.sessionHistory.map((entry) => ({
      ...entry,
      content: sanitizeScopeAiVisibleText(entry.content),
    }));
    const { data } = await api.post<ScopeAiBackendResponse>('/api/intel/agent/trip-chat', {
      message: safeBackendMessage,
      plannerState: input.plannerState,
      planner_state: input.plannerState,
      session_history: safeSessionHistory,
      sessionHistory: safeSessionHistory,
      preferences: input.preferences,
      responseMode: 'json',
      images: imagePayload.length ? imagePayload : undefined,
    }, {
      timeout: 120_000,
    });

    if (data.response) {
      const responseText = buildStructuredBackendResponseText(data);
      if (shouldUseLocalResponse(input.message, responseText, plannerState)) {
        return localResponse;
      }

      return {
        responseText,
        model: data.model ?? 'scope-ai',
      };
    }
  } catch {
    console.warn('Scope AI chat endpoint unavailable; using local structured copilot.');
    if (hasImages) {
      return {
        responseText: 'Sorry, I could not inspect the attached image because Scope AI vision is unavailable right now. Describe what is visible, or try again when the Scope AI backend is connected.',
        model: 'scope-ai-vision-unavailable',
      };
    }
  }

  return localResponse;
}
