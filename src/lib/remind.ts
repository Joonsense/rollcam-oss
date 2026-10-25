// Local notifications (spec §6): 18:00 "today's roll is still empty", plus the
// month's roll coming back on the 1st, plus a heads-up before a moment whose
// forecast film the film book is still missing.
// A repeating daily trigger can't skip days that already have a photo, so we
// keep a rolling week of one-off reminders and re-plan on every app open/shot.

import { addDays, dayKey } from './day.ts';
import { FILM_NAMES, GOLDEN_MIN, seasonsAt, type FilmId } from './film.ts';
import { isEn, isJa, monthDay, tr } from './i18n.ts';

export const REMIND_HOUR = 18;

/**
 * The evening reminder follows the user: an hour after the hour they usually
 * shoot (median of the last 60 days, with at least 7 photos), kept between
 * 17:00 and 21:00. Too few photos: 18:00.
 */
export function reminderHour(shots: { day: string; takenAt: number }[], now: Date): number {
  const since = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60));
  const hours = shots
    .filter((s) => s.day >= since)
    .map((s) => new Date(s.takenAt).getHours())
    .sort((a, b) => a - b);
  if (hours.length < 7) return REMIND_HOUR;
  const mid = hours[Math.floor((hours.length - 1) / 2)];
  return Math.min(21, Math.max(17, mid + 1));
}
export const HORIZON_DAYS = 7;

/** Reminder times for the next `HORIZON_DAYS` days, skipping shot days and past times. */
export function reminderDates(now: Date, shotDays: Set<string>, hour = REMIND_HOUR): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, 0, 0);
    if (d.getTime() <= now.getTime()) continue;
    if (shotDays.has(dayKey(d))) continue;
    out.push(d);
  }
  return out;
}

export const ROLL_DONE_HOUR = 10;

/** When the month's roll "comes back from the lab": the 1st of next month, 10:00. */
export function rollDoneDate(now: Date, hour = ROLL_DONE_HOUR): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, hour, 0, 0);
}

// Android delivers these inexactly, up to an hour late (no exact-alarm
// permission), so an hour's lead still lands before the moment.
export const ALERT_LEAD_MIN = 60;

export type OutlookAlert = { date: Date; body: string; film?: FilmId };

/**
 * The earliest forecast moment of `day` that brings a film missing from the
 * book, `ALERT_LEAD_MIN` before it, or null (day already shot, nothing new,
 * or every such moment is past).
 */
export function outlookAlert(
  now: Date,
  day: string,
  slots: { film: FilmId; labels: string[]; at: Date[] }[],
  collected: Set<FilmId>,
  shotDays: Set<string>,
): OutlookAlert | null {
  if (shotDays.has(day)) return null;
  let best: { date: Date; film: FilmId; label: string } | null = null;
  for (const s of slots) {
    if (collected.has(s.film)) continue;
    s.at.forEach((t, i) => {
      const date = new Date(t.getTime() - ALERT_LEAD_MIN * 60000);
      if (date > now && (!best || date < best.date)) best = { date, film: s.film, label: s.labels[i] };
    });
  }
  if (!best) return null;
  const { date, film, label } = best as { date: Date; film: FilmId; label: string };
  // worded for when it arrives, not for when it was planned
  const today = day === dayKey(date);
  const when = isJa() ? `${today ? '今日' : '明日'}の${label}` : isEn() ? (today ? WHEN_TODAY : WHEN_TOMORROW)[label] ?? label : `${today ? '오늘' : '내일'} ${label}`;
  const body =
    film === 'first-snow'
      ? tr(`올겨울 첫눈 예보 · ${when}, 시즌 한정 필름 First Snow 가 감겨요`, `First snow in the forecast · ${when} loads the seasonal film First Snow`, `初雪の予報 · ${when}、季節限定フィルム First Snow が入ります`)
      : tr(`도감에 없는 필름이 와요 · ${when} ${FILM_NAMES[film]}`, `A film missing from your book · ${FILM_NAMES[film]}, ${when}`, `図鑑にないフィルムが来ます · ${when} ${FILM_NAMES[film]}`);
  return { date, body, film };
}

// outlook slot labels (lib/outlook.ts) as English phrases
const WHEN_TODAY: Record<string, string> = { Morning: 'this morning', Midday: 'around midday', Afternoon: 'this afternoon', Dusk: 'at dusk today', Evening: 'this evening' };
const WHEN_TOMORROW: Record<string, string> = { Morning: 'tomorrow morning', Midday: 'tomorrow around midday', Afternoon: 'tomorrow afternoon', Dusk: 'tomorrow at dusk', Evening: 'tomorrow evening' };

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export type DayAlert = { date: Date; body: string; golden: boolean };

/** Days in a row a reminder puts at stake before it says so. */
export const STREAK_STAKE = 3;

/**
 * The optional last call before the day closes: set for 22:00 so that an
 * hour-late Android delivery still lands before midnight, and worded without
 * a clock time.
 */
export const LAST_CALL_HOUR = 22;

// the evening line, a different one each day so it doesn't read as a template
const EMPTY: [string, string, string][] = [
  ['오늘 롤 아직 비어 있어요', "Today's roll is still empty", '今日のロールはまだ空いています'],
  ['오늘의 한 칸이 기다려요', "Today's frame is waiting", '今日の一コマが待っています'],
  ['필름 한 칸 남아 있어요 · 오늘 것', "One frame left, and it's today's", '今日の一コマが残っています'],
  ['지금 하늘이 어떤 필름일지 볼까요', "Let's see which film today's sky loads", 'いまの空はどのフィルムでしょう'],
  ['자정이 지나면 오늘 칸은 하늘 색으로 남아요', "After midnight today's frame keeps only the sky's colour", '0時を過ぎると今日のコマは空の色だけになります'],
];

