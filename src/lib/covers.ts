// A month's cover in the year view, the year card and the year share image:
// its latest print unless one was picked in the photo viewer ("이 달 표지로").
// Pure; picks are kept as kv `cover:YYYY-MM` = 'YYYY-MM-DD'.

import type { YearSummary } from './stats.ts';

export const coverKey = (month: string) => `cover:${month}`;

/** The summary with picked covers swapped in, when the picked day still has a photo in `shots`. */
export function withCovers<T extends { day: string }>(y: YearSummary<T>, shots: T[], picked: (month: string) => string): YearSummary<T> {
  const byDay = new Map(shots.map((s) => [s.day, s]));
  return {
    ...y,
    months: y.months.map((m) => {
      const day = picked(m.month);
      const s = day && day.startsWith(m.month) ? byDay.get(day) : undefined;
      return s ? { ...m, cover: s } : m;
    }),
  };
}
