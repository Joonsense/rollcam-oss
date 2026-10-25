// A month's (and a year's) roll in numbers, for the roll header, the "roll
// developed" card and the year view. Pure, so it is unit tested.

import { dayKey, daysInMonth } from './day.ts';
import { FILM_NAMES, type FilmId, type Weather } from './film.ts';
import { skyWord } from './sky.ts';
import { count, tr } from './i18n.ts';

type ShotLike = { day: string; film: FilmId; weather: Weather | null };

export type MonthStats = {
  shots: number;
  days: number; // days of the month that have happened (all of them once it is over)
  streak: number; // longest run of consecutive shot days
  films: number; // distinct films that loaded
  topFilm: FilmId | null;
  topWeather: { word: string; count: number } | null;
};

export function monthStats(month: string, shots: ShotLike[], today: string): MonthStats {
  const [y, m] = month.split('-').map(Number);
  const total = daysInMonth(y, m - 1);
  const days = today.slice(0, 7) > month ? total : today.slice(0, 7) < month ? 0 : Number(today.slice(8));

  const sorted = [...shots].sort((a, b) => a.day.localeCompare(b.day));
  const streak = longestStreak(sorted.map((s) => s.day));
  const { topFilm, films } = filmTally(sorted);

  const wx = new Map<string, number>();
  for (const s of sorted) {
    const w = skyWord(s.weather?.code);
    if (w) wx.set(w, (wx.get(w) ?? 0) + 1);
  }
  let topWeather: MonthStats['topWeather'] = null;
  for (const [word, count] of wx) if (!topWeather || count > topWeather.count) topWeather = { word, count };

  return { shots: shots.length, days, streak, films, topFilm, topWeather };
}

const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8))) / 86400000;

/** Longest run of consecutive calendar days, across month ends. */
export function longestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev = NaN;
  for (const d of sorted) {
    const n = dayNumber(d);
    run = n === prev + 1 ? run + 1 : 1;
    prev = n;
    best = Math.max(best, run);
  }
  return best;
}

/** Most frequent film (a tie goes to the one seen most recently) and how many kinds. Expects day order. */
function filmTally(sorted: ShotLike[]): { topFilm: FilmId | null; films: number } {
  const count = new Map<FilmId, number>();
  let topFilm: FilmId | null = null;
  for (const s of sorted) {
    count.set(s.film, (count.get(s.film) ?? 0) + 1);
    if (!topFilm || count.get(s.film)! >= count.get(topFilm)!) topFilm = s.film;
  }
  return { topFilm, films: count.size };
}

export type Dot = { day: string; state: 'shot' | 'missed' | 'today' | 'future'; film: FilmId | null };

export type YearMonth<T> = { month: string; shots: number; days: number; total: number; cover: T | null; dots: Dot[] };

export type YearSummary<T> = { year: number; months: YearMonth<T>[]; shots: number; days: number; streak: number; films: number; topFilm: FilmId | null };

/** Twelve months at a glance: a day dot per day, the month's latest photo as its cover. */
export function yearSummary<T extends ShotLike>(year: number, shots: T[], today: string): YearSummary<T> {
  const mine = shots.filter((s) => s.day.startsWith(`${year}-`)).sort((a, b) => a.day.localeCompare(b.day));
  const byDay = new Map(mine.map((s) => [s.day, s]));
  const months: YearMonth<T>[] = [];
  let days = 0;
  for (let m = 0; m < 12; m++) {
    const month = `${year}-${String(m + 1).padStart(2, '0')}`;
    const total = daysInMonth(year, m);
    const dots: Dot[] = [];
    let cover: T | null = null;
    let n = 0;
    let past = 0;
    for (let d = 1; d <= total; d++) {
      const day = dayKey(new Date(year, m, d));
      const s = byDay.get(day);
      if (s) {
        n++;
        cover = s;
      }
      if (day <= today) past++;
      dots.push({ day, film: s?.film ?? null, state: s ? 'shot' : day === today ? 'today' : day < today ? 'missed' : 'future' });
    }
    days += past;
    months.push({ month, shots: n, days: past, total, cover, dots });
  }
  const { topFilm, films } = filmTally(mine);
  return { year, months, shots: mine.length, days, streak: longestStreak(mine.map((s) => s.day)), films, topFilm };
}

/** '128장 · 최장 연속 12일 · 자주 나온 필름 Grey Portra' */
export function yearLine(y: YearSummary<ShotLike>): string {
  if (!y.shots) return tr('아직 찍은 날이 없어요', 'No photos yet', 'まだ撮った日がありません');
  const parts = [tr(`${y.days}일 중 ${y.shots}장`, `${y.shots} of ${y.days} days`, `${y.days}日中${y.shots}枚`)];
  if (y.streak >= 2) parts.push(tr(`최장 연속 ${y.streak}일`, `longest run ${y.streak} days`, `最長連続${y.streak}日`));
  if (y.topFilm && y.shots >= 2) parts.push(tr(`자주 나온 필름 ${FILM_NAMES[y.topFilm]}`, `most often ${FILM_NAMES[y.topFilm]}`, `よく来たフィルム ${FILM_NAMES[y.topFilm]}`));
  return parts.join(' · ');
}

