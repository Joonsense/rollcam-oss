// The current run of days shot in a row, ending today, and the milestones
// worth a mark when today's shot reaches one. Pure, so it is tested.

import { addDays } from './day.ts';
import { tr } from './i18n.ts';

export const MILESTONES = [7, 30, 50, 100, 200, 365, 500, 730, 1000] as const;

/** Days in a row ending on `today` (0 if today has no shot). `has` looks a day up. */
export function currentStreak(today: string, has: (day: string) => boolean, cap = 5000): number {
  let n = 0;
  let d = today;
  while (n < cap && has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** The mark for a run of `n` days, when n is exactly a milestone. */
export function milestoneLine(n: number): string | null {
  if (!(MILESTONES as readonly number[]).includes(n)) return null;
  if (n === 7) return tr('연속 7일째 · 일주일을 빠짐없이', '7 days in a row · a full week', '7日連続 · 一週間欠かさず');
  if (n === 30) return tr('연속 30일째 · 한 달을 빠짐없이', '30 days in a row · a full month', '30日連続 · ひと月欠かさず');
  if (n === 365) return tr('연속 365일째 · 1년을 하루도 빠짐없이', '365 days in a row · a whole year', '365日連続 · 一年一日も欠かさず');
  if (n === 730) return tr('연속 730일째 · 2년을 하루도 빠짐없이', '730 days in a row · two whole years', '730日連続 · 二年一日も欠かさず');
  return tr(`연속 ${n}일째`, `${n} days in a row`, `${n}日連続`);
}
