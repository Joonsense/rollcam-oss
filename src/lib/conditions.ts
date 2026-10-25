// Where am I and what's the sky doing, with the offline ladder from spec §6:
// fresh weather -> today's cached weather -> time + sun only.

import * as Location from 'expo-location';
import { getSetting, setSetting } from './store';
import { fallbackPlace, sunGuess, sunTimes } from './sun';
import { CACHE_MS, coarse, decode, encode, fetchConditions, todaysSun, usable, type Conditions } from './weather';
import type { FilmInput } from './film';
import { monthSkyUrl, parseMonthSky, type DaySky } from './sky';
import { decodeOutlook, encodeOutlook, outlookUrl, parseOutlook, type Outlook } from './outlook';
import { dayKey } from './day';
import { decodeWeek, encodeWeek, parseWeek, samePlace, weekUrl, type WeekDay } from './weekOutlook';

import { countPlace, isAway, readCells } from './home';

type Place = { lat: number; lon: number };

/**
 * The last city-level fix; before the first one, Seoul on a Korean clock and
 * otherwise null: no weather is fetched for a place we don't know.
 */
export function lastPlace(): Place | null {
  try {
    const p = JSON.parse(getSetting('place', '')) as Place;
    if (typeof p.lat === 'number' && typeof p.lon === 'number') return p;
  } catch {}
  return fallbackPlace(new Date().getTimezoneOffset(), zone());
}

/** The last real city-level fix, without the Seoul fallback; null before any. */
function fixedPlace(): Place | null {
  try {
    const p = JSON.parse(getSetting('place', '')) as Place;
    if (typeof p.lat === 'number' && typeof p.lon === 'number') return p;
  } catch {}
  return null;
}

/** After a photo: one more for the city it was shot in (home.ts), when we know the city. */
export function notePlace(): void {
  const p = fixedPlace();
  if (p) setSetting('cells', JSON.stringify(countPlace(readCells(getSetting('cells', '')), p)));
}

/** The phone's IANA time zone ('Asia/Seoul'), if Intl knows it. */
function zone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** Where to compute sunrise and sunset: the known place, else a guess from the time zone. */
export const sunPlace = (now: Date): Place => lastPlace() ?? sunGuess(now.getTimezoneOffset(), zone());

async function locate(ask: boolean): Promise<Place | null> {
  const cur = await Location.getForegroundPermissionsAsync();
  let granted = cur.granted;
  if (!granted && ask && cur.canAskAgain) granted = (await Location.requestForegroundPermissionsAsync()).granted;
  if (!granted) return null;
  // Fresh fix first (city-level is fast); a stale last-known position would pick
  // the film for the city you flew out of.
  const fresh = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest, mayShowUserSettingsDialog: false }).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 3000)),
  ]);
  const pos = fresh ?? (await Location.getLastKnownPositionAsync({ maxAge: CACHE_MS }));
  if (!pos) return null;
  // store only city-level coordinates
  const p = { lat: coarse(pos.coords.latitude), lon: coarse(pos.coords.longitude) };
  setSetting('place', JSON.stringify(p));
  return p;
}

/** Refresh the weather cache if it is older than an hour. Never throws. */
export async function refreshConditions(ask: boolean): Promise<Conditions | null> {
  const cached = decode(getSetting('wx', ''));
  // a reading from before midnight is not today's, even if it is under an hour old
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS && usable(cached, new Date())) return cached;
  try {
    const place = (await locate(ask)) ?? lastPlace();
    // no fix and nowhere to assume: time and sun only (filmInputs)
    if (!place) return cached;
    const c = await fetchConditions(place.lat, place.lon);
    setSetting('wx', encode(c));
    return c;
  } catch {
    return cached;
  }
}

/**
 * Daily sky for a month (for missed-day colors). Past months are cached for
 * good; the current month is refetched after 6 hours. Never throws.
 */
export async function monthSky(month: string, today: string): Promise<Record<string, DaySky>> {
  const key = `sky:${month}`;
  let cached: { at: number; days: Record<string, DaySky> } | null = null;
  try {
    cached = JSON.parse(getSetting(key, 'null'));
  } catch {}
  const current = today.startsWith(month);
  if (cached && (!current || Date.now() - cached.at < 6 * CACHE_MS)) return cached.days;
  const p = lastPlace();
  const url = p ? monthSkyUrl(p.lat, p.lon, month, today) : null;
  if (!url) return cached?.days ?? {};
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const days = parseMonthSky(await r.json());
    setSetting(key, JSON.stringify({ at: Date.now(), days }));
    return days;
  } catch {
    return cached?.days ?? {};
  }
}

/** Inputs for chooseFilm at shutter time, using whatever we have. */
export function filmInputs(now: Date): Pick<FilmInput, 'sunrise' | 'sunset' | 'weather' | 'lat' | 'away'> {
  const c = usable(decode(getSetting('wx', '')), now);
  const lat = lastPlace()?.lat ?? null;
  const away = isAway(fixedPlace(), readCells(getSetting('cells', '')));
  const sun0 = todaysSun(c, now);
  if (c && sun0) return { ...sun0, weather: c.weather, lat, away };
  const p = sunPlace(now);
  const sun = sunTimes(now, p.lat, p.lon);
  return { sunrise: sun?.sunrise, sunset: sun?.sunset, weather: c?.weather ?? null, lat, away };
}

/**
 * Tomorrow's hourly forecast for the film outlook, refetched after 3 hours.
 * Uses the last known city, never asks for location. Never throws.
 */
export async function tomorrowOutlook(now = new Date()): Promise<Outlook | null> {
  const day = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const cached = decodeOutlook(getSetting('outlook', ''));
  const fresh = cached?.outlook.day === day ? cached : null;
  if (fresh && now.getTime() - fresh.at < 3 * CACHE_MS) return fresh.outlook;
  try {
    const p = lastPlace();
    if (!p) return fresh?.outlook ?? null;
    const r = await fetch(outlookUrl(p.lat, p.lon));
    if (!r.ok) throw new Error(String(r.status));
    const o = parseOutlook(await r.json(), day);
    if (o) setSetting('outlook', encodeOutlook(o, now.getTime()));
    return o ?? fresh?.outlook ?? null;
  } catch {
    return fresh?.outlook ?? null;
  }
}

/** The next seven days at noon for the film book (kv 'week2': noon values replaced the daily summary), refetched after 6 hours. Last known city only; never throws. */
export async function weekOutlook(now = new Date()): Promise<WeekDay[] | null> {
  const today = dayKey(now);
  const p = lastPlace();
  const cached = decodeWeek(getSetting('week2', ''));
  // another city's forecast is no forecast here
  const mine = cached && p && samePlace(cached.place, p) ? cached : null;
  const usable = mine ? mine.week.filter((w) => w.day > today) : null;
  if (mine && usable?.length && now.getTime() - mine.at < 6 * CACHE_MS) return usable;
  if (!p) return null;
  try {
    const r = await fetch(weekUrl(p.lat, p.lon));
    if (!r.ok) throw new Error(String(r.status));
    const week = parseWeek(await r.json(), today);
    if (week.length) setSetting('week2', encodeWeek(week, now.getTime(), p));
    return week.length ? week : usable;
  } catch {
    return usable?.length ? usable : null;
  }
}
