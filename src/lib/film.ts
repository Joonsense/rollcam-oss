// Which film loads today. The user never picks (spec §3.2): place, weather and
// light pick, and we say why in one line after the shot.

import { tr } from './i18n.ts';
import { isFullMoon } from './moon.ts';

export type FilmId =
  | 'party-flash'
  | 'golden-roll'
  | 'night-tungsten'
  | 'storm-push'
  | 'rainy-mono'
  | 'snow-pastel'
  | 'first-snow'
  | 'moon-silver'
  | 'blue-hour'
  | 'postcard'
  | 'spring-bloom'
  | 'autumn-maple'
  | 'haze-film'
  | 'motion-lofi'
  | 'grey-portra'
  | 'summer-kodak'
  | 'winter-fuji'
  | 'daily-negative';

/** Open-Meteo "current" fields we use. All optional: we degrade to time-only. */
export type Weather = {
  code?: number; // WMO weather code
  cloud?: number; // %
  tempC?: number;
  windMs?: number;
};

export type FilmInput = {
  now: Date;
  sunrise?: Date;
  sunset?: Date;
  weather?: Weather | null;
  /** birthday, new year, ... decided by the caller */
  special?: string | null;
  /** no snow shot yet this winter (see firstSnowDue): snow now loads First Snow */
  firstSnow?: boolean;
  /** latitude of the place, for which seasonal calendar applies (seasonsAt) */
  lat?: number | null;
  /** far from the city most photos were taken in (home.ts isAway) */
  away?: boolean;
};

export type FilmPick = { film: FilmId; reason: string };

export const FILM_NAMES: Record<FilmId, string> = {
  'party-flash': 'Party Flash',
  'golden-roll': 'Golden Roll',
  'night-tungsten': 'Night Tungsten',
  'storm-push': 'Storm Push',
  'rainy-mono': 'Rainy Mono',
  'snow-pastel': 'Snow Pastel',
  'first-snow': 'First Snow',
  'moon-silver': 'Moon Silver',
  'blue-hour': 'Blue Hour',
  'postcard': 'Postcard',
  'spring-bloom': 'Spring Bloom',
  'autumn-maple': 'Autumn Maple',
  'haze-film': 'Haze Film',
  'motion-lofi': 'Motion Lo-Fi',
  'grey-portra': 'Grey Portra',
  'summer-kodak': 'Summer Kodak',
  'winter-fuji': 'Winter Fuji',
  'daily-negative': 'Daily Negative',
};

export const GOLDEN_MIN = 40;
/** Blue hour: the clear twilight from GOLDEN_MIN to BLUE_MIN after sunset (and the same before sunrise). */
export const BLUE_MIN = 75;

// WMO code groups (open-meteo.com/en/docs)
const isStorm = (c: number) => c >= 95;
const isSnow = (c: number) => (c >= 71 && c <= 77) || c === 85 || c === 86;
const isRain = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82);
const isFog = (c: number) => c === 45 || c === 48;

/**
 * Seasonal films, by calendar (Seoul's cherry blossom and foliage peaks):
 * Spring Bloom from Mar 28 to Apr 12, Autumn Maple from Oct 28 to Nov 12.
 * They load on a dry daytime sky inside the window and nowhere else.
 */
export const SEASONS: { film: FilmId; from: string; to: string; why: string }[] = [
  { film: 'spring-bloom', from: '03-28', to: '04-12', why: '벚꽃 피는' },
  { film: 'autumn-maple', from: '10-28', to: '11-12', why: '단풍 드는' },
];

// The same seasons six months on below the tropics (Australia's blossom in
// late September, its autumn leaves in late April); none in the tropics.
const SEASONS_SOUTH: typeof SEASONS = [
  { film: 'spring-bloom', from: '09-28', to: '10-12', why: '벚꽃 피는' },
  { film: 'autumn-maple', from: '04-20', to: '05-10', why: '단풍 드는' },
];
const TROPIC = 23.5;

/** Seasonal windows at latitude `lat` (unknown: the northern calendar, where the app started). */
export function seasonsAt(lat?: number | null): typeof SEASONS {
  if (lat === undefined || lat === null || lat >= TROPIC) return SEASONS;
  return lat <= -TROPIC ? SEASONS_SOUTH : [];
}

/** The seasonal film whose window holds `now` at latitude `lat`, if any. */
export function seasonOf(now: Date, lat?: number | null): (typeof SEASONS)[number] | null {
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return seasonsAt(lat).find((x) => md >= x.from && md <= x.to) ?? null;
}

/**
 * A seasonal film's window seen from `today` ('YYYY-MM-DD'): open now with
 * its last day, or days until it opens next (this year or the next).
 * Null for films without a window.
 */
