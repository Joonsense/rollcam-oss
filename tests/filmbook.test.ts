/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILM_HINTS, FILM_NAMES, type FilmId } from '../src/lib/film.ts';
import { BOOK_ORDER, bookLine, filmBook } from '../src/lib/filmbook.ts';

const shot = (day: string, film: FilmId) => ({ day, film });

test('film book: every film has one slot and a hint', () => {
  assert.deepEqual([...BOOK_ORDER].sort(), Object.keys(FILM_NAMES).sort());
  for (const f of BOOK_ORDER) assert.ok(FILM_HINTS[f]);
});

test('film book: fills slots in day order, newest first-load wins', () => {
  const b = filmBook([shot('2026-10-05', 'rainy-mono'), shot('2026-10-01', 'daily-negative'), shot('2026-10-03', 'rainy-mono'), shot('2026-10-04', 'golden-roll')]);
  assert.equal(b.entries.length, 18);
  assert.equal(b.found, 3);
  const rainy = b.entries.find((e) => e.film === 'rainy-mono')!;
  assert.deepEqual(rainy.shots.map((s) => s.day), ['2026-10-03', '2026-10-05']);
  assert.equal(rainy.first, '2026-10-03');
  // rainy-mono first loaded 10-03, golden-roll 10-04: golden is the newest find
  assert.equal(b.newest, 'golden-roll');
  assert.equal(b.entries.find((e) => e.film === 'storm-push')!.first, null);
  assert.equal(bookLine(b), '18종 중 3종 · 남은 필름 15종');
});

test('film book: empty and complete lines', () => {
  assert.equal(filmBook([]).newest, null);
  assert.match(bookLine(filmBook([])), /채워져요/);
  const all = filmBook(BOOK_ORDER.map((f, i) => shot(`2026-01-${String(i + 1).padStart(2, '0')}`, f)));
  assert.equal(bookLine(all), '18종을 모두 모았어요');
});

test('first snow: once per winter season, beats light and golden hour', async () => {
  const { chooseFilm, firstSnowDue, snowSeason } = await import('../src/lib/film.ts');
  assert.equal(snowSeason('2026-11-20'), 2026);
  assert.equal(snowSeason('2027-02-01'), 2026);
  assert.equal(snowSeason('2026-06-30'), 2025);
  const snow = { code: 73 };
  const lastWinter = [{ day: '2026-01-12', film: 'snow-pastel' as FilmId, weather: snow }];
  assert.equal(firstSnowDue('2026-11-20', lastWinter), true);
  assert.equal(firstSnowDue('2026-02-10', lastWinter), false);
  assert.equal(firstSnowDue('2026-12-01', [...lastWinter, { day: '2026-11-20', film: 'first-snow' as FilmId, weather: snow }]), false);
  const rise = new Date(2026, 10, 20, 7, 10);
  const set = new Date(2026, 10, 20, 17, 20);
  const pick = (h: number, firstSnow: boolean, special: string | null = null) => chooseFilm({ now: new Date(2026, 10, 20, h), sunrise: rise, sunset: set, weather: snow, firstSnow, special });
  assert.equal(pick(17, true).film, 'first-snow');
  assert.match(pick(17, true).reason, /첫눈/);
  assert.equal(pick(22, true).film, 'first-snow');
  assert.equal(pick(13, false).film, 'snow-pastel');
  assert.equal(pick(13, true, '생일').film, 'party-flash');
  assert.equal(chooseFilm({ now: new Date(2026, 10, 20, 13), weather: { code: 61 }, firstSnow: true }).film, 'rainy-mono');
});

