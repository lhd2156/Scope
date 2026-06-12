import { containsUnsafeScopeAiText, sanitizeScopeAiVisibleText } from '@/services/scopeAiSafety';

export interface ScopeAiTurnPlannerSnapshot {
  start?: string | null;
  end?: string | null;
  stopCount?: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  pace?: string | null;
  routeLabel?: string | null;
  stateSignature?: string;
}

export interface ScopeAiTurnActionResolution {
  type?: string;
  field?: string;
  rawValue?: string;
  status?: string;
  resolvedLabel?: string;
  candidates?: string[];
}

export interface ScopeAiTurnActionApplyResult {
  applied: boolean;
  resolutions: ScopeAiTurnActionResolution[];
}

export interface ScopeAiAuditablePlaceResult {
  id?: string;
  placeName: string;
  formattedAddress?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  sourceLabel?: string;
  distanceKm?: number;
  reason?: string;
}

export type ScopeAiAuditableMessage =
  | {
      id: string;
      role: 'assistant';
      kind: 'text' | 'error';
      content: string;
      model?: string;
      chips?: string[];
    }
  | {
      id: string;
      role: 'assistant';
      kind: 'places';
      content: string;
      queryLabel: string;
      results: ScopeAiAuditablePlaceResult[];
      placeAction?: string;
    };

export interface ScopeAiPreviousAssistantMessage {
  kind: string;
  content: string;
  stateSignature?: string;
}

export interface ScopeAiTurnAuditContext {
  userPrompt: string;
  previousUserPrompt?: string | null;
  planner: ScopeAiTurnPlannerSnapshot;
  actionApplyResult?: ScopeAiTurnActionApplyResult | null;
  previousAssistantMessages?: ScopeAiPreviousAssistantMessage[];
}

export interface ScopeAiTurnAuditResult<TMessage extends ScopeAiAuditableMessage> {
  message: TMessage;
  approved: boolean;
  reasons: string[];
}