export function seasonWait(film: FilmId, today: string, lat?: number | null): { open: true; until: string } | { open: false; days: number; from: string } | null {
  const sx = seasonsAt(lat).find((x) => x.film === film);
  if (!sx) return null;
  const md = today.slice(5);
  if (md >= sx.from && md <= sx.to) return { open: true, until: sx.to };
  const y = Number(today.slice(0, 4)) + (md > sx.to ? 1 : 0);
  const [fm, fd] = sx.from.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const days = Math.round((Date.UTC(y, fm - 1, fd) - Date.UTC(ty, tm - 1, td)) / 86400000);
  return { open: false, days, from: sx.from };
}

function partOfDay(now: Date): string {
  const h = now.getHours();
  if (h < 5) return '새벽';
  if (h < 11) return '아침';
  if (h < 14) return '한낮';
  if (h < 18) return '오후';
  return '저녁';
}

/**
 * Priority order. Spec §4 lists Party/Storm/Wind after the clear-sky rows, which
 * would make them unreachable, so: special day > the winter's first snow > storm > golden hour > blue hour > night >
 * rain > snow > fog > away from home > wind > cloud > hot > cold > default. Light outranks
 * rain at dusk; a storm outranks everything but a special day.
 */
export function chooseFilm(input: FilmInput): FilmPick {
  const { now, sunrise, sunset, special } = input;
  const w = input.weather ?? {};
  const pod = partOfDay(now);
  const pick = (film: FilmId, why: string): FilmPick => ({ film, reason: `${why} — '${FILM_NAMES[film]}'` });

  if (special) return pick('party-flash', special);

  const code = w.code;
  if (input.firstSnow && code !== undefined && isSnow(code)) return pick('first-snow', `올겨울 첫눈 내리는 ${pod}`);
  if (code !== undefined && isStorm(code)) return pick('storm-push', `천둥 치는 ${pod}`);

  if (sunrise && sunset) {
    const t = now.getTime();
    const near = (s: Date) => Math.abs(t - s.getTime()) <= GOLDEN_MIN * 60000;
    if (near(sunrise)) return pick('golden-roll', '해 뜨는 무렵');
    if (near(sunset)) return pick('golden-roll', '해 지는 무렵');
    // the clear blue twilight just past the golden window, on either side of the night
    const clear = code !== undefined && code <= 2 && (w.cloud === undefined || w.cloud < 70);
    const past = (t - sunset.getTime()) / 60000;
    const before = (sunrise.getTime() - t) / 60000;
    if (clear && past > GOLDEN_MIN && past <= BLUE_MIN) return pick('blue-hour', '해 진 뒤 푸른 무렵');
    if (clear && before > GOLDEN_MIN && before <= BLUE_MIN) return pick('blue-hour', '해 뜨기 전 푸른 무렵');
    if (t < sunrise.getTime() || t > sunset.getTime()) {
      // a clear night within a day of the full moon
      if (isFullMoon(now) && code !== undefined && code <= 2 && (w.cloud === undefined || w.cloud < 50)) return pick('moon-silver', '보름달 뜬 밤');
      return pick('night-tungsten', '해가 진 밤');
    }
  }

  if (code !== undefined) {
    if (isRain(code)) return pick('rainy-mono', `비 오는 ${pod}`);
    if (isSnow(code)) return pick('snow-pastel', `눈 내리는 ${pod}`);
    if (isFog(code)) return pick('haze-film', `안개 낀 ${pod}`);
  }
  // a dry daytime far from home: the trip gets its own film
  if (input.away && now.getHours() >= 7 && now.getHours() < 18) return pick('postcard', `멀리 떠나온 ${pod}`);
  if (w.windMs !== undefined && w.windMs >= 10) return pick('motion-lofi', `바람 센 ${pod}`);
  if (w.cloud !== undefined && w.cloud >= 70) return pick('grey-portra', `흐린 ${pod}`);
  // a dry, not overcast day in a seasonal window, in daylight even without sun times
  const season = seasonOf(now, input.lat);
  if (season && now.getHours() >= 7 && now.getHours() < 18) return pick(season.film, `${season.why} ${pod}`);
  if (w.tempC !== undefined && w.tempC >= 28) return pick('summer-kodak', `뜨거운 ${pod}`);
  if (w.tempC !== undefined && w.tempC <= 5) return pick('winter-fuji', `차갑고 맑은 ${pod}`);
  return pick('daily-negative', `평범한 ${pod}`);
}

/**
 * Settings input -> 'MM-DD'. Accepts '5/3', '05-03', '0503', '5.3', '5월 3일', '5月3日'.
 * '' clears (returns ''); anything that isn't a real calendar day returns null.
 * Feb 29 is allowed: the film just waits for a leap year.
 */
