// The film book: every film in a fixed slot, common to rare (the seasonal
// First Snow last), filled in as the weather loads them. Pure, so it is unit tested.

import type { FilmId } from './film.ts';
import { tr } from './i18n.ts';

type ShotLike = { day: string; film: FilmId };

/** Slot order, roughly how often a year of weather brings each film. */
export const BOOK_ORDER: FilmId[] = [
  'daily-negative',
  'grey-portra',
  'golden-roll',
  'night-tungsten',
  'rainy-mono',
  'summer-kodak',
  'winter-fuji',
  'haze-film',
  'motion-lofi',
  'snow-pastel',
  'storm-push',
  'party-flash',
  'spring-bloom',
  'autumn-maple',
  'first-snow',
  'moon-silver',
  'blue-hour',
  'postcard',
];

export type BookEntry<T> = { film: FilmId; shots: T[]; first: string | null };

export type FilmBook<T> = { entries: BookEntry<T>[]; found: number; newest: FilmId | null };

/** Every film's shots in day order; `newest` is the film most recently loaded for the first time. */
export function filmBook<T extends ShotLike>(shots: T[]): FilmBook<T> {
  const sorted = [...shots].sort((a, b) => a.day.localeCompare(b.day));
  const by = new Map<FilmId, T[]>(BOOK_ORDER.map((f) => [f, []]));
  for (const s of sorted) by.get(s.film)?.push(s);
  const entries = BOOK_ORDER.map((film) => {
    const list = by.get(film)!;
    return { film, shots: list, first: list[0]?.day ?? null };
  });
  let newest: BookEntry<T> | null = null;
  for (const e of entries) if (e.first && (!newest || e.first > newest.first!)) newest = e;
  return { entries, found: entries.filter((e) => e.first).length, newest: newest?.film ?? null };
}

/** '16종 중 5종' plus what is left, or a done line. */
export function bookLine(b: FilmBook<ShotLike>): string {
  const total = b.entries.length;
  if (b.found === 0) return tr('찍으면 그날 날씨의 필름이 한 칸씩 채워져요', "Each photo fills in the slot of the film that day's weather loaded", '撮るたびに、その日の天気のフィルムが一マスずつ埋まります');
  if (b.found === total) return tr(`${total}종을 모두 모았어요`, `All ${total} films collected`, `${total}種すべて集めました`);
  return tr(`${total}종 중 ${b.found}종 · 남은 필름 ${total - b.found}종`, `${b.found} of ${total} films · ${total - b.found} to go`, `${total}種中${b.found}種 · 残り${total - b.found}種`);
}

/** Films whose first load ever fell in `month` ('YYYY-MM'), in book order: the month's new entries in the film book. */
export function newIn<T extends ShotLike>(month: string, shots: T[]): FilmId[] {
  return filmBook(shots)
    .entries.filter((e) => e.first?.startsWith(`${month}-`))
    .map((e) => e.film);
}
