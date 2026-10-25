// "롤 재생": the month's prints flipped through like a projector reel.
// Pure timing and labels; the screen is screens/RollPlayer.tsx.

import { tr } from './i18n.ts';

/** Milliseconds a frame stays up, slow to fast. The middle one is the default. */
export const SPEEDS = [900, 450, 220] as const;
const SPEED_KO = ['느리게', '보통', '빠르게'] as const;
const SPEED_EN = ['Slow', 'Normal', 'Fast'] as const;
const SPEED_JA = ['ゆっくり', 'ふつう', '速く'] as const;
/** The speed button's word for speed `i`. */
export const speedName = (i: number) => tr(SPEED_KO[i], SPEED_EN[i], SPEED_JA[i]);

/** Next frame index, or null at the end (the reel stops on the last frame). */
export const nextFrame = (i: number, n: number): number | null => (i + 1 < n ? i + 1 : null);

/** Next speed index, cycling. */
export const nextSpeed = (i: number) => (i + 1) % SPEEDS.length;

/**
 * How long the whole reel runs at a speed, for the screen reader and the
 * '약 N초' line: every frame its interval, the last one included.
 */
export const reelSeconds = (n: number, speed: number) => Math.round((n * SPEEDS[speed]) / 1000);

/** Projector counter for frame i of n: '07 / 24'. */
export const counter = (i: number, n: number) => `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
