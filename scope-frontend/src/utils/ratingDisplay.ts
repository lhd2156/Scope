/**
 * Portion of the star at 1-based index (1–5) filled for a 0–5 rating.
 * e.g. 4.4 → [1,1,1,1,0.4]
 */
export function starFillPortionAtIndex(rating: number, oneBasedIndex: number): number {
  if (!Number.isFinite(rating) || oneBasedIndex < 1 || oneBasedIndex > 5) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(5, rating));
  return Math.max(0, Math.min(1, clamped - (oneBasedIndex - 1)));
}