test('seasonal films: blossom and foliage windows, dry daylight only, after rain and cloud', async () => {
  const { chooseFilm, seasonOf } = await import('../src/lib/film.ts');
  assert.equal(seasonOf(new Date(2027, 3, 3))?.film, 'spring-bloom');
  assert.equal(seasonOf(new Date(2027, 2, 27)), null);
  assert.equal(seasonOf(new Date(2027, 3, 12))?.film, 'spring-bloom');
  assert.equal(seasonOf(new Date(2027, 3, 13)), null);
  assert.equal(seasonOf(new Date(2026, 9, 28))?.film, 'autumn-maple');
  assert.equal(seasonOf(new Date(2026, 10, 12))?.film, 'autumn-maple');
  assert.equal(seasonOf(new Date(2026, 10, 13)), null);
  const day = (mo: number, d: number, h: number) => new Date(2026, mo, d, h);
  const sun = (mo: number, d: number) => ({ sunrise: day(mo, d, 6), sunset: day(mo, d, 18) });
  const at = (mo: number, d: number, h: number, weather: object) => chooseFilm({ now: day(mo, d, h), ...sun(mo, d), weather }).film;
  assert.equal(at(10, 2, 13, { code: 0, tempC: 14 }), 'autumn-maple');
  assert.match(chooseFilm({ now: day(10, 2, 13), ...sun(10, 2), weather: { code: 0 } }).reason, /단풍 드는 한낮/);
  // light, weather and occasions still win
  assert.equal(at(10, 2, 13, { code: 61 }), 'rainy-mono');
  assert.equal(at(10, 2, 13, { code: 3, cloud: 90 }), 'grey-portra');
  assert.equal(at(10, 2, 13, { code: 0, windMs: 12 }), 'motion-lofi');
  assert.equal(chooseFilm({ now: new Date(2026, 10, 2, 17, 30), ...sun(10, 2), weather: { code: 0 } }).film, 'golden-roll');
  assert.equal(at(10, 2, 21, { code: 0 }), 'night-tungsten');
  assert.equal(chooseFilm({ now: day(3, 3, 12), ...sun(3, 3), weather: { code: 0 }, special: '생일' }).film, 'party-flash');
  assert.equal(chooseFilm({ now: day(3, 3, 12), ...sun(3, 3), weather: { code: 1 } }).film, 'spring-bloom');
  // offline, no sun times: only in daylight hours
  assert.equal(chooseFilm({ now: day(10, 2, 13) }).film, 'autumn-maple');
  assert.equal(chooseFilm({ now: day(10, 2, 22) }).film, 'daily-negative');
});

test('seasonal film book cards count down to the window', async () => {
  const { seasonWait } = await import('../src/lib/film.ts');
  assert.deepEqual(seasonWait('autumn-maple', '2026-10-25'), { open: false, days: 3, from: '10-28' });
  assert.deepEqual(seasonWait('autumn-maple', '2026-11-01'), { open: true, until: '11-12' });
  // past this year's window: next year's
  assert.deepEqual(seasonWait('autumn-maple', '2026-11-13'), { open: false, days: 349, from: '10-28' });
  assert.deepEqual(seasonWait('spring-bloom', '2026-12-31'), { open: false, days: 87, from: '03-28' });
  assert.equal(seasonWait('rainy-mono', '2026-10-25'), null);
});

test('seasonal films follow the hemisphere; none in the tropics', async () => {
  const { chooseFilm, seasonOf, seasonWait } = await import('../src/lib/film.ts');
  const sydney = -33.9;
  const singapore = 1.3;
  assert.equal(seasonOf(new Date(2026, 9, 30), sydney), null);
  assert.equal(seasonOf(new Date(2026, 9, 1), sydney)?.film, 'spring-bloom');
  assert.equal(seasonOf(new Date(2027, 3, 25), sydney)?.film, 'autumn-maple');
  assert.equal(seasonOf(new Date(2026, 9, 30), singapore), null);
  assert.equal(seasonOf(new Date(2026, 9, 30), 37.5)?.film, 'autumn-maple');
  assert.equal(chooseFilm({ now: new Date(2026, 10, 2, 13), weather: { code: 0, tempC: 30 }, lat: singapore }).film, 'summer-kodak');
  assert.deepEqual(seasonWait('autumn-maple', '2026-10-25', sydney), { open: false, days: 177, from: '04-20' });
  assert.equal(seasonWait('autumn-maple', '2026-10-25', singapore), null);
});

test('a southern winter is one snow season', async () => {
  const { firstSnowDue, snowSeason } = await import('../src/lib/film.ts');
  assert.equal(snowSeason('2026-06-20', -40), snowSeason('2026-07-20', -40));
  assert.notEqual(snowSeason('2026-06-20'), snowSeason('2026-07-20'));
  const june = [{ day: '2026-06-20', film: 'first-snow' as const, weather: { code: 73 } }];
  assert.equal(firstSnowDue('2026-07-20', june, -40), false);
  assert.equal(firstSnowDue('2026-07-20', june), true);
});

test('films first loaded in a month', async () => {
  const { newIn } = await import('../src/lib/filmbook.ts');
  const shots = [
    { day: '2026-09-03', film: 'rainy-mono' as FilmId },
    { day: '2026-10-02', film: 'rainy-mono' as FilmId },
    { day: '2026-10-05', film: 'storm-push' as FilmId },
    { day: '2026-10-29', film: 'autumn-maple' as FilmId },
  ];
  assert.deepEqual(newIn('2026-10', shots), ['storm-push', 'autumn-maple']);
  assert.deepEqual(newIn('2026-11', shots), []);
});
