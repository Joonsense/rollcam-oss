// A month as a 36-exposure strip (spec §3.3). A month has 28-31 days, so the
// spare frames become film leader split before and after the days.

import { daysInMonth } from './day.ts';

export const FRAMES = 36;

export type Frame =
  | { kind: 'leader'; index: number }
  | { kind: 'day'; index: number; day: string; state: 'shot' | 'missed' | 'today' | 'future' };

/** `shotDays` = set of 'YYYY-MM-DD' with a photo; `today` = today's day key. */
export function monthStrip(month: string, shotDays: Set<string>, today: string): Frame[] {
  const [y, m] = month.split('-').map(Number);
  const n = daysInMonth(y, m - 1);
  const lead = Math.floor((FRAMES - n) / 2);
  const frames: Frame[] = [];
  for (let i = 0; i < FRAMES; i++) {
    const d = i - lead + 1;
    if (d < 1 || d > n) {
      frames.push({ kind: 'leader', index: i });
      continue;
    }
    const day = `${month}-${String(d).padStart(2, '0')}`;
    const state = shotDays.has(day) ? 'shot' : day === today ? 'today' : day < today ? 'missed' : 'future';
    frames.push({ kind: 'day', index: i, day, state });
  }
  return frames;
}
