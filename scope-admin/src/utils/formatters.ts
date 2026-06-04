const UNAVAILABLE_LABEL = 'Not available';
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

interface LocationParts {
  city?: string | null;
  country?: string | null;
  location?: string | null;
}

function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value?: string | null): string {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : UNAVAILABLE_LABEL;
}

export function formatDateTime(value?: string | null): string {
  const date = parseDate(value);
  return date ? dateTimeFormatter.format(date) : UNAVAILABLE_LABEL;
}

export function formatNumber(value?: number | null): string {
  return numberFormatter.format(value ?? 0);
}

export function formatPercent(value?: number | null): string {
  return percentFormatter.format(value ?? 0);
}

export function formatLocation({ city, country, location }: LocationParts, fallback = 'Unknown'): string {
  const cityCountry = [city, country]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(', ');

  return cityCountry || location?.trim() || fallback;
}

export function truncateText(value: string, maxLength = 80): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}
