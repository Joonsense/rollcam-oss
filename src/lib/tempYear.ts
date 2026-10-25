// "올해의 온도": the temperature each photo of a year was taken in, as points
// along the year, with the warmest and the coldest day. Pure; drawn by
// screens/TempLine.tsx.

type ShotLike = { day: string; film: string; weather: { tempC?: number } | null };

export type TempPoint = { day: string; film: string; temp: number; x: number; y: number };

/** Past this many photos a line through every one is a scribble: draw the week's average instead. */
export const SMOOTH_FROM = 45;

const dayOfYear = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
};

/**
 * Points scaled into a w x h box (and the line through them: the points
 * themselves, or a 7-day average past SMOOTH_FROM photos) (x by day of the year, y by temperature, warm
 * at the top), the year's warmest and coldest shot; null with fewer than 3
 * photos that know their temperature.
 */
export function tempYear(year: number, shots: ShotLike[], w: number, h: number, pad = 6): { points: TempPoint[]; line: { x: number; y: number }[]; hot: TempPoint; cold: TempPoint } | null {
  const known = shots.filter((s) => s.day.startsWith(`${year}-`) && typeof s.weather?.tempC === 'number').sort((a, b) => a.day.localeCompare(b.day));
  if (known.length < 3) return null;
  const temps = known.map((s) => s.weather!.tempC!);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = Math.max(1, hi - lo);
  const days = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
  const points = known.map((s, i) => ({
    day: s.day,
    film: s.film,
    temp: temps[i],
    x: pad + (dayOfYear(s.day) / (days - 1)) * (w - pad * 2),
    y: pad + ((hi - temps[i]) / span) * (h - pad * 2),
  }));
  const hot = points.reduce((a, b) => (b.temp > a.temp ? b : a));
  const cold = points.reduce((a, b) => (b.temp < a.temp ? b : a));
  // a busy year: each point's line height is the mean of the photos within 3 days of it
  const doy = known.map((k) => dayOfYear(k.day));
  const line =
    points.length > SMOOTH_FROM
      ? points.map((p, i) => {
          let sum = 0;
          let n = 0;
          for (let j = 0; j < points.length; j++) {
            if (Math.abs(doy[j] - doy[i]) <= 3) {
              sum += temps[j];
              n++;
            }
          }
          return { x: p.x, y: pad + ((hi - sum / n) / span) * (h - pad * 2) };
        })
      : points.map((p) => ({ x: p.x, y: p.y }));
  return { points, line, hot, cold };
}