/** One quiet line under the roll count, once there is something to say. */
export function statsLine(st: MonthStats): string {
  if (st.shots < 2) return '';
  const parts: string[] = [];
  if (st.streak >= 2) parts.push(tr(`최장 연속 ${st.streak}일`, `longest run ${st.streak} days`, `最長連続${st.streak}日`));
  if (st.topFilm) parts.push(tr(`자주 나온 필름 ${FILM_NAMES[st.topFilm]}`, `most often ${FILM_NAMES[st.topFilm]}`, `よく来たフィルム ${FILM_NAMES[st.topFilm]}`));
  return parts.join(' · ');
}

// skyWord -> "a ___ day"
const DAY: Record<string, string> = { 맑음: '맑은 날', '구름 조금': '구름 조금 낀 날', 흐림: '흐린 날', 비: '비 온 날', 눈: '눈 온 날', 안개: '안개 낀 날', 뇌우: '천둥 친 날' };
const DAY_JA: Record<string, string> = { 晴れ: '晴れの日', 晴れ時々くもり: '晴れ時々くもりの日', くもり: 'くもりの日', 雨: '雨の日', 雪: '雪の日', 霧: '霧の日', 雷雨: '雷の日' };
const DAY_EN: Record<string, string> = { Clear: 'Clear days', 'Partly cloudy': 'Partly cloudy days', Overcast: 'Grey days', Rain: 'Rainy days', Snow: 'Snowy days', Fog: 'Foggy days', Storm: 'Stormy days' };

/** '흐린 날이 4장으로 제일 많았어요', or '' when no weather repeats. */
export function weatherSentence(st: MonthStats): string {
  if (!st.topWeather || st.topWeather.count < 2) return '';
  const { word, count: n } = st.topWeather;
  return tr(`${DAY[word] ?? word}이 ${n}장으로 제일 많았어요`, `${DAY_EN[word] ?? word} came up most, ${n} photos`, `${DAY_JA[word] ?? word}が${n}枚でいちばん多かった`);
}

/** The "roll developed" card, a few short lines. */
export function doneLines(st: MonthStats): string[] {
  const lines = [tr(`${st.days}일 중 ${st.shots}장을 찍었어요`, `You shot ${st.shots} of ${st.days} days`, `${st.days}日中${st.shots}枚撮りました`)];
  if (st.streak >= 2) lines.push(tr(`가장 길게 이어 찍은 날 ${st.streak}일`, `Longest run: ${st.streak} days in a row`, `最長${st.streak}日連続で撮影`));
  if (st.topFilm)
    lines.push(
      st.films > 1
        ? tr(`필름 ${st.films}종, 가장 많이 들어온 건 ${FILM_NAMES[st.topFilm]}`, `${st.films} films, ${FILM_NAMES[st.topFilm]} loaded most`, `フィルム${st.films}種、いちばん多く来たのは ${FILM_NAMES[st.topFilm]}`)
        : tr(`한 달 내내 ${FILM_NAMES[st.topFilm]}`, `${FILM_NAMES[st.topFilm]} all month`, `ひと月ずっと ${FILM_NAMES[st.topFilm]}`),
    );
  if (weatherSentence(st)) lines.push(weatherSentence(st));
  return lines;
}

export type RecapFact = { label: string; value: string };

/**
 * The year-end card's facts: longest run, films collected out of all there are,
 * the film that loaded most and the sky seen most. Only facts with something to say.
 */
export function yearRecap(y: YearSummary<ShotLike>, shots: ShotLike[]): RecapFact[] {
  const mine = shots.filter((s) => s.day.startsWith(`${y.year}-`));
  const facts: RecapFact[] = [];
  if (y.streak >= 2) facts.push({ label: tr('가장 길게 이어 찍은 날', 'Longest run', '最長連続記録'), value: count(y.streak, '일', 'day') });
  if (y.films) facts.push({ label: tr('모은 필름', 'Films collected', '集めたフィルム'), value: tr(`${y.films} / ${Object.keys(FILM_NAMES).length}종`, `${y.films} / ${Object.keys(FILM_NAMES).length}`, `${y.films} / ${Object.keys(FILM_NAMES).length}種`) });
  if (y.topFilm && mine.length >= 2) {
    const n = mine.filter((s) => s.film === y.topFilm).length;
    facts.push({ label: tr('가장 많이 온 필름', 'Most loaded film', 'いちばん多く来たフィルム'), value: `${FILM_NAMES[y.topFilm]} · ${count(n, '장', 'photo')}` });
  }
  const wx = new Map<string, number>();
  for (const s of mine) {
    const w = skyWord(s.weather?.code);
    if (w) wx.set(w, (wx.get(w) ?? 0) + 1);
  }
  let top: [string, number] | null = null;
  for (const e of wx) if (!top || e[1] > top[1]) top = e;
  if (top && top[1] >= 2) facts.push({ label: tr('제일 많았던 하늘', 'Most common sky', 'いちばん多かった空'), value: `${top[0]} · ${count(top[1], '장', 'photo')}` });
  return facts;
}
