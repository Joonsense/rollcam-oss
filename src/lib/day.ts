// Local-calendar helpers. Everything keys off the device's local date, so the
// "one shot a day" lock resets at local midnight (spec §3.1).

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' in the device's local time zone. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM' in local time. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Shift a 'YYYY-MM' key by n months. */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}

/** Milliseconds until the next local midnight (for re-arming the shutter). */
export function msUntilMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** 'YYYY-MM-DD' moved by `n` calendar days. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
