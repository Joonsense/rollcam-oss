// Home and away for the Travel film: each photo counts one for the city cell
// (0.1°, the coarse place we already keep) it was shot in, and the cell with
// the most photos is home. A dry day far from home loads Travel. Kept on the
// device in kv like the place itself; pure, so it is unit tested.

type Place = { lat: number; lon: number };

/** Photos needed before any cell counts as home. */
export const HOME_MIN = 7;
/** How far from home a day counts as away. */
export const AWAY_KM = 150;

export const cellKey = (p: Place) => `${(Math.round(p.lat * 10) / 10).toFixed(1)},${(Math.round(p.lon * 10) / 10).toFixed(1)}`;

const fromKey = (k: string): Place => {
  const [lat, lon] = k.split(',').map(Number);
  return { lat, lon };
};

/** Counts after one more photo at `p` (a new object; the input is kept). */
export function countPlace(counts: Record<string, number>, p: Place): Record<string, number> {
  const k = cellKey(p);
  return { ...counts, [k]: (counts[k] ?? 0) + 1 };
}

/** The most photographed cell once it has HOME_MIN photos, else null. */
export function homeOf(counts: Record<string, number>): Place | null {
  let best: [string, number] | null = null;
  for (const [k, n] of Object.entries(counts)) if (!best || n > best[1]) best = [k, n];
  return best && best[1] >= HOME_MIN ? fromKey(best[0]) : null;
}

/** Great-circle distance in km. */
export function distanceKm(a: Place, b: Place): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Away from home right now: a known place more than AWAY_KM from a known home. */
export const isAway = (here: Place | null, counts: Record<string, number>) => {
  const home = homeOf(counts);
  return !!here && !!home && distanceKm(here, home) > AWAY_KM;
};

/** kv 'cells' JSON -> counts; anything unreadable starts over. */
export function readCells(v: string): Record<string, number> {
  try {
    const j = JSON.parse(v);
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch {
    return {};
  }
}
