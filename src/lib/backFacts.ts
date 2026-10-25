// The lab stamp on the back of any print in the roll, as of the day it was
// taken: which frame of its month it was, how full the film book was then,
// and how many days in a row it closed. Pure.

import { BOOK_ORDER } from './filmbook.ts';
import { currentStreak } from './streak.ts';

type ShotLike = { day: string; film: string };

export function backFacts(shot: ShotLike, all: ShotLike[]): { frame: number; book: { found: number; total: number }; run: number } {
  const month = shot.day.slice(0, 7);
  const upTo = all.filter((s) => s.day <= shot.day);
  const days = new Set(all.map((s) => s.day));
  return {
    frame: upTo.filter((s) => s.day.startsWith(month)).length,
    book: { found: new Set(upTo.map((s) => s.film)).size, total: BOOK_ORDER.length },
    run: currentStreak(shot.day, (d) => days.has(d)),
  };
}
