import { mergeUniqueSuggestions } from '@/components/trips/tripAiSuggestions';

export type ScopeRouteActionType = 'add_marker' | 'remove_marker' | 'reorder_stops';
export type ScopeRouteActionStopType = 'start' | 'stop' | 'destination';

export interface ScopeRouteActionPayload {
  action?: unknown;
  type?: unknown;
  action_type?: unknown;
  place_name?: unknown;
  placeName?: unknown;
  name?: unknown;
  title?: unknown;
  place_id?: unknown;
  placeId?: unknown;
  id?: unknown;
  address?: unknown;
  stop_type?: unknown;
  stopType?: unknown;
  day?: unknown;
  dayNumber?: unknown;
  order?: unknown;
  note?: unknown;
  notes?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  lat?: unknown;
  lng?: unknown;
  coordinates?: unknown;
  stops?: unknown;
  stop_order?: unknown;
}

export interface ParsedAssistantResponse {
  content: string;
  chips: string[];
  actions: ScopeRouteActionPayload[];
}

const SCOPE_ACTION_BLOCK_PATTERN = /\[SCOPE_ACTION\]([\s\S]*?)\[\/SCOPE_ACTION\]/gi;
const CHIPS_BLOCK_PATTERN = /\[CHIPS\]([\s\S]*?)\[\/CHIPS\]/gi;
const MAX_RESPONSE_CHIPS = 3;

export function normalizeHiddenBlockContent(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeChipLabel(value: string): string {
  return value
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

export function parseScopeActionBlocks(rawContent: string): { content: string; actions: ScopeRouteActionPayload[] } {
  const actions: ScopeRouteActionPayload[] = [];
  SCOPE_ACTION_BLOCK_PATTERN.lastIndex = 0;
  const content = rawContent.replace(SCOPE_ACTION_BLOCK_PATTERN, (_match, rawBlock: string) => {
    const normalizedBlock = normalizeHiddenBlockContent(rawBlock);
    if (!normalizedBlock) {
      return '';
    }

    try {
      const parsed = JSON.parse(normalizedBlock) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (isRecord(item)) {
            actions.push(item);
          }
        });
      } else if (isRecord(parsed)) {
        actions.push(parsed);
      }
    } catch {
      // Keep hidden action parsing best-effort so a malformed tool block never leaks into chat.
    }

    return '';
  });

  return { content, actions };
}

export function parseChipLabels(rawBlock: string): string[] {
  const normalizedBlock = normalizeHiddenBlockContent(rawBlock);
  if (!normalizedBlock) {
    return [];
  }

  if (normalizedBlock.startsWith('[')) {
    try {
      const parsed = JSON.parse(normalizedBlock) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => sanitizeChipLabel(String(item ?? '')))
          .filter(Boolean);
      }
    } catch {
      // Fall through to comma/newline parsing.
    }
  }

  return normalizedBlock
    .split(/,|\n/)
    .map(sanitizeChipLabel)
    .filter(Boolean);
}

export function parseChipBlocks(rawContent: string): { content: string; chips: string[] } {
  const chipGroups: string[][] = [];
  CHIPS_BLOCK_PATTERN.lastIndex = 0;
  const content = rawContent.replace(CHIPS_BLOCK_PATTERN, (_match, rawBlock: string) => {
    chipGroups.push(parseChipLabels(rawBlock));
    return '';
  });

  return {
    content,
    chips: mergeUniqueSuggestions(...chipGroups).slice(0, MAX_RESPONSE_CHIPS),
  };
}

export function parseAssistantResponseBlocks(rawContent: string): ParsedAssistantResponse {
  const actionResult = parseScopeActionBlocks(rawContent);
  const chipResult = parseChipBlocks(actionResult.content);
  const content = chipResult.content
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    content: content || 'Done.',
    chips: chipResult.chips,
    actions: actionResult.actions,
  };
}

export function readStringField(source: ScopeRouteActionPayload, ...keys: Array<keyof ScopeRouteActionPayload>): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

export function readPositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

export function normalizeScopeActionType(action: ScopeRouteActionPayload): ScopeRouteActionType | null {
  const value = readStringField(action, 'action', 'type', 'action_type')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (value === 'add_marker' || value === 'add_stop' || value === 'add_place') {
    return 'add_marker';
  }

  if (value === 'remove_marker' || value === 'remove_stop' || value === 'delete_marker') {
    return 'remove_marker';
  }

  if (value === 'reorder_stops' || value === 'reorder_markers' || value === 'reorder_route') {
    return 'reorder_stops';
  }

  return null;
}

export function normalizeScopeActionStopType(action: ScopeRouteActionPayload): ScopeRouteActionStopType {
  const value = readStringField(action, 'stop_type', 'stopType')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (value === 'start' || value === 'origin') {
    return 'start';
  }

  if (value === 'destination' || value === 'end' || value === 'final' || value === 'finish') {
    return 'destination';
  }

  return 'stop';
}

export function getScopeActionPlaceLabel(action: ScopeRouteActionPayload): string {
  return readStringField(action, 'place_name', 'placeName', 'name', 'title')
    || readStringField(action, 'address');
}

export function getScopeActionAddress(action: ScopeRouteActionPayload): string {
  return readStringField(action, 'address') || getScopeActionPlaceLabel(action);
}

export function getScopeActionNote(action: ScopeRouteActionPayload): string {
  return readStringField(action, 'note', 'notes');
}

export function normalizeActionLookupValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readStopOrderEntries(action: ScopeRouteActionPayload): unknown[] {
  if (Array.isArray(action.stop_order)) {
    return action.stop_order;
  }

  if (Array.isArray(action.stops)) {
    return action.stops;
  }

  return [];
}

export function normalizeStopOrderEntry(entry: unknown): ScopeRouteActionPayload {
  if (isRecord(entry)) {
    return entry;
  }

  return {
    place_name: String(entry ?? ''),
  };
}
