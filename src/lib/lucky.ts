// "럭키 컷": now and then a frame comes back from the lab with a big warm light
// leak, the way a roll sometimes does. Decided by the moment the shutter was
// pressed (takenAt), so it can't be re-rolled, needs no stored flag, and an
// exported roll restores with the same lucky frames. Pure.

import { tr } from './i18n.ts';
import type { Look } from './looks.ts';

/** About one frame in this many is lucky. */
export const LUCKY_ODDS = 24;

/**
 * Lucky frames start 2026-10-26 KST (0.6.1 went out the day before): photos developed before it
 * have no leak, so they never read as lucky.
 */
export const LUCKY_SINCE = Date.UTC(2026, 9, 25, 15);

/** Whether the shot taken at `takenAt` (epoch ms) is a lucky frame. */
export function isLucky(takenAt: number): boolean {
  if (!(takenAt >= LUCKY_SINCE)) return false;
  // integer hash (murmur3 finalizer) of the timestamp, so nearby times don't cluster
  let h = Math.floor(takenAt) >>> 0;
  h ^= Math.floor(takenAt / 4294967296) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) % LUCKY_ODDS === 0;
}

/** The look a lucky frame is developed with: a strong, wide leak (filmShader reads leak > 1 as reach) and more halation, color untouched. */
export const luckyLook = (look: Look): Look => ({ ...look, leak: 1.8, halation: Math.min(1, (look.halation ?? 0) + 0.2) });

/** The film book's count of lucky frames, or '' before the first. */
export const luckyLine = (n: number) => (n ? tr(`✦ 럭키 컷 ${n}장`, `✦ ${n} lucky ${n === 1 ? 'frame' : 'frames'}`, `✦ ラッキーカット${n}枚`) : '');

/** How many lucky frames a roll holds. */
export const luckyCount = (shots: { takenAt: number }[]) => shots.filter((s) => isLucky(s.takenAt)).length;
