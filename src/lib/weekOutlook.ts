// "이번 주 필름 예보" over the film book: the next seven days' noon forecast
// run through the shutter's film choice, so a collector can see
// which day might bring a missing film. Pure except for the URL; the caller
// fetches (conditions.ts).

import { coarse } from './weather.ts';
import { chooseFilm, specialDay, type FilmId } from './film.ts';

/** A day's weather at local noon, from the hourly forecast. */
export type WeekDay = { day: string; code: number | null; temp: number | null; wind: number | null; cloud: number | null };
export type WeekFilm = { day: string; film: FilmId };

export function weekUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: String(coarse(lat)),
    longitude: String(coarse(lon)),
    hourly: 'weather_code,temperature_2m,wind_speed_10m,cloud_cover',
    timezone: 'auto',
    wind_speed_unit: 'ms',
    forecast_days: '8',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

type Resp = { hourly?: { time?: string[]; weather_code?: (number | null)[]; temperature_2m?: (number | null)[]; wind_speed_10m?: (number | null)[]; cloud_cover?: (number | null)[] } };
const num = (v: number | null | undefined) => (typeof v === 'number' ? v : null);

/**
 * Days after `today`, each read at local 12:00 (the hourly times are local
 * with timezone=auto). Noon rather than the daily summary, whose weather code
 * is the worst hour of the day: one afternoon thunder shower would otherwise
 * paint the whole day as Storm Push.
 */
export function parseWeek(j: Resp, today: string): WeekDay[] {
  const h = j.hourly ?? {};
  const out: WeekDay[] = [];
  (h.time ?? []).forEach((t, i) => {
    if (!t.endsWith('T12:00')) return;
    const day = t.slice(0, 10);
    if (day <= today) return;
    out.push({ day, code: num(h.weather_code?.[i]), temp: num(h.temperature_2m?.[i]), wind: num(h.wind_speed_10m?.[i]), cloud: num(h.cloud_cover?.[i]) });
  });
  return out.slice(0, 7);
}

/** The film each day would load at midday, with the shutter's own rules (special days, seasons, the winter's first snow once). */
export function weekFilms(week: WeekDay[], opts: { birthday?: string | null; lat?: number | null; firstSnow?: boolean }): WeekFilm[] {
  let firstSnow = opts.firstSnow ?? false;
  return week.map((w) => {
    const [y, m, d] = w.day.split('-').map(Number);
    const noon = new Date(y, m - 1, d, 12);
    const film = chooseFilm({
      now: noon,
      weather: { code: w.code ?? undefined, tempC: w.temp ?? undefined, windMs: w.wind ?? undefined, cloud: w.cloud ?? undefined },
      special: specialDay(noon, opts.birthday ?? null),
      firstSnow,
      lat: opts.lat,
    }).film;
    // only the first snowy day of the week can be the winter's first snow
    if (film === 'first-snow') firstSnow = false;
    return { day: w.day, film };
  });
}

/** The cache keeps the (coarse) place it was fetched for, so a new city fetches again. */
export const encodeWeek = (week: WeekDay[], at: number, place?: { lat: number; lon: number }) =>
  JSON.stringify({ at, week, place: place ? `${coarse(place.lat)},${coarse(place.lon)}` : '' });

export const samePlace = (cached: string, place: { lat: number; lon: number }) => cached === `${coarse(place.lat)},${coarse(place.lon)}`;

export function decodeWeek(s: string): { at: number; week: WeekDay[]; place: string } | null {
  try {
    const v = JSON.parse(s) as { at?: unknown; week?: unknown; place?: unknown };
    if (typeof v.at !== 'number' || !Array.isArray(v.week)) return null;
    return { at: v.at, week: v.week as WeekDay[], place: typeof v.place === 'string' ? v.place : '' };
  } catch {
    return null;
  }
}
