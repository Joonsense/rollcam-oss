// "On this day": after today's shot, the print from the same date a year (or
// years) ago comes back up next to it; with none, the same date last month.
// Pure so it can be tested; the caller looks the days up in the store.

import { daysInMonth } from './day.ts';
import { tr } from './i18n.ts';

export const ECHO_YEARS = 10;

export type EchoDay = { day: string; label: string };

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Days to look up for `today` ('YYYY-MM-DD'), nearest first: 1..ECHO_YEARS
 * years back, then one month back. Feb 29 falls back to Feb 28 in common
 * years; a month-back day that doesn't exist (Mar 31 -> Feb) is skipped.
 */
export function echoDays(today: string): EchoDay[] {
  const [y, m, d] = today.split('-').map(Number);
  const out: EchoDay[] = [];
  for (let n = 1; n <= ECHO_YEARS; n++) {
    const yy = y - n;
    const dd = Math.min(d, daysInMonth(yy, m - 1));
    out.push({ day: `${yy}-${pad(m)}-${pad(dd)}`, label: tr(`${n}년 전 오늘`, n === 1 ? 'A year ago today' : `${n} years ago today`, `${n}年前の今日`) });
  }
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  if (d <= daysInMonth(py, pm - 1)) out.push({ day: `${py}-${pad(pm)}-${pad(d)}`, label: tr('한 달 전 오늘', 'A month ago today', '1か月前の今日') });
  return out;
}

/** First candidate that has a photo, via `get` (a store lookup). */
export function findEcho<T>(today: string, get: (day: string) => T | null): { label: string; shot: T } | null {
  for (const c of echoDays(today)) {
    const shot = get(c.day);
    if (shot) return { label: c.label, shot };
  }
  return null;
}

/** Like findEcho, but whole years only (the widget's empty frame: a month back is too often to feel rare). */
export function findYearEcho<T>(today: string, get: (day: string) => T | null): { label: string; years: number; shot: T } | null {
  const days = echoDays(today).slice(0, ECHO_YEARS);
  for (let i = 0; i < days.length; i++) {
    const shot = get(days[i].day);
    if (shot) return { label: days[i].label, years: i + 1, shot };
  }
  return null;
}

/** The same month and day in the roll's other years, newest first (a photo viewer's "같은 날" row). */
export const sameDate = <T extends { day: string }>(day: string, roll: T[]): T[] =>
  roll.filter((s) => s.day !== day && s.day.slice(5) === day.slice(5)).sort((a, b) => (a.day < b.day ? 1 : -1));
