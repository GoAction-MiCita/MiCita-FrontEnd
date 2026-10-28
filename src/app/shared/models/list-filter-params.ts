/** Longest name filter a list accepts (same limit as the backend). */
export const NAME_FILTER_MAX_LENGTH = 100;

/** Name filter read from the URL: trimmed and capped, since the URL can be tampered with. */
export function capName(value: string | null | undefined): string {
  return (value ?? '').trim().slice(0, NAME_FILTER_MAX_LENGTH);
}

/** `"a, b,,a"` → `['a', 'b']`: trimmed, without blanks or repeats, in their first order. */
export function splitIds(value: string | null | undefined): readonly string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== ''),
    ),
  ];
}

/** Same ids in the same order (the order they have in the URL). */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
