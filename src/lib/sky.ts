// Colors for days without a photo (spec §3.3): not an empty slot but the color
// of that day's sky. Pure, so the roll and the share image agree.

import { tr } from './i18n.ts';

/** WMO daily weather code (+ max temp) -> a muted film-base color. */
export function skyColor(code: number | null | undefined, tempMax?: number | null): string {
  if (code === null || code === undefined) return '#2B2A33';
  if (code >= 95) return '#3A3550'; // storm violet
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '#C9CED6'; // snow
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '#4A5A6A'; // rain slate
  if (code === 45 || code === 48) return '#8E8A80'; // fog
  if (code === 3) return '#6E727A'; // overcast
  if (code === 1 || code === 2) return tempMax != null && tempMax >= 28 ? '#D9A55A' : '#8FA9BF'; // partly cloudy
  // clear
  if (tempMax != null && tempMax >= 28) return '#E3B04B';
  if (tempMax != null && tempMax <= 5) return '#9DB8CF';
  return '#7FA7C9';
}

/** One-word weather name for the roll caption. */
export function skyWord(code: number | null | undefined): string {
  if (code === null || code === undefined) return '';
  if (code >= 95) return tr('뇌우', 'Storm', '雷雨');
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return tr('눈', 'Snow', '雪');
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return tr('비', 'Rain', '雨');
  if (code === 45 || code === 48) return tr('안개', 'Fog', '霧');
  if (code === 3) return tr('흐림', 'Overcast', 'くもり');
  if (code === 1 || code === 2) return tr('구름 조금', 'Partly cloudy', '晴れ時々くもり');
  return tr('맑음', 'Clear', '晴れ');
}

/** The weather a photo was taken in, one line: '맑음 · 18° · 바람 3m/s'. */
export function weatherLine(w: { code?: number; tempC?: number; windMs?: number; cloud?: number } | null | undefined): string {
  if (!w) return '';
  const parts: string[] = [];
  const word = skyWord(w.code);
  if (word) parts.push(word);
  if (w.tempC !== undefined) parts.push(`${Math.round(w.tempC)}°`);
  if (w.windMs !== undefined && w.windMs >= 1) parts.push(tr(`바람 ${Math.round(w.windMs)}m/s`, `wind ${Math.round(w.windMs)}m/s`, `風 ${Math.round(w.windMs)}m/s`));
  if (w.cloud !== undefined && !word) parts.push(tr(`구름 ${Math.round(w.cloud)}%`, `clouds ${Math.round(w.cloud)}%`, `雲 ${Math.round(w.cloud)}%`));
  return parts.join(' · ');
}

export type DaySky = { code: number | null; tempMax: number | null };

/** Open-Meteo daily history for a month (forecast API reaches ~3 months back). */
export function monthSkyUrl(lat: number, lon: number, month: string, today: string): string | null {
  const start = `${month}-01`;
  if (start > today) return null;
  const [y, m] = month.split('-').map(Number);
  const last = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const end = last < today ? last : today;
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'weather_code,temperature_2m_max',
    timezone: 'auto',
    start_date: start,
    end_date: end,
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

export function parseMonthSky(j: { daily?: { time?: string[]; weather_code?: (number | null)[]; temperature_2m_max?: (number | null)[] } }): Record<string, DaySky> {
  const out: Record<string, DaySky> = {};
  const t = j.daily?.time ?? [];
  t.forEach((day, i) => {
    out[day] = { code: j.daily?.weather_code?.[i] ?? null, tempMax: j.daily?.temperature_2m_max?.[i] ?? null };
  });
  return out;
}
