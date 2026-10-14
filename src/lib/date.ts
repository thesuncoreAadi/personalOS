/**
 * Date helpers. Everything is expressed as local calendar days (YYYY-MM-DD) so that
 * deadline maths never shifts across timezones the way `Date.parse('YYYY-MM-DD')`
 * (UTC) does when compared against `new Date()` (local).
 */

export const DAY_MS = 86_400_000;

export function todayISO(now: Date = new Date()): string {
  return toISO(now);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isValidISO(iso?: string | null): boolean {
  if (!iso) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISO(iso);
  return !Number.isNaN(d.getTime()) && toISO(d) === iso;
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

/** Whole days from `from` to `to`. Positive = future. */
export function diffDays(fromISO: string, toISOStr: string): number {
  const a = parseISO(fromISO).getTime();
  const b = parseISO(toISOStr).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function daysUntil(iso: string, now: Date = new Date()): number {
  if (!isValidISO(iso)) return Number.POSITIVE_INFINITY;
  return diffDays(todayISO(now), iso);
}

/** Monday-based start of week. */
export function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  return addDays(iso, -dow);
}

export function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

export function weekKey(iso: string): string {
  return startOfWeek(iso);
}

export function lastNDays(n: number, now: Date = new Date()): string[] {
  const t = todayISO(now);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(addDays(t, -i));
  return out;
}

export function lastNWeeks(n: number, now: Date = new Date()): string[] {
  const t = startOfWeek(todayISO(now));
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(addDays(t, -i * 7));
  return out;
}

export function fmtDate(iso?: string): string {
  if (!iso || !isValidISO(iso)) return '—';
  return parseISO(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtShort(iso?: string): string {
  if (!iso || !isValidISO(iso)) return '—';
  return parseISO(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function fmtDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Human deadline label: "today", "tomorrow", "in 4 days", "3 days overdue". */
export function deadlineLabel(iso: string | undefined, now: Date = new Date()): string {
  if (!iso || !isValidISO(iso)) return 'no deadline';
  const d = daysUntil(iso, now);
  if (d === 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  if (d === -1) return '1 day overdue';
  if (d < 0) return `${Math.abs(d)} days overdue`;
  return `in ${d} days`;
}

export type DeadlineTone = 'none' | 'ok' | 'soon' | 'critical' | 'overdue';

export function deadlineTone(
  iso: string | undefined,
  now: Date = new Date(),
  soonDays = 7,
  criticalDays = 2,
): DeadlineTone {
  if (!iso || !isValidISO(iso)) return 'none';
  const d = daysUntil(iso, now);
  if (d < 0) return 'overdue';
  if (d <= criticalDays) return 'critical';
  if (d <= soonDays) return 'soon';
  return 'ok';
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function pct(v: number): string {
  return `${Math.round(clamp(v, 0, 1) * 100)}%`;
}

export function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
