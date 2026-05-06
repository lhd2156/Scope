const DEFAULT_SCOPE_AI_MIN_REPLY_MS = 2_200;
const MAX_SCOPE_AI_MIN_REPLY_MS = 10_000;

function readConfiguredMinimumReplyMs(): number | null {
  const rawValue = import.meta.env.VITE_SCOPE_AI_MIN_REPLY_MS;
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return Math.min(MAX_SCOPE_AI_MIN_REPLY_MS, Math.max(0, parsedValue));
}

export function getScopeAiMinimumReplyMs(): number {
  const configuredValue = readConfiguredMinimumReplyMs();
  if (configuredValue !== null) {
    return configuredValue;
  }

  return import.meta.env.VITEST ? 0 : DEFAULT_SCOPE_AI_MIN_REPLY_MS;
}

export function getScopeAiResponseStartedAt(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export async function waitForScopeAiResponsePace(
  startedAt: number,
  minimumReplyMs = getScopeAiMinimumReplyMs(),
): Promise<void> {
  if (minimumReplyMs <= 0) {
    return;
  }

  const now = getScopeAiResponseStartedAt();
  const remainingMs = minimumReplyMs - Math.max(0, now - startedAt);
  if (remainingMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, Math.ceil(remainingMs));
  });
}
