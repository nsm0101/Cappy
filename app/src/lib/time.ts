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

/**
 * Format a timestamp as a day heading for grouping.
 * Returns 'Today', 'Yesterday', or a formatted date like 'Mon, Jun 29'
 * based on the local calendar day of the given ISO timestamp.
 *
 * Examples:
 *   given_at = '2026-07-02T14:00:00Z', now = '2026-07-02T18:00:00Z' (same local day) → 'Today'
 *   given_at = '2026-07-01T23:00:00Z', now = '2026-07-02T02:00:00Z' (yesterday) → 'Yesterday'
 *   given_at = '2026-06-29T10:00:00Z' → 'Mon, Jun 29'
 */
export const formatDayHeading = (
  value: Date | string | null | undefined,
  now: Date = new Date(),
): string => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  // Get midnight of both dates in local time for day comparison
  const localNow = new Date(now);
  const localDate = new Date(date);

  const todayMidnight = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate());
  const dateMidnight = new Date(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
  );

  const diffMs = todayMidnight.getTime() - dateMidnight.getTime();
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';

  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
