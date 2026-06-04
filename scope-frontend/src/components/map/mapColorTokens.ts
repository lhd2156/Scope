export function readCssToken(tokenName: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
}

export function readMapColorToken(tokenName: string, fallback: string): string {
  return readCssToken(tokenName) || fallback;
}
