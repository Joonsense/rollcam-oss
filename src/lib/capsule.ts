// "1년 뒤의 나에게": a sealed line written on the day, beside the memo, that
// stays hidden until the same date next year. That morning it is announced;
// it opens with the next shot, under "1년 전 오늘". Pure, so it is tested.

import { dayKey, daysInMonth } from './day.ts';
import { tr } from './i18n.ts';
import { HORIZON_DAYS } from './remind.ts';

export const CAPSULE_MAX = 80;
export const CAPSULE_HOUR = 9;

/** The date a capsule written on `day` opens: same date next year (Feb 29 -> Feb 28). */
export function capsuleOpensOn(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dd = Math.min(d, daysInMonth(y + 1, m - 1));
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export const capsuleOpen = (day: string, today: string) => today >= capsuleOpensOn(day);

/** Whether the letter can be read: after its opening day, or on it once today's photo is taken (it opens with the shot). */
export const capsuleRevealed = (day: string, today: string, shotToday: boolean) => today > capsuleOpensOn(day) || (today === capsuleOpensOn(day) && shotToday);

/** '2027.10.25' for the sealed line in the viewer. */
export const capsuleDate = (day: string) => capsuleOpensOn(day).replaceAll('-', '.');

/**
 * Capsules opening in the planning week, at CAPSULE_HOUR on their day, newest
 * writing first if two open the same morning (only one alert per morning).
 */
export function capsuleAlerts(now: Date, shots: { day: string; capsule: string }[], hour = CAPSULE_HOUR, shotDays: Set<string> = new Set()): { date: Date; body: string }[] {
  const byOpen = new Map<string, string>();
  for (const s of shots) {
    if (!s.capsule) continue;
    const o = capsuleOpensOn(s.day);
    const cur = byOpen.get(o);
    if (!cur || s.day > cur) byOpen.set(o, s.day);
  }
  const out: { date: Date; body: string }[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, 0, 0);
    // already shot that day: the letter is open on the camera, nothing to announce
    if (d <= now || shotDays.has(dayKey(d))) continue;
    const written = byOpen.get(dayKey(d));
    if (!written) continue;
    const years = Number(dayKey(d).slice(0, 4)) - Number(written.slice(0, 4));
    out.push({
      date: d,
      body: tr(`${years}년 전 오늘의 내가 남긴 편지가 도착했어요 · 오늘 한 장을 찍으면 열려요`, `A letter from you ${years === 1 ? 'a year' : `${years} years`} ago today has arrived · it opens with today's photo`, `${years}年前の今日のあなたからの手紙が届きました · 今日の一枚を撮ると開きます`),
    });
  }
  return out;
}

/** The capsule to announce on the camera before today's shot: last year's, open today. */
export function capsuleWaiting<T extends { day: string; capsule: string }>(today: string, get: (day: string) => T | null): T | null {
  const [y, m, d] = today.split('-').map(Number);
  // a Feb 28 in a common year also opens a Feb 29 capsule
  const days = [`${y - 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`];
  if (m === 2 && d === 28 && daysInMonth(y, 1) === 28) days.push(`${y - 1}-02-29`);
  // newest first, the same letter the morning notification announced (capsuleAlerts)
  for (const k of days.reverse()) {
    const s = get(k);
    if (s?.capsule && capsuleOpensOn(s.day) === today) return s;
  }
  return null;
}
