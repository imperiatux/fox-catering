const TZ = 'Europe/Bucharest';

/** Returns today's date as "YYYY-MM-DD" in Europe/Bucharest timezone. */
export function getTodayBucharest(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Returns true if the given "YYYY-MM-DD" date falls on a Saturday or Sunday.
 *  To bypass for testing, run in the browser console:
 *    localStorage.setItem('fox_disable_weekend_check', 'true')
 *  To restore: localStorage.removeItem('fox_disable_weekend_check') */
export function isWeekend(date: string): boolean {
  try {
    if (localStorage.getItem('fox_disable_weekend_check') === 'true') return false;
  } catch { /* ignore */ }
  // Parse as UTC noon to avoid timezone-at-midnight edge cases
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

/** Client-side cutoff check (mirrors api/lib/validation.ts isCutoffPassed). Server is authoritative. */
export function isCutoffPassed(date: string, cutoffHour = 10, cutoffMinute = 30): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');

  const localYear = get('year');
  const localMonth = get('month');
  const localDay = get('day');
  const localHour = get('hour');
  const localMinute = get('minute');

  const localDateStr = `${localYear}-${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`;

  if (localDateStr < date) return false;
  if (localDateStr > date) return true;
  return localHour > cutoffHour || (localHour === cutoffHour && localMinute >= cutoffMinute);
}

/** Returns minutes remaining until the cutoff, or 0 if cutoff has passed. */
export function minutesUntilCutoff(cutoffHour = 10, cutoffMinute = 30): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const h = get('hour');
  const m = get('minute');

  const nowMinutes = h * 60 + m;
  const cutoffMinutes = cutoffHour * 60 + cutoffMinute;
  return Math.max(0, cutoffMinutes - nowMinutes);
}

/**
 * Formats "YYYY-MM-DD" as a human-readable string like "Monday, 14 July 2025".
 */
export function formatDateDisplay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}
