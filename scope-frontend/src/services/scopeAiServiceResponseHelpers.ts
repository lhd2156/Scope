export interface ScopeAiImageInput {
  filename?: string;
  mime_type: string;
  data: string;
}

export interface ScopeAiChatResponse {
  responseText: string;
  model: string;
}

export interface ScopeAiBackendResponse {
  response?: string;
  model?: string;
  actions?: object[];
  chips?: string[];
  place_cards?: Array<{
    title?: string;
    subtitle?: string;
    reason?: string;
    sourceLabel?: string;
    source_label?: string;
  }>;
}

export const ACTION_FENCE_PATTERN = /```action\s*\n[\s\S]*?\n```/i;

const MAX_SCOPE_AI_SERVICE_IMAGES = 3;
const MAX_SCOPE_AI_SERVICE_IMAGE_BYTES = 1.5 * 1024 * 1024;
const SUPPORTED_SCOPE_AI_SERVICE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function normalizeBackendChips(chips: string[]): string[] {
  return chips
    .map((chip) => chip.trim())
    .filter(Boolean)
    .filter((chip, index, values) => values.indexOf(chip) === index)
    .slice(0, 3);
}

function stripImageDataUrlPrefix(data: string): string {
  const trimmed = data.trim();
  return trimmed.toLowerCase().startsWith('data:') && trimmed.includes(',')
    ? trimmed.split(',', 2)[1]?.trim() ?? ''
    : trimmed;
}

function estimateBase64ByteLength(data: string): number {
  const normalized = stripImageDataUrlPrefix(data).replace(/\s+/g, '');
  const padding = normalized.length - normalized.replace(/=+$/, '').length;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

export function normalizeScopeAiImagePayload(images: ScopeAiImageInput[] | undefined): ScopeAiImageInput[] {
  const normalized: ScopeAiImageInput[] = [];

  for (const image of images ?? []) {
    const flexibleImage = image as ScopeAiImageInput & { mimeType?: string };
    const mimeType = String(flexibleImage.mime_type || flexibleImage.mimeType || '').trim().toLowerCase();
    const data = stripImageDataUrlPrefix(String(flexibleImage.data || ''));
    if (!SUPPORTED_SCOPE_AI_SERVICE_IMAGE_MIME_TYPES.has(mimeType) || !data) {
      continue;
    }
    if (estimateBase64ByteLength(data) > MAX_SCOPE_AI_SERVICE_IMAGE_BYTES) {
      continue;
    }

    normalized.push({
      ...(flexibleImage.filename ? { filename: String(flexibleImage.filename) } : {}),
      mime_type: mimeType,
      data,
    });

    if (normalized.length >= MAX_SCOPE_AI_SERVICE_IMAGES) {
      break;
    }
  }

  return normalized;
}

export function buildStructuredBackendResponseText(data: ScopeAiBackendResponse): string {
  let responseText = data.response?.trim() ?? '';
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const rawChips = Array.isArray(data.chips) ? data.chips : [];
  const chips = rawChips.length ? normalizeBackendChips(rawChips) : [];
  const placeCards = Array.isArray(data.place_cards) ? data.place_cards : [];
  const firstCardTitle = placeCards[0]?.title?.trim();

  if (actions.length && !ACTION_FENCE_PATTERN.test(responseText)) {
    responseText = [
      '```action',
      JSON.stringify({ actions }),
      '```',
      responseText,
    ].filter(Boolean).join('\n');
  }

  if (firstCardTitle && !responseText.toLowerCase().includes(firstCardTitle.toLowerCase())) {
    const livePicks = placeCards
      .map((card, index) => {
        const title = card.title?.trim();
        if (!title) {
          return '';
        }
        const detail = card.reason?.trim() || card.subtitle?.trim() || card.sourceLabel?.trim() || card.source_label?.trim() || 'provider-backed nearby option';
        return `${index + 1}. ${title} - ${detail}`;
      })
      .filter(Boolean)
      .slice(0, 5);
    if (livePicks.length) {
      responseText = [
        responseText,
        ['Live nearby picks:', ...livePicks].join('\n'),
      ].filter(Boolean).join('\n\n');
    }
  }

  if (chips.length && !/CHIPS:\s*\[/i.test(responseText)) {
    responseText = `${responseText.trim()}\n\nCHIPS: ${JSON.stringify(chips)}`.trim();
  }

  return responseText;
}

export function extractActionsFromLocalResponse(response: ScopeAiChatResponse | null): object[] {
  const actionJson = response?.responseText.match(ACTION_FENCE_PATTERN)?.[0]
    .replace(/^```action\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  if (!actionJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(actionJson) as { actions?: object[] };
    return Array.isArray(parsed.actions) ? parsed.actions : [];
  } catch {
    return [];
  }
}
