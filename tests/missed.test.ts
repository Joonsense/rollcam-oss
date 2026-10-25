/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missedFilm } from '../src/lib/missed.ts';

test('a missed day shows the film its sky would have loaded at midday', () => {
  assert.equal(missedFilm('2026-10-14', 63, 15), 'rainy-mono');
  assert.equal(missedFilm('2026-10-14', 3, 15), 'grey-portra');
  assert.equal(missedFilm('2026-07-20', 0, 32), 'summer-kodak');
  assert.equal(missedFilm('2026-10-14', 0, 18), 'daily-negative');
  assert.equal(missedFilm('2026-11-02', 0, 14), 'autumn-maple');
  assert.equal(missedFilm('2026-12-25', 0, 3), 'party-flash');
  assert.equal(missedFilm('2026-10-14', null, 15), null);
});
