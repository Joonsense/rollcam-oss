/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysFromFull, isFullMoon, moonPhase } from '../src/lib/moon.ts';

// published full moons (UTC)
const FULL = [Date.UTC(2024, 0, 25, 17, 54), Date.UTC(2024, 11, 15, 9, 2), Date.UTC(2025, 9, 7, 3, 47), Date.UTC(2025, 11, 4, 23, 14)];

test('the phase lands on published full moons', () => {
  for (const t of FULL) {
    assert.ok(daysFromFull(new Date(t)) < 0.6, new Date(t).toISOString());
    assert.ok(isFullMoon(new Date(t)));
  }
});

test('a week either side is not full, new moon is phase 0', () => {
  for (const t of FULL) {
    assert.ok(!isFullMoon(new Date(t + 7 * 86400000)));
    assert.ok(!isFullMoon(new Date(t - 7 * 86400000)));
    const p = moonPhase(new Date(t + 14.77 * 86400000));
    assert.ok(p < 0.04 || p > 0.96, String(p));
  }
});

test('about two or three full-moon days a month', () => {
  let n = 0;
  for (let d = 0; d < 365; d++) if (isFullMoon(new Date(Date.UTC(2026, 0, 1 + d, 12)))) n++;
  assert.ok(n >= 20 && n <= 30, String(n));
});

test('a clear full-moon night loads Moon Silver; cloud, rain or no weather keep Night Tungsten', async () => {
  const { chooseFilm } = await import('../src/lib/film.ts');
  const { reasonText, setLang } = await import('../src/lib/i18n.ts');
  // 2025-10-07 03:47 UTC is a full moon; 21:00 KST the evening before
  const full = new Date(Date.UTC(2025, 9, 6, 12));
  const sun = { sunrise: new Date(Date.UTC(2025, 9, 6, 21, 30)), sunset: new Date(Date.UTC(2025, 9, 6, 9, 0)) };
  const at = (now: Date, weather: object | null) => chooseFilm({ now, ...sun, weather: weather as never }).film;
  assert.equal(at(full, { code: 0, cloud: 10 }), 'moon-silver');
  assert.equal(at(full, { code: 3, cloud: 90 }), 'night-tungsten');
  assert.equal(at(full, { code: 1, cloud: 70 }), 'night-tungsten');
  assert.equal(at(full, { code: 61 }), 'night-tungsten');
  assert.equal(at(full, null), 'night-tungsten');
  const week = new Date(full.getTime() + 7 * 86400000);
  assert.equal(chooseFilm({ now: week, sunrise: new Date(sun.sunrise.getTime() + 7 * 86400000), sunset: new Date(sun.sunset.getTime() + 7 * 86400000), weather: { code: 0 } }).film, 'night-tungsten');
  const r = chooseFilm({ now: full, ...sun, weather: { code: 0 } }).reason;
  setLang('en');
  assert.equal(reasonText(r), "A full-moon night — 'Moon Silver'");
  setLang('ja');
  assert.equal(reasonText(r), "満月の夜 — 'Moon Silver'");
  setLang('ko');
});