function normalizeAuditText(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9$./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeChip(value: string): string {
  return sanitizeScopeAiVisibleText(value).replace(/\s+/g, ' ').trim();
}

function uniqueChips(chips: string[] | undefined): string[] | undefined {
  if (!chips?.length) {
    return undefined;
  }

  const seen = new Set<string>();
  const nextChips = chips
    .map(normalizeChip)
    .filter((chip) => {
      const key = normalizeAuditText(chip);
      if (!key || chip.includes('[redacted]') || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 3);

  return nextChips.length ? nextChips : undefined;
}

function getPlaceResultKey(result: ScopeAiAuditablePlaceResult): string {
  const latitude = Number(result.latitude);
  const longitude = Number(result.longitude);
  const coordinateKey = Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `${latitude.toFixed(5)},${longitude.toFixed(5)}`
    : '';
  const labelKey = normalizeAuditText([
    result.placeName,
    result.formattedAddress,
    result.address,
  ].filter(Boolean).join(' '));

  return [
    normalizeAuditText(result.id),
    coordinateKey,
    labelKey,
  ].filter(Boolean).join('|');
}

function dedupePlaceResults(results: ScopeAiAuditablePlaceResult[]): ScopeAiAuditablePlaceResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = getPlaceResultKey(result);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sanitizeOptionalText(value: string | undefined): string | undefined {
  return value === undefined ? undefined : sanitizeScopeAiVisibleText(value);
}

function sanitizePlaceResult(result: ScopeAiAuditablePlaceResult): ScopeAiAuditablePlaceResult {
  return {
    ...result,
    placeName: sanitizeScopeAiVisibleText(result.placeName),
    formattedAddress: sanitizeOptionalText(result.formattedAddress),
    address: sanitizeOptionalText(result.address),
    source: sanitizeOptionalText(result.source),
    sourceLabel: sanitizeOptionalText(result.sourceLabel),
    reason: sanitizeOptionalText(result.reason),
  };
}

function hasUnsafePlaceText(message: Extract<ScopeAiAuditableMessage, { kind: 'places' }>): boolean {
  return [
    message.content,
    message.queryLabel,
    message.placeAction,
    ...message.results.flatMap((result) => [
      result.placeName,
      result.formattedAddress,
      result.address,
      result.source,
      result.sourceLabel,
      result.reason,
    ]),
  ].some((value) => containsUnsafeScopeAiText(value));
}

function buildRouteAwareSafeReply(planner: ScopeAiTurnPlannerSnapshot): string {
  const start = planner.start?.trim();
  const end = planner.end?.trim();
  const stopCount = Number(planner.stopCount ?? 0);
  const dateText = planner.startDate || planner.endDate
    ? `${planner.startDate ?? 'start date not set'} to ${planner.endDate ?? 'end date not set'}`
    : 'dates not locked yet';
  const budgetText = Number.isFinite(Number(planner.budgetMax))
    ? `up to $${Math.round(Number(planner.budgetMax)).toLocaleString()}`
    : 'budget not locked yet';
  const paceText = planner.pace === 'standard' ? 'moderate' : planner.pace || 'pace not locked yet';

  if (start && end) {
    return `I have the route from ${start} to ${end} with ${stopCount} stop${stopCount === 1 ? '' : 's'}, ${dateText}, ${budgetText}, and ${paceText} pace. I will use verified planner state or provider results only; next I can build, tighten, check weather/fuel, or find stops.`;
  }

  if (start) {
    return `I already have the start as ${start}. I will not ask for it again. Add or choose a final destination, then I can build, tighten, check weather/fuel, or find stops from verified planner state.`;
  }

  if (end) {
    return `I already have the final destination as ${end}. Add a start place or ask for route-aware suggestions; I will use verified planner state or provider results only.`;
  }

  return 'I could not verify a specific planner change from that message. Add a start, final destination, date, budget, traveler count, pace, vibe, weather, fuel, packing, or stop request and I will use verified provider or planner state only.';
}

function hasKnownRoutePiece(planner: ScopeAiTurnPlannerSnapshot): boolean {
  return Boolean(planner.start?.trim() || planner.end?.trim());
}

function asksForKnownRoutePieces(content: string, planner: ScopeAiTurnPlannerSnapshot): boolean {
  if (!hasKnownRoutePiece(planner)) {
    return false;
  }

  return /\b(tell me|need|add|provide|missing)\b[\s\S]{0,100}\b(start|origin)\b[\s\S]{0,100}\b(end|destination|finish)\b/i.test(content) ||
    /\badd your start and (?:finish|end|destination)\b/i.test(content);
}

function hasUnsupportedWeatherClaim(content: string): boolean {
  const mentionsWeather = /\b(weather|forecast|rain|storm|hot|cold|wind|snow|aqi|temperature)\b/i.test(content);
  const hasWeatherFact = /\b\d{1,3}\s?F\b/i.test(content) ||
    /\b(clear|sunny|cloudy|rain|snow|storm|windy|breezy|aqi\s+\d{1,3})\b/i.test(content);
  if (!mentionsWeather || !hasWeatherFact) {
    return false;
  }

  return !/(Weather source:|configured frontend weather providers|did not guess|existing planner weather lookup|weather provider path|unavailable)/i.test(content);
}

function isProviderBackedWeatherMessage(message: ScopeAiAuditableMessage): boolean {
  return message.kind === 'text' && message.model === 'scope-weather-provider';
}

function hasUnsupportedFuelClaim(content: string): boolean {
  if (!/\$\d+(?:\.\d{1,2})?\/gal/i.test(content)) {
    return false;
  }

  return !/\b(Fuel near|live fuel|configured fuel|price unavailable|fuel lookup|Google Places|provider|source)\b/i.test(content);
}

function confirmsFailedPlannerMutation(content: string, result: ScopeAiTurnActionApplyResult | null | undefined): boolean {
  if (!result) {
    return false;
  }

  if (!result.applied && result.resolutions.length > 0 && /\b(set|added|updated|changed|removed)\b/i.test(content)) {
    return true;
  }

  const failedResolution = result.resolutions.find((resolution) => resolution.status && resolution.status !== 'resolved');
  return Boolean(failedResolution && /\b(set|added|updated|changed)\b/i.test(content));
}

function isDuplicateAssistantReply(
  message: ScopeAiAuditableMessage,
  context: ScopeAiTurnAuditContext,
): boolean {
  if (message.kind !== 'text') {
    return false;
  }

  const current = normalizeAuditText(message.content);
  const currentPrompt = normalizeAuditText(context.userPrompt);
  const previousPrompt = normalizeAuditText(context.previousUserPrompt);
  if (!current) {
    return false;
  }

  if (!currentPrompt || currentPrompt !== previousPrompt) {
    return false;
  }

  const currentState = context.planner.stateSignature ?? '';
  return Boolean(context.previousAssistantMessages?.some((previous) => (
    previous.kind === 'text' &&
    normalizeAuditText(previous.content) === current &&
    (previous.stateSignature ?? '') === currentState
  )));
}

function buildReplacementMessage<TMessage extends ScopeAiAuditableMessage>(
  original: TMessage,
  content: string,
  chips?: string[],
): TMessage {
  return {
    id: original.id,
    role: 'assistant',
    kind: 'text',
    content,
    model: original.kind === 'text' || original.kind === 'error' ? original.model : 'scope-ai-auditor',
    ...(uniqueChips(chips) ? { chips: uniqueChips(chips) } : {}),
  } as TMessage;
}

export function auditScopeAiTurn<TMessage extends ScopeAiAuditableMessage>(
  message: TMessage,
  context: ScopeAiTurnAuditContext,
): ScopeAiTurnAuditResult<TMessage> {
  const reasons: string[] = [];

  if (message.kind === 'places') {
    const hadUnsafeText = hasUnsafePlaceText(message);
    const sanitizedPlacesMessage = {
      ...message,
      content: sanitizeScopeAiVisibleText(message.content),
      queryLabel: sanitizeScopeAiVisibleText(message.queryLabel),
      ...(message.placeAction ? { placeAction: sanitizeScopeAiVisibleText(message.placeAction) } : {}),
      results: message.results.map(sanitizePlaceResult),
    };
    if (hadUnsafeText) {
      reasons.push('unsafe_language_redacted');
    }

    const results = dedupePlaceResults(sanitizedPlacesMessage.results);
    if (results.length !== message.results.length) {
      reasons.push('deduped_place_results');
    }

    if (!results.length) {
      return {
        approved: false,
        reasons: [...reasons, 'empty_place_results'],
        message: buildReplacementMessage(
          message,
          `${hadUnsafeText ? 'I can help with the trip request, but I will not repeat abusive language. ' : ''}I could not verify distinct place results for that request. Add a city/state, pick a mapped route point, or try a more specific category.`,
          ['Add city/state', 'Pick on map', 'Check route status'],
        ),
      };
    }

    return {
      approved: !reasons.length,
      reasons,
      message: {
        ...sanitizedPlacesMessage,
        results,
      },
    };
  }

  const chips = uniqueChips(message.chips);
  let nextMessage = {
    ...message,
    ...(chips ? { chips } : {}),
    ...(!chips && message.chips ? { chips: undefined } : {}),
  } as TMessage;
  if (message.chips?.length && chips?.length !== message.chips.length) {
    reasons.push('deduped_chips');
  }

  const unsafeContent = containsUnsafeScopeAiText(message.content);
  if (unsafeContent) {
    return {
      approved: false,
      reasons: [...reasons, 'unsafe_language_redacted'],
      message: buildReplacementMessage(
        nextMessage,
        `I can help with the trip request, but I will not repeat abusive language. ${buildRouteAwareSafeReply(context.planner)}`,
        ['Check route status', 'Build the itinerary', 'Find verified stops'],
      ),
    };
  }

  const content = sanitizeScopeAiVisibleText(message.content);
  nextMessage = {
    ...nextMessage,
    content,
  } as TMessage;

  if (message.kind === 'error') {
    return {
      approved: !reasons.length,
      reasons,
      message: nextMessage,
    };
  }
  const unsupportedWeatherClaim = hasUnsupportedWeatherClaim(content) && !isProviderBackedWeatherMessage(nextMessage);
  const unsupportedFuelClaim = hasUnsupportedFuelClaim(content);
  const askedForKnownRoutePiece = asksForKnownRoutePieces(content, context.planner);
  const failedMutationConfirmation = confirmsFailedPlannerMutation(content, context.actionApplyResult);
  if (
    askedForKnownRoutePiece ||
    unsupportedWeatherClaim ||
    unsupportedFuelClaim ||
    failedMutationConfirmation
  ) {
    const replacement = buildRouteAwareSafeReply(context.planner);
    return {
      approved: false,
      reasons: [
        ...reasons,
        askedForKnownRoutePiece ? 'asked_for_known_route_piece' : '',
        unsupportedWeatherClaim ? 'unsupported_weather_claim' : '',
        unsupportedFuelClaim ? 'unsupported_fuel_claim' : '',
        failedMutationConfirmation ? 'failed_mutation_confirmation' : '',
      ].filter(Boolean),
      message: buildReplacementMessage(
        nextMessage,
        replacement,
        ['Check route status', 'Build the itinerary', 'Find verified stops'],
      ),
    };
  }

  if (isDuplicateAssistantReply(nextMessage, context)) {
    return {
      approved: false,
      reasons: [...reasons, 'duplicate_assistant_reply'],
      message: buildReplacementMessage(
        nextMessage,
        `No new change from that repeat prompt. ${buildRouteAwareSafeReply(context.planner)}`,
        ['Check route status', 'Build the itinerary', 'Find verified stops'],
      ),
    };
  }

  return {
    approved: !reasons.length,
    reasons,
    message: nextMessage,
  };
}
