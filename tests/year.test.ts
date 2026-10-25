/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILM_NAMES, type FilmId } from '../src/lib/film.ts';
import { yearRecap, yearSummary } from '../src/lib/stats.ts';

const shot = (day: string, film: FilmId, code?: number) => ({ day, film, weather: code === undefined ? null : { code } });

test('year recap: run, films out of all, top film with count, top sky', () => {
  const shots = [
    shot('2026-01-02', 'snow-pastel', 73),
    shot('2026-10-01', 'grey-portra', 3),
    shot('2026-10-02', 'grey-portra', 3),
    shot('2026-10-03', 'rainy-mono', 61),
    shot('2025-12-31', 'party-flash', 0), // last year, left out
  ];
  const y = yearSummary(2026, shots, '2026-10-23');
  const facts = yearRecap(y, shots);
  assert.deepEqual(facts, [
    { label: '가장 길게 이어 찍은 날', value: '3일' },
    { label: '모은 필름', value: `3 / ${Object.keys(FILM_NAMES).length}종` },
    { label: '가장 많이 온 필름', value: 'Grey Portra · 2장' },
    { label: '제일 많았던 하늘', value: '흐림 · 2장' },
  ]);
});

test('year recap: one photo says little', () => {
  const shots = [shot('2026-03-01', 'daily-negative')];
  assert.deepEqual(yearRecap(yearSummary(2026, shots, '2026-10-23'), shots), [{ label: '모은 필름', value: `1 / ${Object.keys(FILM_NAMES).length}종` }]);
});

test('year-end card: from Dec 15, into early January, once, with a few photos', async () => {
  const { recapYear } = await import('../src/lib/recap.ts');
  const none = () => false;
  const many = () => 20;
  assert.equal(recapYear(new Date(2026, 11, 14), none, many), null);
  assert.equal(recapYear(new Date(2026, 11, 15), none, many), 2026);
  assert.equal(recapYear(new Date(2027, 0, 14), none, many), 2026);
  assert.equal(recapYear(new Date(2027, 0, 15), none, many), null);
  assert.equal(recapYear(new Date(2026, 11, 20), (y) => y === 2026, many), null, 'seen already');
  assert.equal(recapYear(new Date(2026, 11, 20), none, () => 2), null, 'too few photos');
});
