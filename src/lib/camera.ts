// Which lens and flash the shutter uses. Kept in the kv store so the next day
// opens the way you left it. Pure, so it is unit tested.

import { tr } from './i18n.ts';

export type Facing = 'back' | 'front';
export type Flash = 'off' | 'auto' | 'on';

export const readFacing = (v: string): Facing => (v === 'front' ? 'front' : 'back');

/** Off by default: a film look is built for available light. */
export const readFlash = (v: string): Flash => (v === 'auto' || v === 'on' ? v : 'off');

/** off -> auto -> on. The front lens has no auto (no LED to meter for), so off <-> on. */
export function nextFlash(f: Flash, facing: Facing): Flash {
  if (facing === 'front') return f === 'off' ? 'on' : 'off';
  return f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off';
}

/** CameraView `flash`: the front lens lights the screen instead of an LED. */
export function flashMode(f: Flash, facing: Facing): 'off' | 'on' | 'auto' | 'screen' {
  if (facing === 'front') return f === 'on' ? 'screen' : 'off';
  return f;
}

/** What the flash button says for the lens in use ('auto' on the front lens reads as off). */
export function flashLabel(f: Flash, facing: Facing): string {
  const shown = facing === 'front' && f === 'auto' ? 'off' : f;
  return shown === 'off' ? tr('끔', 'Off', 'オフ') : shown === 'auto' ? tr('자동', 'Auto', '自動') : tr('켬', 'On', 'オン');
}

/** Self-timer seconds: off, 3 or 10. Remembered like the flash. */
export type Timer = 0 | 3 | 10;

export const readTimer = (v: string): Timer => (v === '3' ? 3 : v === '10' ? 10 : 0);

/** off -> 3 s -> 10 s -> off. */
export const nextTimer = (t: Timer): Timer => (t === 0 ? 3 : t === 3 ? 10 : 0);

/** What the timer button says. */
export const timerLabel = (t: Timer): string => (t === 0 ? tr('끔', 'Off', 'オフ') : tr(`${t}초`, `${t}s`, `${t}秒`));

// paper border around the photo: 10 on three sides, 34 at the bottom for the date and buttons
export const PAPER_X = 20;
export const PAPER_Y = 44;
// the bottom margin's date, flip and share need this much paper; a tall narrow
// photo (some front lenses shoot 9:20) gets wider side borders instead
export const PAPER_MIN_W = 236;

/**
 * Today's print for a photo of aspect `ratio` (w/h), as large as fits in
 * `stage`: the paper's size and the photo's width inside it (centered).
 */
export function printSize(stage: { w: number; h: number } | null, ratio: number): { width: number; height: number; photo: number } {
  if (!stage) return { width: 0, height: 0, photo: 0 };
  const w = Math.min(stage.w - PAPER_X, (stage.h - PAPER_Y) * ratio);
  return { width: Math.floor(Math.max(w + PAPER_X, Math.min(PAPER_MIN_W, stage.w))), height: Math.floor(w / ratio + PAPER_Y), photo: Math.floor(w) };
}

/**
 * What the locked (already shot) camera screen keeps on a short phone, so
 * today's print stays the size of a print: the dead shutter circle goes first
 * (the countdown under it still says when the next roll loads), then the
 * year-ago card. `heightDp` is the window height.
 */
export function lockedLayout(heightDp: number): { shutter: boolean; echo: boolean } {
  return { shutter: heightDp >= 760, echo: heightDp >= 690 };
}

/**
 * CameraView `zoom` (0 = widest, 1 = the lens's max) after a pinch that went
 * from finger distance `d0` to `d`, starting at `z0`. Logarithmic, so spreading
 * the fingers twice as far always adds the same amount; clamped to 0..1.
 */
export function pinchZoom(z0: number, d0: number, d: number): number {
  if (!(d0 > 0) || !(d > 0)) return z0;
  return Math.min(1, Math.max(0, z0 + Math.log2(d / d0) * 0.35));
}

/** Distance between the first two touches of a gesture, or null with fewer than two. */
export function touchDistance(touches: readonly { pageX: number; pageY: number }[]): number | null {
  if (touches.length < 2) return null;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}
