/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeWeek, encodeWeek, parseWeek, samePlace, weekFilms, weekUrl } from '../src/lib/weekOutlook.ts';

const days = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
const noon = {
  code: [0, 61, 3, 0, 0, 71, 95, 0],
  temp: [18, 14, 15, 16, 30, 1, 20, 12],
  wind: [3, 4, 5, 12, 2, 3, 6, 2],
  cloud: [10, 90, 85, 10, 5, 100, 80, 20],
};
// hourly rows; every hour but noon carries a thunderstorm, which must not leak into the day
const time: string[] = [];
const code: number[] = [];
const temp: number[] = [];
const wind: number[] = [];
const cloud: number[] = [];
days.forEach((d, i) => {
  for (let h = 0; h < 24; h++) {
    time.push(`${d}T${String(h).padStart(2, '0')}:00`);
    const at = h === 12;
    code.push(at ? noon.code[i] : 95);
    temp.push(at ? noon.temp[i] : -5);
    wind.push(at ? noon.wind[i] : 0);
    cloud.push(at ? noon.cloud[i] : 0);
  }
});
const resp = { hourly: { time, weather_code: code, temperature_2m: temp, wind_speed_10m: wind, cloud_cover: cloud } };

test('week forecast: days after today, midday films with seasons and the first snow once', () => {
  const week = parseWeek(resp, '2026-10-25');
  assert.equal(week.length, 7);
  assert.equal(week[0].day, '2026-10-26');
  const films = weekFilms(week, { lat: 37.5, firstSnow: true }).map((f) => f.film);
  assert.deepEqual(films, ['rainy-mono', 'grey-portra', 'motion-lofi', 'autumn-maple', 'first-snow', 'storm-push', 'autumn-maple']);
  const later = weekFilms([week[4], { ...week[4], day: '2026-10-31' }], { lat: 37.5, firstSnow: true }).map((f) => f.film);
  assert.deepEqual(later, ['first-snow', 'snow-pastel']);
  assert.match(weekUrl(37.56, 126.97), /forecast_days=8/);
});

test('week cache round trip', () => {
  const w = parseWeek(resp, '2026-10-25');
  assert.deepEqual(decodeWeek(encodeWeek(w, 5))?.week, w);
  const c = decodeWeek(encodeWeek(w, 5, { lat: 37.5665, lon: 126.978 }))!;
  assert.ok(samePlace(c.place, { lat: 37.57, lon: 126.98 }));
  assert.ok(!samePlace(c.place, { lat: 35.1, lon: 129.0 }));
  assert.equal(decodeWeek('nope'), null);
});
