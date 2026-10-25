/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseFilm, type Weather } from '../src/lib/film.ts';
import { blueNote, lightNote } from '../src/lib/light.ts';
import { reasonText, setLang } from '../src/lib/i18n.ts';

// Oct 11 2026 is near the new moon, so a clear night stays Night Tungsten (not Moon Silver)
const rise = new Date(2026, 9, 11, 6, 50);
const set = new Date(2026, 9, 11, 17, 40);
const at = (h: number, m: number, weather: Weather | null = { code: 1, cloud: 20 }) => chooseFilm({ now: new Date(2026, 9, 11, h, m), sunrise: rise, sunset: set, weather }).film;

test('blue hour: 40 to 75 minutes past sunset or before sunrise, on a clear sky', () => {
  assert.equal(at(18, 20), 'golden-roll'); // +40: still golden
  assert.equal(at(18, 21), 'blue-hour');
  assert.equal(at(18, 55), 'blue-hour'); // +75
  assert.equal(at(18, 56), 'night-tungsten');
  assert.equal(at(5, 40), 'blue-hour'); // sunrise -70
  assert.equal(at(5, 34), 'night-tungsten'); // -76
  assert.equal(at(6, 10), 'golden-roll'); // -40
  // cloud, rain or no weather: the night film as before
  assert.equal(at(18, 30, { code: 3, cloud: 90 }), 'night-tungsten');
  assert.equal(at(18, 30, { code: 1, cloud: 75 }), 'night-tungsten');
  assert.equal(at(18, 30, { code: 61 }), 'night-tungsten');
  assert.equal(at(18, 30, null), 'night-tungsten');
  // a birthday and a storm still win
  assert.equal(chooseFilm({ now: new Date(2026, 9, 11, 18, 30), sunrise: rise, sunset: set, weather: { code: 0 }, special: '생일' }).film, 'party-flash');
});

test('blue hour reasons read in three languages', () => {
  const r = chooseFilm({ now: new Date(2026, 9, 11, 18, 30), sunrise: rise, sunset: set, weather: { code: 0 } }).reason;
  assert.equal(r, "해 진 뒤 푸른 무렵 — 'Blue Hour'");
  setLang('en');
  assert.equal(reasonText(r), "Blue hour after sunset — 'Blue Hour'");
  setLang('ja');
  assert.equal(reasonText(chooseFilm({ now: new Date(2026, 9, 11, 5, 50), sunrise: rise, sunset: set, weather: { code: 0 } }).reason), "日の出前の青い時間 — 'Blue Hour'");
  setLang('ko');
});

test('viewfinder blue note follows the golden one, only when Blue Hour loads', () => {
  const now = (h: number, m: number) => new Date(2026, 9, 11, h, m);
  assert.equal(blueNote(now(18, 10), rise, set), ''); // golden window
  assert.notEqual(lightNote(now(18, 10), rise, set), '');
  assert.equal(blueNote(now(18, 43), rise, set), '푸른 빛 · 12분 남음');
  assert.equal(blueNote(now(5, 50), rise, set), '푸른 빛 · 20분 남음');
  assert.equal(blueNote(now(19, 0), rise, set), '');
  assert.equal(blueNote(now(18, 43), rise, set, () => false), '');
  assert.equal(blueNote(now(18, 43), null, null), '');
});
