// Tomorrow's film forecast for the locked screen: run the same film choice the
// shutter uses at a few times of tomorrow, on Open-Meteo's hourly forecast, and
// group the times by film. Pure except for the URL; the caller fetches.

import { coarse } from './weather.ts';
import { chooseFilm, type FilmId, type Weather } from './film.ts';
import { tr } from './i18n.ts';

export type HourWx = { at: Date; weather: Weather };
export type Outlook = { day: string; sunrise: Date | null; sunset: Date | null; hours: HourWx[] };
/** One film and the moments it is forecast for (`at[i]` is when `labels[i]` is). */
export type OutlookSlot = { film: FilmId; labels: string[]; at: Date[] };

export function outlookUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: String(coarse(lat)),
    longitude: String(coarse(lon)),
    hourly: 'temperature_2m,weather_code,cloud_cover,wind_speed_10m',
    daily: 'sunrise,sunset',
    timezone: 'auto',
    wind_speed_unit: 'ms',
    forecast_days: '2',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

/** Open-Meteo local 'YYYY-MM-DDTHH:mm' + utc offset -> Date. */
function localIso(s: string | undefined, off: number): Date | null {
  if (!s) return null;
  const [d, t] = s.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h, mi) - off * 1000);
}

type Resp = {
  utc_offset_seconds?: number;
  hourly?: { time?: string[]; temperature_2m?: (number | null)[]; weather_code?: (number | null)[]; cloud_cover?: (number | null)[]; wind_speed_10m?: (number | null)[] };
  daily?: { time?: string[]; sunrise?: string[]; sunset?: string[] };
};

const num = (v: number | null | undefined) => (typeof v === 'number' ? v : undefined);

/** Keeps only `day` ('YYYY-MM-DD', local to the place): its hours and sun times. */
export function parseOutlook(j: Resp, day: string): Outlook | null {
  const off = j.utc_offset_seconds ?? 0;
  const h = j.hourly ?? {};
  const hours: HourWx[] = [];
  (h.time ?? []).forEach((t, i) => {
    if (!t.startsWith(day)) return;
    const at = localIso(t, off);
    if (at) hours.push({ at, weather: { code: num(h.weather_code?.[i]), tempC: num(h.temperature_2m?.[i]), cloud: num(h.cloud_cover?.[i]), windMs: num(h.wind_speed_10m?.[i]) } });
  });
  if (!hours.length) return null;
  const di = (j.daily?.time ?? []).indexOf(day);
  return { day, hours, sunrise: di < 0 ? null : localIso(j.daily?.sunrise?.[di], off), sunset: di < 0 ? null : localIso(j.daily?.sunset?.[di], off) };
}

/**
 * Films for a handful of moments: morning, midday, afternoon, the light at
 * sunset and night. Moments with the same film merge (in first-seen order),
 * so a grey day reads as one line.
 */
export function outlookSlots(o: Outlook, special: string | null, firstSnow = false, lat?: number | null): OutlookSlot[] {
  const [y, m, d] = o.day.split('-').map(Number);
  const near = (t: Date) => o.hours.reduce((a, b) => (Math.abs(b.at.getTime() - t.getTime()) < Math.abs(a.at.getTime() - t.getTime()) ? b : a));
  const moments: [string, Date][] = [
    [tr('아침', 'Morning', '朝'), new Date(y, m - 1, d, 9)],
    [tr('한낮', 'Midday', '昼'), new Date(y, m - 1, d, 12, 30)],
    [tr('오후', 'Afternoon', '午後'), new Date(y, m - 1, d, 15, 30)],
  ];
  if (o.sunset) moments.push([tr('해 질 녘', 'Dusk', '夕暮れ'), new Date(o.sunset.getTime() - 15 * 60000)]);
  // the middle of the blue hour (film.ts BLUE_MIN), listed only when Blue Hour is forecast there
  const blueAt = o.sunset ? new Date(o.sunset.getTime() + 58 * 60000) : null;
  if (blueAt) moments.push([tr('해 진 뒤', 'After sunset', '日没後'), blueAt]);
  // 'Evening', not 'Night': the label sits next to the film name, and 'Night Night Tungsten' reads badly
  moments.push([tr('밤', 'Evening', '夜'), new Date(y, m - 1, d, 21)]);
  const out: OutlookSlot[] = [];
  for (const [label, now] of moments) {
    const { film } = chooseFilm({ now, sunrise: o.sunrise ?? undefined, sunset: o.sunset ?? undefined, weather: near(now).weather, special, firstSnow, lat });
    if (now === blueAt && film !== 'blue-hour') continue;
    const same = out.find((x) => x.film === film);
    if (same) {
      same.labels.push(label);
      same.at.push(now);
    } else out.push({ film, labels: [label], at: [now] });
  }
  return out;
}

/** Serialize for the kv cache (Dates as epoch ms). */
export function encodeOutlook(o: Outlook, at: number): string {
  return JSON.stringify({ at, day: o.day, sunrise: o.sunrise?.getTime() ?? null, sunset: o.sunset?.getTime() ?? null, hours: o.hours.map((h) => [h.at.getTime(), h.weather]) });
}

export function decodeOutlook(s: string): { at: number; outlook: Outlook } | null {
  try {
    const j = JSON.parse(s);
    const hours = (j.hours as [number, Weather][]).map(([t, weather]) => ({ at: new Date(t), weather }));
    return { at: j.at, outlook: { day: j.day, hours, sunrise: j.sunrise ? new Date(j.sunrise) : null, sunset: j.sunset ? new Date(j.sunset) : null } };
  } catch {
    return null;
  }
}
