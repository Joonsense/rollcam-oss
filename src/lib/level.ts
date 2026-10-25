// The viewfinder's level: how far the phone is turned off the horizon, from
// the accelerometer, so the one photo of the day comes out straight. Pure.

/** Within this many degrees the horizon reads as level. */
export const LEVEL_DEG = 1;
/** Past this the phone is held sideways or tipped too far for a level to mean anything. */
export const MAX_TILT = 30;

/**
 * Degrees the phone is turned clockwise from upright, from an accelerometer
 * reading in g. Android reports the up vector (upright: y = +1), iOS the pull
 * of gravity (upright: y = -1), so iOS flips both axes. Null while the phone
 * points at the floor or the sky (|z| near 1), where roll has no horizon.
 */
export function tiltDeg(x: number, y: number, z: number, os: string): number | null {
  if (Math.abs(z) > 0.8) return null;
  const [ux, uy] = os === 'ios' ? [-x, -y] : [x, y];
  return (Math.atan2(-ux, uy) * 180) / Math.PI;
}

/** Low-pass a reading into the previous value so the line doesn't jitter; null resets. */
export function smooth(prev: number | null, next: number | null, k = 0.25): number | null {
  if (next === null) return null;
  if (prev === null || Math.abs(next - prev) > 20) return next;
  return prev + (next - prev) * k;
}

/** What the level shows for a smoothed tilt: hidden, off level, or level. */
export function levelState(t: number | null): 'off' | 'tilted' | 'level' {
  if (t === null || Math.abs(t) > MAX_TILT) return 'off';
  return Math.abs(t) <= LEVEL_DEG ? 'level' : 'tilted';
}
