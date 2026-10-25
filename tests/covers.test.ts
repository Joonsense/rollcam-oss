/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withCovers } from '../src/lib/covers.ts';
import { yearSummary } from '../src/lib/stats.ts';

test('a picked cover replaces the latest print, only if it is still in that month', () => {
  const shots = [
    { day: '2026-10-03', film: 'rainy-mono' as const, weather: null },
    { day: '2026-10-20', film: 'golden-roll' as const, weather: null },
    { day: '2026-09-02', film: 'daily-negative' as const, weather: null },
  ];
  const y = yearSummary(2026, shots, '2026-10-25');
  assert.equal(y.months[9].cover?.day, '2026-10-20');
  const picks: Record<string, string> = { 'cover:2026-10': '2026-10-03', 'cover:2026-09': '2026-10-03' };
  const c = withCovers(y, shots, (m) => picks[`cover:${m}`] ?? '');
  assert.equal(c.months[9].cover?.day, '2026-10-03');
  // a pick outside its month is ignored
  assert.equal(c.months[8].cover?.day, '2026-09-02');
  // a pick whose photo is gone is ignored
  assert.equal(withCovers(y, shots, () => '2026-10-05').months[9].cover?.day, '2026-10-20');
});
