/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILM_NAMES } from '../src/lib/film.ts';
import { FILM_STORY, filmFacts, shareOfRoll } from '../src/lib/filmStory.ts';

test('every film has a story', () => {
  for (const f of Object.keys(FILM_NAMES)) assert.ok(FILM_STORY[f as keyof typeof FILM_STORY], f);
});

test('film facts: count, first and last, usual part of day', () => {
  const at = (d: string, h: number) => ({ day: d, takenAt: new Date(`${d}T${String(h).padStart(2, '0')}:30:00`).getTime() });
  const f = filmFacts([at('2026-10-05', 8), at('2026-09-01', 15), at('2026-10-20', 9)]);
  assert.equal(f.count, 3);
  assert.equal(f.first, '2026-09-01');
  assert.equal(f.last, '2026-10-20');
  assert.equal(f.pod, '아침');
  assert.deepEqual(filmFacts([]), { count: 0, first: null, last: null, pod: null });
});

test('share of the roll', () => {
  assert.equal(shareOfRoll(3, 25), '전체의 12%');
  assert.equal(shareOfRoll(1, 300), '전체의 1% 미만');
  assert.equal(shareOfRoll(0, 10), '');
});

test('film mix: most loaded first, ties in book order', async () => {
  const { filmMix } = await import('../src/lib/filmStory.ts');
  const { BOOK_ORDER } = await import('../src/lib/filmbook.ts');
  const shots = [{ film: 'rainy-mono' }, { film: 'daily-negative' }, { film: 'rainy-mono' }, { film: 'golden-roll' }] as { film: 'rainy-mono' | 'daily-negative' | 'golden-roll' }[];
  assert.deepEqual(filmMix(shots, BOOK_ORDER), [
    { film: 'rainy-mono', n: 2 },
    { film: 'daily-negative', n: 1 },
    { film: 'golden-roll', n: 1 },
  ]);
  assert.deepEqual(filmMix([], BOOK_ORDER), []);
});
