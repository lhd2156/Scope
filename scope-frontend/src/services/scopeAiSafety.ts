const UNSAFE_TERM_PARTS = [
  ['n', 'i', 'g', 'g', 'e', 'r'],
  ['n', 'i', 'g', 'g', 'a'],
  ['k', 'i', 'k', 'e'],
  ['s', 'p', 'i', 'c'],
  ['c', 'h', 'i', 'n', 'k'],
  ['f', 'a', 'g', 'g', 'o', 't'],
  ['r', 'e', 't', 'a', 'r', 'd'],
  ['f', 'u', 'c', 'k'],
  ['s', 'h', 'i', 't'],
  ['b', 'i', 't', 'c', 'h'],
  ['a', 's', 's', 'h', 'o', 'l', 'e'],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUnsafePattern(parts: string[]): RegExp {
  return new RegExp(`\\b${parts.map(escapeRegExp).join('[\\W_]*')}\\b`, 'gi');
}

const UNSAFE_TEXT_PATTERNS = UNSAFE_TERM_PARTS.map(buildUnsafePattern);

export function containsUnsafeScopeAiText(value: string | null | undefined): boolean {
  const text = String(value ?? '');
  return UNSAFE_TEXT_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function sanitizeScopeAiVisibleText(value: string | null | undefined): string {
  let next = String(value ?? '');
  for (const pattern of UNSAFE_TEXT_PATTERNS) {
    pattern.lastIndex = 0;
    next = next.replace(pattern, '[redacted]');
  }

  return next
    .replace(/(?:\[redacted\][ \t]*){2,}/gi, '[redacted] ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

export function sanitizeScopeAiProviderQuery(value: string | null | undefined): string {
  return sanitizeScopeAiVisibleText(value)
    .replace(/\[redacted\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
