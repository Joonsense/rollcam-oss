/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeOutlook, encodeOutlook, outlookSlots, outlookUrl, parseOutlook } from '../src/lib/outlook.ts';

// Seoul (+9h), tomorrow 2026-10-24: rain in the morning, clearing, clear night
const hours = Array.from({ length: 48 }, (_, i) => `2026-10-${i < 24 ? 23 : 24}T${String(i % 24).padStart(2, '0')}:00`);
const code = hours.map((t) => (t.startsWith('2026-10-24') && Number(t.slice(11, 13)) < 11 ? 63 : 1));
const resp = {
  utc_offset_seconds: 32400,
  hourly: { time: hours, weather_code: code, temperature_2m: hours.map(() => 15), cloud_cover: hours.map(() => 20), wind_speed_10m: hours.map(() => 3) },
  daily: { time: ['2026-10-23', '2026-10-24'], sunrise: ['2026-10-23T06:52', '2026-10-24T06:53'], sunset: ['2026-10-23T17:50', '2026-10-24T17:49'] },
};

test('outlook url sends only city-level coordinates', () => {
  const u = outlookUrl(37.56651, 126.97801);
  assert.match(u, /latitude=37\.6&longitude=127/);
  assert.match(u, /forecast_days=2/);
});

test('outlook keeps only the asked day and converts local times', () => {
  const o = parseOutlook(resp, '2026-10-24')!;
  assert.equal(o.hours.length, 24);
  assert.equal(o.hours[0].at.toISOString(), '2026-10-23T15:00:00.000Z');
  assert.equal(o.sunset!.toISOString(), '2026-10-24T08:49:00.000Z');
  assert.equal(parseOutlook(resp, '2026-10-26'), null);
});

test('outlook slots: rainy morning, golden sunset, blue hour, night; same films merge', () => {
  process.env.TZ = 'Asia/Seoul';
  const o = parseOutlook(resp, '2026-10-24')!;
  const slots = outlookSlots(o, null);
  assert.deepEqual(slots.map((s) => s.film), ['rainy-mono', 'daily-negative', 'golden-roll', 'blue-hour', 'night-tungsten']);
  assert.deepEqual(slots[3].labels, ['해 진 뒤']);
  // a cloudy evening has no blue hour: the moment is left out, not merged into the night
  const dull = { ...o, hours: o.hours.map((h) => ({ ...h, weather: { ...h.weather, cloud: h.at.getHours() >= 18 ? 90 : 20 } })) };
  assert.deepEqual(outlookSlots(dull, null).at(-1)!.labels, ['밤']);
  assert.deepEqual(slots[1].labels, ['한낮', '오후']);
  assert.deepEqual(outlookSlots(o, '생일').map((s) => s.film), ['party-flash']);
  // grey morning and afternoon around a clear noon: one Grey Portra entry
  const grey = { ...o, hours: o.hours.map((h) => ({ ...h, weather: { ...h.weather, code: 3, cloud: h.at.getHours() === 12 || h.at.getHours() === 13 ? 10 : 90 } })) };
  const g = outlookSlots(grey, null)[0];
  assert.deepEqual([g.film, g.labels, g.at.map((d) => d.getHours())], ['grey-portra', ['아침', '오후'], [9, 15]]);
  // snow tomorrow with no snow photo yet this winter: the forecast says First Snow
  const snowy = { ...o, hours: o.hours.map((h) => ({ ...h, weather: { ...h.weather, code: 73 } })) };
  assert.deepEqual(outlookSlots(snowy, null, true).map((s) => s.film), ['first-snow']);
  assert.equal(outlookSlots(snowy, null, false)[0].film, 'snow-pastel');
  const back = decodeOutlook(encodeOutlook(o, 5))!;
  assert.equal(back.at, 5);
  assert.deepEqual(outlookSlots(back.outlook, null), slots);
});

test('outlook alert: earliest missing film, an hour ahead, skipped once shot', async () => {
  const { outlookAlert } = await import('../src/lib/remind.ts');
  const t = (h: number, m = 0) => new Date(2026, 9, 24, h, m);
  const slots = [
    { film: 'grey-portra' as const, labels: ['아침', '오후'], at: [t(9), t(15, 30)] },
    { film: 'golden-roll' as const, labels: ['해 질 녘'], at: [t(17, 34)] },
    { film: 'night-tungsten' as const, labels: ['밤'], at: [t(21)] },
  ];
  const now = new Date(2026, 9, 23, 20);
  const a = outlookAlert(now, '2026-10-24', slots, new Set(['golden-roll', 'night-tungsten']), new Set())!;
  assert.equal(a.date.getHours() * 60 + a.date.getMinutes(), 8 * 60);
  assert.equal(a.body, '도감에 없는 필름이 와요 · 오늘 아침 Grey Portra');
  // morning already past on the day itself: the afternoon moment of the same film
  const b = outlookAlert(t(10), '2026-10-24', slots, new Set(['golden-roll', 'night-tungsten']), new Set())!;
  assert.equal(b.body, '도감에 없는 필름이 와요 · 오늘 오후 Grey Portra');
  assert.equal(outlookAlert(now, '2026-10-24', slots, new Set(['grey-portra', 'golden-roll', 'night-tungsten']), new Set()), null);
  assert.equal(outlookAlert(now, '2026-10-24', slots, new Set(), new Set(['2026-10-24'])), null);
  const snow = outlookAlert(now, '2026-10-24', [{ film: 'first-snow' as const, labels: ['아침'], at: [t(9)] }], new Set(), new Set())!;
  assert.match(snow.body, /첫눈 예보 · 오늘 아침/);
  // a midnight-ish moment alerts the evening before
  const late = outlookAlert(now, '2026-10-24', [{ film: 'night-tungsten' as const, labels: ['새벽'], at: [t(0, 30)] }], new Set(), new Set())!;
  assert.equal(late.body, '도감에 없는 필름이 와요 · 내일 새벽 Night Tungsten');
});
