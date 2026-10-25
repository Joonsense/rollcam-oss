// "한 줄 일기 내보내기": every day that has a line, as plain text a notes app
// or a journal takes as is, oldest first the way a diary reads. Pure; the
// share is in exportData.ts.

import { FILM_NAMES, type FilmId, type Weather } from './film.ts';
import { tr, yearMonth } from './i18n.ts';
import { weatherLine } from './sky.ts';

type Line = { day: string; film: FilmId; weather: Weather | null; memo: string };

/**
 * 'ROLLCAM · 한 줄 일기' header, then a heading per month and one entry per
 * day: '10.25 (Rainy Mono · 비 · 12°)' and the line under it. Days without a
 * line are left out.
 */
export function diaryText(shots: Line[]): string {
  const days = shots.filter((s) => s.memo).sort((a, b) => a.day.localeCompare(b.day));
  const out: string[] = [tr('ROLLCAM · 한 줄 일기', 'ROLLCAM · Lines', 'ROLLCAM · 一行日記')];
  let month = '';
  for (const s of days) {
    const m = s.day.slice(0, 7);
    if (m !== month) {
      month = m;
      out.push('', `# ${yearMonth(Number(m.slice(0, 4)), Number(m.slice(5)))}`);
    }
    const meta = [FILM_NAMES[s.film], weatherLine(s.weather)].filter(Boolean).join(' · ');
    out.push('', `${s.day.slice(5).replace('-', '.')} (${meta})`, s.memo);
  }
  return `${out.join('\n')}\n`;
}
