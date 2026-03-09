/**
 * Format a date string using the user's selected timezone.
 * Falls back to browser default if no timezone is set.
 */
export function formatDate(dateStr, timezone, options = {}) {
  if (!dateStr) return '';
  const defaults = {month: 'short', day: 'numeric', ...options};
  const opts = timezone ? {...defaults, timeZone: timezone} : defaults;
  return new Date(dateStr).toLocaleDateString('en-US', opts);
}

export function formatDateTime(dateStr, timezone, options = {}) {
  if (!dateStr) return '';
  const defaults = {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...options};
  const opts = timezone ? {...defaults, timeZone: timezone} : defaults;
  return new Date(dateStr).toLocaleString('en-US', opts);
}
