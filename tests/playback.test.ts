/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPEEDS, counter, nextFrame, nextSpeed, reelSeconds, speedName } from '../src/lib/playback.ts';

test('the reel runs to the last frame and stops there', () => {
  assert.equal(nextFrame(0, 3), 1);
  assert.equal(nextFrame(1, 3), 2);
  assert.equal(nextFrame(2, 3), null);
  assert.equal(nextFrame(0, 1), null);
});

test('speeds cycle slow to fast, names line up', () => {
  assert.equal(speedName(SPEEDS.length - 1), '빠르게');
  assert.ok(SPEEDS[0] > SPEEDS[1] && SPEEDS[1] > SPEEDS[2]);
  assert.equal(nextSpeed(0), 1);
  assert.equal(nextSpeed(SPEEDS.length - 1), 0);
});

test('counter and reel length', () => {
  assert.equal(counter(6, 24), '07 / 24');
  assert.equal(counter(0, 3), '01 / 03');
  assert.equal(reelSeconds(30, 1), Math.round((30 * SPEEDS[1]) / 1000));
});
