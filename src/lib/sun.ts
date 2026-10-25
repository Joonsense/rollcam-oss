// Approximate sunrise/sunset (NOAA simplified, ±2 min at mid latitudes).
// Used when the weather API gave no sun times (offline fallback, spec §6).

const rad = Math.PI / 180;

export type SunTimes = { sunrise: Date; sunset: Date } | null;

/** Local sunrise/sunset for the calendar day of `date`. Null in polar day/night. */
export function sunTimes(date: Date, lat: number, lon: number): SunTimes {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const noonUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const doy = Math.floor((noonUtc - start) / 86400000);
  const g = ((2 * Math.PI) / 365) * (doy - 1);
  const eqtime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosH < -1 || cosH > 1) return null;
  const ha = Math.acos(cosH) / rad;
  // minutes after UTC midnight
  const riseMin = 720 - 4 * (lon + ha) - eqtime;
  const setMin = 720 - 4 * (lon - ha) - eqtime;
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return { sunrise: new Date(utcMidnight + riseMin * 60000), sunset: new Date(utcMidnight + setMin * 60000) };
}

/** Seoul, used before we ever had a location fix. */
export const DEFAULT_PLACE = { lat: 37.5665, lon: 126.978 };

/**
 * Before any location fix: Seoul on a Korean clock (where the app started),
 * else nothing to fetch weather for. `offsetMin` is Date#getTimezoneOffset();
 * `zone` the IANA name when the platform has it, which tells Seoul from Tokyo
 * (both UTC+9).
 */
export const fallbackPlace = (offsetMin: number, zone?: string) => ((zone ? zone === 'Asia/Seoul' : offsetMin === -540) ? DEFAULT_PLACE : null);

/**
 * A rough place for sun times only, when there is no fix: the time zone's
 * longitude (15° an hour) at 40°N. Sunrise and sunset land within about an
 * hour, enough to tell day from night; never used for weather or seasons.
 */
export function sunGuess(offsetMin: number, zone?: string): { lat: number; lon: number } {
  return fallbackPlace(offsetMin, zone) ?? { lat: 40, lon: Math.max(-180, Math.min(180, -offsetMin / 4 || 0)) };
}
