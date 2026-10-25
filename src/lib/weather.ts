// Open-Meteo: free, no key, so the app can call it directly without leaking a
// secret (spec §6). Only city-level coordinates are sent (rounded to 0.1°).

import type { Weather } from './film.ts';

export type Conditions = { weather: Weather; sunrise: Date | null; sunset: Date | null; fetchedAt: number };

export const CACHE_MS = 60 * 60 * 1000;

/** ~11 km grid: enough for weather, not enough to locate a home. */
export const coarse = (v: number) => Math.round(v * 10) / 10;

export function forecastUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: String(coarse(lat)),
    longitude: String(coarse(lon)),
    current: 'temperature_2m,weather_code,cloud_cover,wind_speed_10m',
    daily: 'sunrise,sunset',
    timezone: 'auto',
    wind_speed_unit: 'ms',
    forecast_days: '1',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

/** Open-Meteo local time 'YYYY-MM-DDTHH:mm' + utc offset -> Date. */
function localIso(s: string | undefined, offsetSec: number): Date | null {
  if (!s) return null;
  const [d, t] = s.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h, mi) - offsetSec * 1000);
}

type Resp = {
  utc_offset_seconds?: number;
  current?: { temperature_2m?: number; weather_code?: number; cloud_cover?: number; wind_speed_10m?: number };
  daily?: { sunrise?: string[]; sunset?: string[] };
};

export function parseForecast(j: Resp, now: number): Conditions {
  const off = j.utc_offset_seconds ?? 0;
  const c = j.current ?? {};
  return {
    weather: { code: c.weather_code, cloud: c.cloud_cover, tempC: c.temperature_2m, windMs: c.wind_speed_10m },
    sunrise: localIso(j.daily?.sunrise?.[0], off),
    sunset: localIso(j.daily?.sunset?.[0], off),
    fetchedAt: now,
  };
}

export async function fetchConditions(lat: number, lon: number, timeoutMs = 4000): Promise<Conditions> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(forecastUrl(lat, lon), { signal: ctl.signal });
    if (!r.ok) throw new Error(`weather ${r.status}`);
    return parseForecast((await r.json()) as Resp, Date.now());
  } finally {
    clearTimeout(t);
  }
}

/** Serialize for the kv cache (Dates as epoch ms). */
export const encode = (c: Conditions) =>
  JSON.stringify({ ...c, sunrise: c.sunrise?.getTime() ?? null, sunset: c.sunset?.getTime() ?? null });

export function decode(s: string): Conditions | null {
  try {
    const j = JSON.parse(s);
    return { weather: j.weather, fetchedAt: j.fetchedAt, sunrise: j.sunrise ? new Date(j.sunrise) : null, sunset: j.sunset ? new Date(j.sunset) : null };
  } catch {
    return null;
  }
}

/** A cached reading is usable for film choice only on the same local day. */
/**
 * The forecast's sunrise and sunset only when they are today's: a reading can
 * carry another day's sun (the service's "today" is the place's date, which
 * can differ from the phone's after a time zone or clock change), and a
 * yesterday's sunset would load Night Tungsten all afternoon.
 */
export function todaysSun(c: Pick<Conditions, 'sunrise' | 'sunset'> | null, now: Date): { sunrise: Date; sunset: Date } | null {
  if (!c?.sunrise || !c.sunset) return null;
  const today = now.toDateString();
  return c.sunrise.toDateString() === today && c.sunset.toDateString() === today ? { sunrise: c.sunrise, sunset: c.sunset } : null;
}

export function usable(c: Conditions | null, now: Date, maxAgeMs = CACHE_MS * 6): Conditions | null {
  if (!c) return null;
  if (now.getTime() - c.fetchedAt > maxAgeMs) return null;
  return new Date(c.fetchedAt).toDateString() === now.toDateString() ? c : null;
}