/** The day's "still empty" line, picked by date so it changes daily but stays put on re-plans. */
export function emptyLine(day: string): string {
  const n = Number(day.slice(0, 4)) * 372 + Number(day.slice(5, 7)) * 31 + Number(day.slice(8, 10));
  const l = EMPTY[n % EMPTY.length];
  return tr(l[0], l[1], l[2]);
}

/** Shot days in a row ending the day before `day`. */
export function runBefore(day: string, shotDays: Set<string>): number {
  let n = 0;
  let d = addDays(day, -1);
  while (shotDays.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/**
 * The week's "still empty" alerts, one per unshot day. With `golden` on, a
 * day's alert moves from 18:00 to before its sunset, early enough that even an
 * hour-late Android delivery lands before the Golden Roll window
 * (sunset - GOLDEN_MIN) opens. Falls back to 18:00 when that moment is past,
 * the sun time is unknown, or the day is special (Party Flash outranks light).
 */
export function dailyAlerts(
  now: Date,
  shotDays: Set<string>,
  opts: { golden: boolean; sunset: (day: Date) => Date | null; special: (day: Date) => boolean; hour?: number; lastCall?: boolean; echo?: (day: string) => { label: string; film: string } | null },
): DayAlert[] {
  const out: DayAlert[] = [];
  for (const six of reminderDates(new Date(now.getFullYear(), now.getMonth(), now.getDate()), shotDays, opts.hour)) {
    // a run of 3+ days up to yesterday is on the line today
    const run = runBefore(dayKey(six), shotDays);
    const stake = run >= STREAK_STAKE ? tr(` · 찍으면 연속 ${run + 1}일째`, ` · shoot to make it ${run + 1} days in a row`, ` · 撮れば${run + 1}日連続`) : '';
    const set = opts.golden && !opts.special(six) ? opts.sunset(six) : null;
    const at = set ? new Date(set.getTime() - (GOLDEN_MIN + ALERT_LEAD_MIN) * 60000) : null;
    if (set && at && at > now && dayKey(at) === dayKey(six)) {
      out.push({ date: at, golden: true, body: tr(`곧 해가 져요 · ${hhmm(set)} 앞뒤로 Golden Roll 이 감겨요${stake}`, `Sunset soon · Golden Roll loads around ${hhmm(set)}${stake}`, `もうすぐ日没 · ${hhmm(set)} 前後に Golden Roll が入ります${stake}`) });
    } else if (six > now) {
      // a print from this date in an earlier year says it better than the rotating line
      const e = opts.echo?.(dayKey(six));
      const line = e ? tr(`${e.label}엔 ${e.film} · 오늘 칸은 아직 비어 있어요`, `${e.label}: ${e.film} · today's frame is still empty`, `${e.label}は ${e.film} · 今日のコマはまだ空いています`) : emptyLine(dayKey(six));
      out.push({ date: six, golden: false, body: `${line}${stake}` });
    }
    // a last call an hour before midnight, for whoever set it in Settings
    const last = new Date(six.getFullYear(), six.getMonth(), six.getDate(), LAST_CALL_HOUR, 0, 0);
    // not right on the heels of an evening alert set for 21:00 or later
    if (opts.lastCall && last > now && six.getHours() < LAST_CALL_HOUR - 1) {
      out.push({ date: last, golden: false, body: tr(`곧 자정 · 오늘 칸이 아직 비어 있어요${stake}`, `Midnight soon · today's frame is still empty${stake}`, `もうすぐ0時 · 今日のコマはまだ空いています${stake}`) });
    }
  }
  return out;
}

export const SEASON_HOUR = 9;

/**
 * 09:00 on the first day of a seasonal film's window, when the film book is
 * still missing it and that day falls inside the planning week. Worded for the
 * morning it arrives.
 */
export function seasonAlerts(now: Date, collected: Set<FilmId>, hour = SEASON_HOUR, shotDays: Set<string> = new Set(), lat?: number | null): OutlookAlert[] {
  const out: OutlookAlert[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, 0, 0);
    if (d <= now || shotDays.has(dayKey(d))) continue;
    const md = dayKey(d).slice(5);
    for (const sx of seasonsAt(lat)) {
      if (sx.from !== md || collected.has(sx.film)) continue;
      const [tm, td] = sx.to.split('-').map(Number);
      out.push({
        date: d,
        film: sx.film,
        body: tr(`오늘부터 시즌 한정 ${FILM_NAMES[sx.film]} · 맑은 낮이면 감겨요 (${tm}월 ${td}일까지)`, `Seasonal ${FILM_NAMES[sx.film]} starts today · it loads on a clear day (until ${monthDay(tm, td)})`, `今日から季節限定 ${FILM_NAMES[sx.film]} · 晴れた昼に入ります(${tm}月${td}日まで)`),
      });
    }
  }
  return out;
}

/** Season alerts minus any whose film the forecast alert already announces that day. */
export function withoutRepeats(season: OutlookAlert[], outlook: OutlookAlert | null): OutlookAlert[] {
  if (!outlook?.film) return season;
  return season.filter((a) => !(a.film === outlook.film && dayKey(a.date) === dayKey(outlook.date)));
}

/** Settings' reminder hour: '' follows the user (reminderHour), else a fixed 17..21. */
export const HOUR_CHOICES = ['', '18', '20', '21'] as const;

export function pickedHour(setting: string, auto: number): number {
  const h = Number(setting);
  return setting && Number.isInteger(h) && h >= 17 && h <= 21 ? h : auto;
}
