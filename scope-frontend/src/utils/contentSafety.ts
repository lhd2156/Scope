const LEET_REPLACEMENTS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
};

const BLOCKED_TERMS = new Set([
  'chink',
  'coon',
  'fag',
  'faggot',
  'gook',
  'kike',
  'kill all',
  'kill yourself',
  'kys',
  'nigga',
  'nigger',
  'rape',
  'retard',
  'spic',
  'tranny',
  'wetback',
  'scope test blocked slur',
]);

const TOKEN_BLOCKED_TERMS = new Set([...BLOCKED_TERMS].filter((term) => !term.includes(' ')));

export interface ContentSafetyResult {
  clean: boolean;
  field?: string;
  message?: string;
}

function normalizeSafetyText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[013457@$]/g, (match) => LEET_REPLACEMENTS[match] ?? match);
}

function tokenize(value: unknown): string[] {
  return normalizeSafetyText(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function containsBlockedTerm(value: unknown): boolean {
  const tokens = tokenize(value);
  if (!tokens.length) {
    return false;
  }

  if (tokens.some((token) => TOKEN_BLOCKED_TERMS.has(token))) {
    return true;
  }

  const phrase = tokens.join(' ');
  return [...BLOCKED_TERMS].some((term) => term.includes(' ') && phrase.includes(term));
}

export function validateContentSafety(fields: Array<{ field: string; value: unknown }>): ContentSafetyResult {
  for (const entry of fields) {
    const values = Array.isArray(entry.value) ? entry.value : [entry.value];
    if (values.some((value) => containsBlockedTerm(value))) {
      return {
        clean: false,
        field: entry.field,
        message: 'This contains a blocked slur or hate term.',
      };
    }
  }

  return { clean: true };
}
