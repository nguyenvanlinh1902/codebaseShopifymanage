/** Get today's date string (YYYY-MM-DD) in the given timezone */
export function getTodayStr(timezone) {
  if (!timezone) return new Date().toISOString().split('T')[0];
  try {
    return new Intl.DateTimeFormat('en-CA', {timeZone: timezone}).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysAgo(n, timezone) {
  const today = new Date(getTodayStr(timezone) + 'T00:00:00');
  today.setDate(today.getDate() - n);
  return toDateStr(today);
}

/**
 * Resolve a period key to {from, to} date strings (YYYY-MM-DD) in the given timezone.
 * Used by both Dashboard and Analytics to ensure consistent date boundaries.
 */
export function resolvePeriodDates(period, timezone) {
  const today = getTodayStr(timezone);
  const now = new Date(today + 'T00:00:00');

  switch (period) {
    case 'today':
    case '-1d':
      return {from: today, to: today};
    case '7d':
    case '-7d':
      return {from: daysAgo(7, timezone), to: today};
    case '30d':
    case '-30d':
      return {from: daysAgo(30, timezone), to: today};
    case '90d':
    case '-90d':
      return {from: daysAgo(90, timezone), to: today};
    case '365d':
    case '-365d':
      return {from: daysAgo(365, timezone), to: today};
    case 'month':
    case 'startOfMonth(0m)':
      return {from: today.slice(0, 8) + '01', to: today};
    case 'year':
    case 'startOfYear(0y)':
      return {from: now.getFullYear() + '-01-01', to: today};
    default:
      return {from: daysAgo(30, timezone), to: today};
  }
}
