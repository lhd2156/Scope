import type { ScopeAiActionBlock } from '@/stores/scopeAiPlanner';

export interface ScopeAiParsedResponse {
  actionBlock: ScopeAiActionBlock | null;
  confirmationText: string;
  chips: string[];
}

const ACTION_FENCE_PATTERN = /```action\s*\n([\s\S]*?)\n```/i;
const CHIPS_PATTERN = /CHIPS:\s*(\[[\s\S]*?\])\s*$/m;

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function parseScopeAiResponse(raw: string): ScopeAiParsedResponse {
  let workingText = raw;
  let actionBlock: ScopeAiActionBlock | null = null;
  let chips: string[] = [];

  const actionMatch = workingText.match(ACTION_FENCE_PATTERN);
  if (actionMatch?.[1]) {
    try {
      actionBlock = JSON.parse(actionMatch[1]) as ScopeAiActionBlock;
    } catch (error) {
      console.error('Scope AI action block parse failed', error);
      actionBlock = null;
    }

    workingText = workingText.replace(actionMatch[0], '');
  }

  const chipsMatch = workingText.match(CHIPS_PATTERN);
  if (chipsMatch?.[1]) {
    try {
      chips = parseStringArray(JSON.parse(chipsMatch[1]));
    } catch (error) {
      console.error('Scope AI chips parse failed', error);
      chips = [];
    }

    workingText = workingText.replace(chipsMatch[0], '');
  }

  return {
    actionBlock,
    confirmationText: workingText.trim(),
    chips,
  };
}
