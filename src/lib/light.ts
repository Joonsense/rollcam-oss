// The viewfinder's light note: inside the sunrise/sunset window that loads
// Golden Roll, how long it lasts; in the hour before it, how long until. The
// film itself stays unnamed. Pure.

import { BLUE_MIN, GOLDEN_MIN } from './film.ts';
import { tr } from './i18n.ts';
import { isFullMoon } from './moon.ts';

const SOON_MIN = 60;

/** '해 질 녘 빛 · 23분 남음' / '해 질 녘 빛까지 18분', or '' outside those times. */
/**
 * `golden(at)` says whether Golden Roll would really load at that moment (a
 * birthday, a storm or the first snow outrank the light); no note when not.
 */
export function lightNote(now: Date, sunrise?: Date | null, sunset?: Date | null, golden: (at: Date) => boolean = () => true): string {
  const t = now.getTime();
  for (const [sun, word] of [
    [sunrise, tr('해 뜰 녘 빛', 'Sunrise light', '朝焼けの光')],
    [sunset, tr('해 질 녘 빛', 'Sunset light', '夕焼けの光')],
  ] as const) {
    if (!sun || !golden(sun)) continue;
    const open = sun.getTime() - GOLDEN_MIN * 60000;
    const close = sun.getTime() + GOLDEN_MIN * 60000;
    const left = Math.max(1, Math.ceil((close - t) / 60000));
    const until = Math.max(1, Math.ceil((open - t) / 60000));
    if (t >= open && t <= close) return tr(`${word} · ${left}분 남음`, `${word} · ${left} min left`, `${word} · あと${left}分`);
    if (t < open && open - t <= SOON_MIN * 60000) return tr(`${word}까지 ${until}분`, `${word} in ${until} min`, `${word}まで${until}分`);
  }
  return '';
}

/**
 * Inside a blue-hour window (just past the golden one, after sunset or before
 * sunrise) when `blue(now)` says Blue Hour really loads: '푸른 빛 · 12분 남음'.
 */
export function blueNote(now: Date, sunrise?: Date | null, sunset?: Date | null, blue: (at: Date) => boolean = () => true): string {
  const t = now.getTime();
  const windows: [number, number][] = [];
  if (sunset) windows.push([sunset.getTime() + GOLDEN_MIN * 60000, sunset.getTime() + BLUE_MIN * 60000]);
  if (sunrise) windows.push([sunrise.getTime() - BLUE_MIN * 60000, sunrise.getTime() - GOLDEN_MIN * 60000]);
  const w = windows.find(([open, close]) => t > open && t <= close);
  if (!w || !blue(now)) return '';
  const left = Math.max(1, Math.ceil((w[1] - t) / 60000));
  return tr(`푸른 빛 · ${left}분 남음`, `Blue light · ${left} min left`, `青い光 · あと${left}分`);
}

/** At night within a day of the full moon: a quiet note for the viewfinder ('' otherwise). */
export function moonNote(now: Date, sunrise?: Date | null, sunset?: Date | null): string {
  if (!sunrise || !sunset) return '';
  const night = now.getTime() < sunrise.getTime() || now.getTime() > sunset.getTime();
  return night && isFullMoon(now) ? tr('보름달 뜬 밤', 'Full moon tonight', '満月の夜') : '';
}
