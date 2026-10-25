/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellKey, countPlace, distanceKm, homeOf, isAway, readCells } from '../src/lib/home.ts';

const seoul = { lat: 37.6, lon: 127.0 };
const busan = { lat: 35.2, lon: 129.1 };
const suwon = { lat: 37.3, lon: 127.0 };

test('cells and distance', () => {
  assert.equal(cellKey({ lat: 37.56651, lon: 126.978 }), '37.6,127.0');
  assert.ok(Math.abs(distanceKm(seoul, busan) - 325) < 15);
  assert.ok(distanceKm(seoul, suwon) < 40);
});

test('home is the most photographed cell once it has seven photos', () => {
  let c: Record<string, number> = {};
  for (let i = 0; i < 6; i++) c = countPlace(c, seoul);
  assert.equal(homeOf(c), null);
  c = countPlace(countPlace(c, busan), seoul);
  assert.deepEqual(homeOf(c), seoul);
  assert.equal(isAway(busan, c), true);
  assert.equal(isAway(suwon, c), false);
  assert.equal(isAway(null, c), false);
  assert.equal(isAway(busan, {}), false);
});

test('unreadable cells start over', () => {
  assert.deepEqual(readCells(''), {});
  assert.deepEqual(readCells('[1]'), {});
  assert.deepEqual(readCells('{"37.6,127.0":3}'), { '37.6,127.0': 3 });
});

test('far from home on a dry day loads Postcard; weather and night still win', async () => {
  const { chooseFilm } = await import('../src/lib/film.ts');
  const { reasonText, setLang } = await import('../src/lib/i18n.ts');
  const rise = new Date(2026, 9, 11, 6, 50);
  const set = new Date(2026, 9, 11, 17, 40);
  const at = (h: number, weather: object, away = true) => chooseFilm({ now: new Date(2026, 9, 11, h), sunrise: rise, sunset: set, weather, away });
  assert.equal(at(13, { code: 1, cloud: 90 }).film, 'postcard');
  assert.equal(at(13, { code: 1 }, false).film, 'daily-negative');
  assert.equal(at(13, { code: 61 }).film, 'rainy-mono');
  assert.equal(at(21, { code: 0 }).film, 'night-tungsten');
  const r = at(13, { code: 0 }).reason;
  assert.equal(r, "멀리 떠나온 한낮 — 'Postcard'");
  setLang('en');
  assert.equal(reasonText(r), "A midday far from home — 'Postcard'");
  setLang('ko');
});
