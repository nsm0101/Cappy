/**
 * Format a past Date as a human-friendly relative string.
 *
 * Examples:
 *   formatRelativeTime(now - 30s)   → "just now"
 *   formatRelativeTime(now - 5m)    → "5 min ago"
 *   formatRelativeTime(now - 4h10m) → "4h 10m ago"
 *   formatRelativeTime(now - 1d)    → "yesterday"
 *   formatRelativeTime(now - 3d)    → "3 days ago"
 *   formatRelativeTime(now - 14d)   → "Jun 15"
 */
export const formatRelativeTime = (
  value: Date | string | null | undefined,
  now: Date = new Date(),
): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    return 'in the future';
  }
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  const remainderMin = minutes - hours * 60;
  if (hours < 24) {
    return remainderMin > 0 ? `${hours}h ${remainderMin}m ago` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/**
 * Format a future Date as time-until.
 *
 * formatTimeUntil(now + 30m) → "in 30 min"
 * formatTimeUntil(now + 2h)  → "in 2h 0m"
 */
export const formatTimeUntil = (
  value: Date | string | null | undefined,
  now: Date = new Date(),
): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 'now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainderMin = minutes - hours * 60;
  return `in ${hours}h ${remainderMin}m`;
};

/**
 * Localized clock time, e.g. "9:47 PM" or "21:47" depending on locale.
 */
export const formatClockTime = (value: Date | string): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
