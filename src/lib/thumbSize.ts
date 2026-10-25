// Pure sizing for lib/thumbs.ts, kept apart so tests run without Skia.

/** Long edge of a small copy: sharp in a year cover (~110pt at 3x) without being a print. */
export const THUMB_EDGE = 360;

/** Same aspect, long edge at most `edge`, never upscaled, at least 1px. */
export function thumbSize(w: number, h: number, edge = THUMB_EDGE): { w: number; h: number } {
  const k = Math.min(1, edge / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** '2026-10-25-1761370000000.jpg' -> 't360-2026-10-25-1761370000000.jpg'; the edge is in the name so a new size makes new files. */
export const thumbName = (file: string) => `t${THUMB_EDGE}-${file}`;
