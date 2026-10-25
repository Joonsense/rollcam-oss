// Pure maths for looking closely at a print (screens/ZoomPhoto.tsx).

export const MAX_ZOOM = 4;

/** Scale after a pinch from finger distance `d0` to `d`, starting at `k0`; held between 1x and MAX_ZOOM. */
export function pinchScale(k0: number, d0: number, d: number): number {
  if (!(d0 > 0) || !(d > 0)) return k0;
  return Math.min(MAX_ZOOM, Math.max(1, (k0 * d) / d0));
}

/** Keeps a scaled print covering its box: the offset can't show past an edge. */
export function clampPan(k: number, x: number, y: number, w: number, h: number): { x: number; y: number } {
  const mx = ((k - 1) * w) / 2;
  const my = ((k - 1) * h) / 2;
  const c = (v: number, m: number) => (m <= 0 ? 0 : Math.max(-m, Math.min(m, v)));
  return { x: c(x, mx), y: c(y, my) };
}
