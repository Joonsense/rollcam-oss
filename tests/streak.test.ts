/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentStreak, milestoneLine } from '../src/lib/streak.ts';

test('current streak counts back from today across months', () => {
  const days = new Set(['2026-10-01', '2026-09-30', '2026-09-29', '2026-09-27']);
  assert.equal(currentStreak('2026-10-01', (d) => days.has(d)), 3);
  assert.equal(currentStreak('2026-10-02', (d) => days.has(d)), 0);
  assert.equal(currentStreak('2026-09-27', (d) => days.has(d)), 1);
  assert.equal(currentStreak('2026-10-01', () => true, 40), 40);
});

test('milestone marks only on the exact day', () => {
  assert.equal(milestoneLine(6), null);
  assert.match(milestoneLine(7)!, /일주일/);
  assert.match(milestoneLine(30)!, /한 달/);
  assert.equal(milestoneLine(100), '연속 100일째');
  assert.equal(milestoneLine(31), null);
  assert.match(milestoneLine(365)!, /1년/);
});