export function normalizeBirthday(input: string): string | null {
  const t = input.trim();
  if (!t) return '';
  const m = t.match(/^(\d{1,2})\s*(?:[-/.]|월|月)\s*(\d{1,2})\s*[일日]?$/) ?? t.match(/^(\d{2})(\d{2})$/);
  if (!m) return null;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  if (!max || d < 1 || d > max) return null;
  return `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Birthday / new year etc. `birthday` is 'MM-DD' if the user set one. */
export function specialDay(now: Date, birthday?: string | null): string | null {
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (md === '01-01') return '새해 첫날';
  if (md === '12-25') return '크리스마스';
  if (birthday && md === birthday) return '생일';
  return null;
}

/** Film book hint for a film not loaded yet: the kind of day that brings it. */
export const FILM_HINTS: Record<FilmId, string> = {
  'daily-negative': '평범한 날',
  'grey-portra': '구름 잔뜩 낀 날',
  'golden-roll': '해 뜨고 질 무렵',
  'night-tungsten': '해가 진 뒤',
  'rainy-mono': '비 오는 날',
  'summer-kodak': '28° 넘는 날',
  'winter-fuji': '5° 아래로 맑은 날',
  'haze-film': '안개 낀 날',
  'motion-lofi': '바람 센 날',
  'snow-pastel': '눈 오는 날',
  'first-snow': '그 겨울 첫눈이 오는 날 (시즌 한정)',
  'moon-silver': '보름달 뜬 맑은 밤',
  'blue-hour': '맑은 날 해 지고 한 시간 안쪽 (해 뜨기 전에도)',
  'postcard': '평소 찍던 곳에서 150km 넘게 떠난 날 낮 (7장 찍은 뒤부터)',
  'spring-bloom': '3월 말~4월 초 벚꽃 철, 맑은 낮 (시즌 한정)',
  'autumn-maple': '10월 말~11월 초 단풍 철, 맑은 낮 (시즌 한정)',
  'storm-push': '천둥 치는 날',
  'party-flash': '생일 · 새해 · 크리스마스',
};

const FILM_HINTS_EN: Record<FilmId, string> = {
  'daily-negative': 'An ordinary day',
  'grey-portra': 'A heavily overcast day',
  'golden-roll': 'Around sunrise and sunset',
  'night-tungsten': 'After dark',
  'rainy-mono': 'A rainy day',
  'summer-kodak': 'A day over 28°',
  'winter-fuji': 'A clear day under 5°',
  'haze-film': 'A foggy day',
  'motion-lofi': 'A windy day',
  'snow-pastel': 'A snowy day',
  'first-snow': "The winter's first snowy day (seasonal)",
  'moon-silver': 'A clear night under the full moon',
  'blue-hour': 'Under an hour after a clear sunset (or before sunrise)',
  'postcard': 'A daytime over 150 km from where you usually shoot (after 7 photos)',
  'spring-bloom': 'A clear day in cherry blossom season (seasonal)',
  'autumn-maple': 'A clear day when the leaves turn (seasonal)',
  'storm-push': 'A thundery day',
  'party-flash': "Birthday · New Year's Day · Christmas",
};

const FILM_HINTS_JA: Record<FilmId, string> = {
  'daily-negative': 'いつもの日',
  'grey-portra': 'どんよりくもった日',
  'golden-roll': '日の出と日の入りのころ',
  'night-tungsten': '日が暮れたあと',
  'rainy-mono': '雨の日',
  'summer-kodak': '28°を超える日',
  'winter-fuji': '5°を下回る晴れた日',
  'haze-film': '霧の日',
  'motion-lofi': '風の強い日',
  'snow-pastel': '雪の日',
  'first-snow': 'その冬はじめての雪の日(季節限定)',
  'moon-silver': '満月の晴れた夜',
  'blue-hour': '晴れた日の日没後一時間ほど(日の出前も)',
  'postcard': 'いつも撮る場所から150km以上離れた日の昼(7枚撮ったあとから)',
  'spring-bloom': '桜の季節の晴れた日(季節限定)',
  'autumn-maple': '紅葉の季節の晴れた日(季節限定)',
  'storm-push': '雷の日',
  'party-flash': '誕生日 · 元日 · クリスマス',
};

/** FILM_HINTS in the current language. */
export const filmHint = (f: FilmId) => tr(FILM_HINTS[f], FILM_HINTS_EN[f], FILM_HINTS_JA[f]);

/** Winter season a day belongs to: July..June, keyed by the year it starts (south of the tropics: the calendar year). */
export const snowSeason = (day: string, lat?: number | null) =>
  // a southern winter (June to August) sits inside one calendar year
  lat !== undefined && lat !== null && lat <= -TROPIC ? Number(day.slice(0, 4)) : Number(day.slice(5, 7)) >= 7 ? Number(day.slice(0, 4)) : Number(day.slice(0, 4)) - 1;

/**
 * True while this winter has no snow photo yet, so the next snowy shot is the
 * season's First Snow. `shots` is the roll so far (any order).
 */
export function firstSnowDue(today: string, shots: { day: string; film: FilmId; weather: Weather | null }[], lat?: number | null): boolean {
  const season = snowSeason(today, lat);
  return !shots.some((s) => snowSeason(s.day, lat) === season && (s.film === 'first-snow' || (s.weather?.code !== undefined && isSnow(s.weather.code))));
}
