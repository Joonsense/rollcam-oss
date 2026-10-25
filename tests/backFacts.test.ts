/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backFacts } from '../src/lib/backFacts.ts';
import { BOOK_ORDER } from '../src/lib/filmbook.ts';

test('a past print is stamped as of its own day', () => {
  const all = [
    { day: '2026-09-29', film: 'rainy-mono' },
    { day: '2026-09-30', film: 'daily-negative' },
    { day: '2026-10-01', film: 'rainy-mono' },
    { day: '2026-10-02', film: 'golden-roll' },
    { day: '2026-10-05', film: 'storm-push' },
  ];
  const f = backFacts(all[3], all);
  assert.equal(f.frame, 2);
  assert.deepEqual(f.book, { found: 3, total: BOOK_ORDER.length });
  assert.equal(f.run, 4);
  assert.equal(backFacts(all[4], all).run, 1);
});
