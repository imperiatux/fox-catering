import { getCutoffOverride } from './cutoff-override';

const MAX_NICKNAME = 40;
const MAX_FIELD = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeNickname(raw: string): string {
  return raw.trim().slice(0, MAX_NICKNAME);
}

export function validateNickname(nickname: string): string | null {
  const n = nickname.trim();
  if (n.length < 1) return 'Nickname is required';
  if (n.length > MAX_NICKNAME) return `Nickname must be at most ${MAX_NICKNAME} characters`;
  return null;
}

export function validateMenuVariant(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'Menu variant must be an object';
  const { main, secondary } = v as Record<string, unknown>;
  if (typeof main !== 'string' || main.trim().length === 0) return 'main is required';
  if (main.length > MAX_FIELD) return `main must be at most ${MAX_FIELD} characters`;
  if (typeof secondary !== 'string' || secondary.trim().length === 0) return 'secondary is required';
  if (secondary.length > MAX_FIELD) return `secondary must be at most ${MAX_FIELD} characters`;
  return null;
}

export function validateDate(date: string): string | null {
  if (!DATE_RE.test(date)) return 'Date must be in YYYY-MM-DD format';
  const d = new Date(date + 'T00:00:00Z');
  if (isNaN(d.getTime())) return 'Invalid date';
  // Verify round-trip to catch dates like 2024-02-30
  const [y, m, day] = date.split('-').map(Number);
  if (d.getUTCFullYear() !== y || d.getUTCMonth() + 1 !== m || d.getUTCDate() !== day) {
    return 'Invalid calendar date';
  }
  return null;
}

/** Read cutoff, respecting any runtime admin override. Defaults to env vars or 10:30. */
export function getCutoff(): { hour: number; minute: number; cutoffEnabled: boolean } {
  const override = getCutoffOverride();

  // Admin has disabled the cutoff entirely
  if (override !== null && !override.enabled) {
    return { hour: 23, minute: 59, cutoffEnabled: false };
  }

  // Admin has set a specific override time
  if (override !== null && override.enabled) {
    return { hour: override.hour, minute: override.minute, cutoffEnabled: true };
  }

  // Default: read from env vars
  const hour = parseInt(process.env.CUTOFF_HOUR ?? '10', 10);
  const minute = parseInt(process.env.CUTOFF_MINUTE ?? '30', 10);
  return {
    hour: isNaN(hour) ? 10 : hour,
    minute: isNaN(minute) ? 30 : minute,
    cutoffEnabled: true,
  };
}

export function isCutoffPassed(date: string): boolean {
  const { hour: cutoffHour, minute: cutoffMinute, cutoffEnabled } = getCutoff();
  if (!cutoffEnabled) return false;
  const now = new Date();
  // Get current local time parts in Europe/Bucharest
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  const localYear = get('year');
  const localMonth = get('month');
  const localDay = get('day');
  const localHour = get('hour');
  const localMinute = get('minute');

  const localDateStr = `${localYear}-${String(localMonth).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`;

  if (localDateStr < date) return false;
  if (localDateStr > date) return true;
  // Same day — check if at or past cutoff
  return localHour > cutoffHour || (localHour === cutoffHour && localMinute >= cutoffMinute);
}
