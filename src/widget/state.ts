// What the home screen widget shows, worked out from the roll alone so the
// widget's background task (no app UI running) can decide it at any hour:
// after midnight it flips back to an empty frame without the app being opened.

import { daysInMonth, dayKey } from '../lib/day.ts';
import { isLucky } from '../lib/lucky.ts';
import { quote, tr, whyText } from '../lib/i18n.ts';

export type WidgetShot = { day: string; film: string; reason: string; memo?: string; takenAt?: number };

export type WidgetState = {
  day: string;
  frame: number; // day of the month = frame number on the roll
  month: number; // 1..12
  shots: number; // photos this month, today included
  days: number; // frames in this month
  today: WidgetShot | null;
};

export function widgetState(now: Date, monthShots: WidgetShot[]): WidgetState {
  const day = dayKey(now);
  return {
    day,
    frame: now.getDate(),
    month: now.getMonth() + 1,
    shots: monthShots.filter((s) => s.day <= day).length,
    days: daysInMonth(now.getFullYear(), now.getMonth()),
    today: monthShots.find((s) => s.day === day) ?? null,
  };
}

/** "비 오는 오후 — 'Rainy Mono'" -> "비 오는 오후" (the widget shows the film name on its own line). */
export const whyOnly = whyText;

/** The line under the film name: the day's own memo if there is one, else why the film loaded. */
export const widgetLine = (shot: WidgetShot) => (shot.memo ? quote(shot.memo) : whyOnly(shot.reason));

/** Hours and minutes until the next roll, '3시간 12분' / '45분'. */
export function untilNext(now: Date): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const m = Math.ceil((next.getTime() - now.getTime()) / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? tr(`${h}시간 ${m % 60}분`, `${h}h ${m % 60}m`, `${h}時間${m % 60}分`) : tr(`${m}분`, `${m}m`, `${m}分`);
}

export type MonthDot = { day: number; state: 'shot' | 'missed' | 'today' | 'future'; film: string | null; lucky?: true };

/**
 * This month as calendar rows for the small widget: Sunday first, `null` for
 * the blanks before the 1st and after the last day, 7 per row.
 */
export function monthDots(now: Date, monthShots: WidgetShot[]): (MonthDot | null)[][] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const n = daysInMonth(y, m);
  const films = new Map(monthShots.map((s) => [Number(s.day.slice(8)), s.film]));
  const lucky = new Set(monthShots.filter((s) => s.takenAt !== undefined && isLucky(s.takenAt)).map((s) => Number(s.day.slice(8))));
  const cells: (MonthDot | null)[] = Array.from({ length: new Date(y, m, 1).getDay() }, () => null);
  for (let d = 1; d <= n; d++) {
    const film = films.get(d) ?? null;
    cells.push({ day: d, film, state: film && d <= today ? 'shot' : d === today ? 'today' : d < today ? 'missed' : 'future', ...(lucky.has(d) ? { lucky: true as const } : {}) });
  }
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
}

/**
 * "내일 아침 Rainy Mono" for the widget once today is shot, from the first
 * forecast slot (`allDay` when one film covers the day); ✦ marks a film the
 * book is missing.
 */
export function tomorrowLine(slot: { labels: string[] } | null | undefined, filmName: string, collected: boolean, allDay: boolean): string {
  if (!slot) return '';
  const when = allDay ? tr('하루 종일', 'all day', '一日中') : (slot.labels[0] ?? '');
  const film = `${collected ? '' : '✦ '}${filmName}`;
  return tr(`내일 ${when} ${film}`, `Tomorrow ${when.toLowerCase()}: ${film}`, `明日の${when} ${film}`);
}

/** Under "오늘 롤 비어 있음" when the frame shows a past year's print: '1년 전 오늘 · Golden Roll · 오늘 찍으면 나란히'. */
export const echoLine = (label: string, film: string) => tr(`${label} · ${film} · 오늘 찍으면 나란히`, `${label} · ${film} · shoot today to pair them`, `${label} · ${film} · 今日撮ると並びます`);

/** What TalkBack says for "오늘의 롤": the day's film and line, or that it's empty. */
export function todayLabel(state: WidgetState, film: string | null): string {
  const head = tr(`오늘의 롤, ${state.month}월 ${state.frame}일`, `Today's roll, frame ${state.frame}`, `今日のロール、${state.month}月${state.frame}日`);
  const shot = state.today;
  return shot && film
    ? `${head}, ${film}, ${widgetLine(shot)}`
    : `${head}, ${tr('아직 비어 있음, 눌러서 찍기', 'still empty, tap to shoot', 'まだ空、タップで撮影')}`;
}

/** What TalkBack says for "이번 달 롤". */
export const monthLabel = (state: WidgetState) =>
  tr(`이번 달 롤, ${state.month}월, ${state.days}칸 중 ${state.shots}장, 눌러서 롤 보기`, `This month's roll, ${state.shots} of ${state.days} frames, tap to open the roll`, `今月のロール、${state.month}月、${state.days}コマ中${state.shots}枚、タップでロールを開く`);
