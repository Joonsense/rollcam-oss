// When the year-end card ("올해의 롤") comes up: once, on the first open from
// Dec 15 for this year, or in the first two weeks of January for the year that
// just ended, if that year has at least a few photos.

export const RECAP_MIN_SHOTS = 3;

/** The year to show, or null. `seen(y)` and `count(y)` read the store. */
export function recapYear(now: Date, seen: (year: number) => boolean, count: (year: number) => number): number | null {
  const m = now.getMonth();
  const d = now.getDate();
  const year = m === 11 && d >= 15 ? now.getFullYear() : m === 0 && d <= 14 ? now.getFullYear() - 1 : null;
  if (year === null || seen(year)) return null;
  return count(year) >= RECAP_MIN_SHOTS ? year : null;
}
