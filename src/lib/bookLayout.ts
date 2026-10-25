// Geometry for the film book share image (bookShare.ts): a 9:16 story card,
// a header, then the film slots 3 across. Pure so it is tested and a Mac
// preview can draw the same thing.

export const BOOK_W = 1080;
export const BOOK_H = 1920;
const X = 72;
const GAP = 22;
const COLS = 3;
const TOP = 420; // below the title block, inside the story safe area
const BOTTOM = 1700;

export type Slot = { x: number; y: number; w: number; h: number; cover: number };

/** Slots for `n` films: 3 across, cover 4:5, a name band under it, rows fitted between TOP and BOTTOM. */
export function bookSlots(n: number): Slot[] {
  const rows = Math.ceil(n / COLS);
  const w = (BOOK_W - X * 2 - GAP * (COLS - 1)) / COLS;
  const band = 54;
  const fullH = w * 1.25 + band;
  const h = Math.min(fullH, (BOTTOM - TOP - GAP * (rows - 1)) / rows);
  const cover = h - band;
  return Array.from({ length: n }, (_, i) => ({ x: X + (i % COLS) * (w + GAP), y: TOP + Math.floor(i / COLS) * (h + GAP), w, h, cover }));
}
