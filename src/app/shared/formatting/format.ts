/** Placeholder shown for an empty value in tables (HU-08: "vacío como —"). */
export const EMPTY_VALUE = '—';

/**
 * Whole number with a dot every 3 digits: `45000` → `45.000`, `1500` → `1.500`.
 * Not Intl: Spanish CLDR data skips grouping for 4-digit numbers in some browsers (`1500`).
 */
export function formatThousands(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Colombian pesos without decimals: `45000` → `$ 45.000`. */
export function formatCop(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? EMPTY_VALUE
    : `$ ${formatThousands(value)}`;
}

/** Minutes as `45 min`, `1 h` or `1 h 30 min`. Non-positive or missing values render `—`. */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) {
    return EMPTY_VALUE;
  }
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Up to two uppercase initials for an avatar: `Ana López` → `AL`. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part.charAt(0).toLocaleUpperCase('es-CO')).join('') || '?';
}
