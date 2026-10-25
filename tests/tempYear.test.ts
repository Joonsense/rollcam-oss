/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tempYear } from '../src/lib/tempYear.ts';

const s = (day: string, tempC?: number) => ({ day, film: 'daily-negative', weather: tempC === undefined ? null : { tempC } });

test('year temperature line: scaled points, warmest and coldest', () => {
  const t = tempYear(2026, [s('2026-01-12', -9), s('2026-07-31', 34), s('2026-10-25', 12), s('2026-10-26'), s('2025-12-31', 50)], 300, 60)!;
  assert.equal(t.points.length, 3);
  assert.equal(t.hot.day, '2026-07-31');
  assert.equal(t.cold.day, '2026-01-12');
  assert.equal(t.hot.y, 6);
  assert.equal(t.cold.y, 54);
  assert.ok(t.points[0].x < t.points[1].x && t.points[1].x < t.points[2].x);
  assert.ok(t.points.every((p) => p.x >= 6 && p.x <= 294));
  assert.equal(tempYear(2026, [s('2026-01-01', 1), s('2026-01-02', 2)], 300, 60), null);
});

test('a busy year draws the 7-day average, a quiet one the points themselves', async () => {
  const { SMOOTH_FROM } = await import('../src/lib/tempYear.ts');
  const quiet = tempYear(2026, [s('2026-01-12', -9), s('2026-07-31', 34), s('2026-10-25', 12)], 300, 60)!;
  assert.deepEqual(quiet.line, quiet.points.map((p) => ({ x: p.x, y: p.y })));
  // alternating 0 / 20 every day: the average sits near 10 while the points zigzag
  const days = Array.from({ length: SMOOTH_FROM + 15 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    return s(d.toISOString().slice(0, 10), i % 2 ? 20 : 0);
  });
  const busy = tempYear(2026, days, 300, 60)!;
  const mid = busy.line.slice(5, -5).map((p) => p.y);
  assert.ok(Math.max(...mid) - Math.min(...mid) < 10, 'the averaged line is calm');
  assert.ok(busy.points.some((p) => p.y === 6) && busy.points.some((p) => p.y === 54), 'the dots keep each day');
});
