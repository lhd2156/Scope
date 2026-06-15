export function normalizeSuggestionKey(suggestion: string): string {
  return suggestion
    .replace(/\s+/g, ' ')
    .replace(/[?!.\s]+$/g, '')
    .trim()
    .toLowerCase();
}

export function mergeUniqueSuggestions(...groups: string[][]): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  groups.flat().forEach((suggestion) => {
    const normalized = suggestion.replace(/\s+/g, ' ').trim();
    const key = normalizeSuggestionKey(normalized);
    if (!normalized || seen.has(key)) {
      return;
    }

    seen.add(key);
    suggestions.push(normalized);
  });

  return suggestions;
}
