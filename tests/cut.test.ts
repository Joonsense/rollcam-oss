/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CUT_H, CUT_W, cutLayout, edgeLeft, edgeRight } from '../src/lib/cutLayout.ts';
import { addDays } from '../src/lib/day.ts';

const inside = (a: { x: number; w: number }, b: { x: number; w: number }) => a.x >= b.x && a.x + a.w <= b.x + b.w;

test('the frame keeps the photo aspect and sits inside the strip, clear of the holes', () => {
  for (const ratio of [0.75, 4 / 3, 9 / 20, 1, 16 / 9]) {
    const l = cutLayout(ratio);
    assert.ok(Math.abs(l.frame.w / l.frame.h - ratio) < 1e-9, `aspect ${ratio}`);
    assert.ok(inside(l.frame, l.strip));
    assert.ok(l.frame.y >= 0 && l.frame.y + l.frame.h <= CUT_H, `on canvas ${ratio}`);
    for (const h of l.holes) assert.ok(h.x + h.w <= l.frame.x || h.x >= l.frame.x + l.frame.w, 'hole overlaps frame');
    // neighbours line up above and below
    assert.equal(l.prev.x, l.frame.x);
    assert.ok(l.prev.y + l.prev.h < l.frame.y && l.next.y > l.frame.y + l.frame.h);
    // edge print sits between the holes and the frame
    assert.ok(l.edge[0] < l.frame.x && l.edge[1] > l.frame.x + l.frame.w);
  }
  assert.equal(cutLayout(0.75).strip.x, (CUT_W - cutLayout(0.75).strip.w) / 2);
});

test('holes run the whole height on both sides', () => {
  const l = cutLayout(0.75);
  const ys = l.holes.map((h) => h.y);
  assert.ok(Math.min(...ys) <= 0 && Math.max(...ys) >= CUT_H - 46);
  assert.equal(l.holes.length % 2, 0);
});

test('bad ratios fall back to 3:4', () => {
  assert.deepEqual(cutLayout(0).frame, cutLayout(0.75).frame);
  assert.deepEqual(cutLayout(Number.NaN).frame, cutLayout(0.75).frame);
});

test('edge print', () => {
  assert.equal(edgeLeft('2026-10-05'), 'ROLLCAM 400   2026.10.05   5A');
  assert.equal(edgeRight('Rainy Mono'), 'RAINY MONO   SAFETY FILM');
});

test('neighbour days cross months and years', () => {
  assert.equal(addDays('2026-10-01', -1), '2026-09-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('a lucky frame says so on the film edge', () => {
  assert.equal(edgeRight('Rainy Mono', true), 'RAINY MONO   LUCKY CUT');
});
