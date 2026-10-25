/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LUCKY_ODDS, LUCKY_SINCE, isLucky, luckyCount, luckyLook } from '../src/lib/lucky.ts';
import { LOOKS } from '../src/lib/looks.ts';

test('lucky frames: about one in LUCKY_ODDS, fixed by the shutter time', () => {
  const start = new Date(2026, 10, 1, 7).getTime();
  let n = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (isLucky(start + i * 61_237)) n++;
  const rate = n / N;
  assert.ok(Math.abs(rate - 1 / LUCKY_ODDS) < 0.01, String(rate));
  // the same moment always gives the same answer (export / restore keeps it)
  for (let i = 0; i < 100; i++) assert.equal(isLucky(start + i * 997), isLucky(start + i * 997));
  // a daily habit at one time of day still varies: a year of 08:00 shots isn't all or nothing
  const days = Array.from({ length: 365 }, (_, d) => ({ takenAt: new Date(2026, 10, 1 + d, 8, 0, 0, 0).getTime() }));
  const c = luckyCount(days);
  assert.ok(c > 3 && c < 35, String(c));
});

test('photos developed before lucky frames existed are never lucky', () => {
  let n = 0;
  for (let i = 0; i < 5000; i++) if (isLucky(LUCKY_SINCE - 1 - i * 60_000)) n++;
  assert.equal(n, 0);
});

test('a lucky look only changes the optics', () => {
  const base = LOOKS['grey-portra'];
  const l = luckyLook(base);
  assert.ok((l.leak ?? 0) >= 0.9);
  assert.ok((l.halation ?? 0) > (base.halation ?? 0));
  assert.equal(l.grain, base.grain);
  assert.equal(l.vignette, base.vignette);
});
