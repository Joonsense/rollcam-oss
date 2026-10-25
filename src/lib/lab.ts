// "아침에 현상": like dropping a disposable off at the lab, a photo shot with
// this on is only seen the next morning. The film name still shows right away;
// the print waits. Pure, so it is unit tested; store.ts hides the print.

import { tr } from './i18n.ts';

/** Prints come back at 7 in the morning after the day they were shot. */
export const LAB_HOUR = 7;

/** When the print of `day` ('YYYY-MM-DD') comes back: the next day at LAB_HOUR, local time. */
export function revealAt(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + 1, LAB_HOUR);
}

/** The kv key marking a day shot while the setting was on. */
export const waitKey = (day: string) => `wait:${day}`;

/** Whether a print of `day` is still at the lab at `now`. `waited`: it was shot with the setting on. */
export const atLab = (day: string, now: Date, waited: boolean) => waited && now.getTime() < revealAt(day).getTime();

/**
 * Whether a print of `day` can still be at the lab at `now`: yesterday's or
 * later ('later' after flying west across the date line), so older days skip
 * the kv lookup.
 */
export const labDay = (day: string, now: Date): boolean => {
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return day >= `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
};

/** '내일 아침 7시 · 9시간 12분 남음' for a print at the lab (minutes rounded up). */
export function labLine(day: string, now: Date): string {
  const at = revealAt(day);
  const mins = Math.max(1, Math.ceil((at.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const left = h > 0 ? tr(`${h}시간 ${mins % 60}분`, `${h} h ${mins % 60} min`, `${h}時間${mins % 60}分`) : tr(`${mins}분`, `${mins} min`, `${mins}分`);
  const tomorrow = at.getDate() !== now.getDate();
  return tomorrow
    ? tr(`내일 아침 ${LAB_HOUR}시 현상 · ${left} 남음`, `Back from the lab at ${LAB_HOUR} am tomorrow · ${left}`, `明日の朝${LAB_HOUR}時に現像 · あと${left}`)
    : tr(`아침 ${LAB_HOUR}시 현상 · ${left} 남음`, `Back from the lab at ${LAB_HOUR} am · ${left}`, `朝${LAB_HOUR}時に現像 · あと${left}`);
}
