// Geometry for the "필름 컷" share image (cut.ts): one photo as a frame on a
// strip of 35mm negative running top to bottom across a light table, the
// days before and after it just showing above and below. Pure numbers so the
// layout is tested and a Mac preview script can draw the same thing.

export const CUT_W = 1080;
export const CUT_H = 1350;

const STRIP_W = 760;
const HOLE_W = 34;
const HOLE_H = 46;
const HOLE_PITCH = 76;
const HOLE_INSET = 30; // strip edge to sprocket hole
const FRAME_INSET = 104; // strip edge to frame: holes plus the edge-print rebate
const MAX_FRAME_H = 840;
const GAP = 44; // between frames
const CENTER_Y = 640; // a little above the middle, the eye sits there

export type Rect = { x: number; y: number; w: number; h: number };

export type CutLayout = {
  strip: Rect;
  frame: Rect; // today's photo
  prev: Rect; // the frame above (yesterday)
  next: Rect; // the frame below
  holes: Rect[];
  /** x of the left and right edge-print lines (text runs along the strip) */
  edge: [number, number];
};

/** Layout for a photo of aspect `ratio` (w/h): as wide as the strip allows, capped in height. */
export function cutLayout(ratio: number): CutLayout {
  const r = ratio > 0 && Number.isFinite(ratio) ? ratio : 0.75;
  const sx = (CUT_W - STRIP_W) / 2;
  let fw = STRIP_W - FRAME_INSET * 2;
  let fh = fw / r;
  if (fh > MAX_FRAME_H) {
    fh = MAX_FRAME_H;
    fw = fh * r;
  }
  const frame = { x: (CUT_W - fw) / 2, y: CENTER_Y - fh / 2, w: fw, h: fh };
  const holes: Rect[] = [];
  // holes run on a fixed pitch from above the canvas to below it
  for (let y = -HOLE_PITCH + ((CENTER_Y - HOLE_H / 2) % HOLE_PITCH); y < CUT_H + HOLE_PITCH; y += HOLE_PITCH) {
    holes.push({ x: sx + HOLE_INSET, y, w: HOLE_W, h: HOLE_H });
    holes.push({ x: sx + STRIP_W - HOLE_INSET - HOLE_W, y, w: HOLE_W, h: HOLE_H });
  }
  const rebate = (FRAME_INSET - HOLE_INSET - HOLE_W) / 2;
  return {
    strip: { x: sx, y: 0, w: STRIP_W, h: CUT_H },
    frame,
    prev: { ...frame, y: frame.y - GAP - fh },
    next: { ...frame, y: frame.y + fh + GAP },
    holes,
    edge: [sx + HOLE_INSET + HOLE_W + rebate, sx + STRIP_W - HOLE_INSET - HOLE_W - rebate],
  };
}

/** Edge print along the left rebate: stock, date and frame, like a lab's film edge. */
export function edgeLeft(day: string): string {
  return `ROLLCAM 400   ${day.replaceAll('-', '.')}   ${Number(day.slice(8))}A`;
}

/** Along the right rebate: the film name in caps. */
export const edgeRight = (filmName: string, lucky = false) => `${filmName.toUpperCase()}   ${lucky ? 'LUCKY CUT' : 'SAFETY FILM'}`;
