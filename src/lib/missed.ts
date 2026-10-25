// A missed day's card in the roll: which film that day's sky would have
// loaded at midday, from the daily weather kept for its sky color. Pure.

import { chooseFilm, specialDay, type FilmId } from './film.ts';

/** The midday film for a day with daily weather code `code` and high `tempMax`; null without weather. */
export function missedFilm(day: string, code: number | null | undefined, tempMax: number | null | undefined, birthday?: string | null, lat?: number | null): FilmId | null {
  if (code === null || code === undefined) return null;
  const [y, m, d] = day.split('-').map(Number);
  const noon = new Date(y, m - 1, d, 12);
  return chooseFilm({
    now: noon,
    // overcast as a daily code means the whole day: read it as a full sky
    weather: { code, tempC: tempMax ?? undefined, cloud: code === 3 ? 90 : undefined },
    special: specialDay(noon, birthday),
    lat,
  }).film;
}
