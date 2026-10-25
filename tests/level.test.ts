/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { levelState, smooth, tiltDeg } from '../src/lib/level.ts';

const near = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 0.01, `${a} != ${b}`);
const rad = Math.PI / 180;

test('tilt: upright is 0, turning clockwise is positive, on both platforms', () => {
  near(tiltDeg(0, 1, 0, 'android'), 0);
  near(tiltDeg(0, -1, 0, 'ios'), 0);
  // turned 10° clockwise: the up vector leans to the phone's left (-x)
  near(tiltDeg(-Math.sin(10 * rad), Math.cos(10 * rad), 0.1, 'android'), 10);
  near(tiltDeg(Math.sin(10 * rad), -Math.cos(10 * rad), 0.1, 'ios'), 10);
  near(tiltDeg(Math.sin(5 * rad), Math.cos(5 * rad), 0, 'android'), -5);
  // lying flat or pointing up: no horizon
  assert.equal(tiltDeg(0, 0.3, 0.95, 'android'), null);
});

test('smoothing eases in, jumps on a big change, resets on null', () => {
  assert.equal(smooth(null, 4), 4);
  assert.equal(smooth(0, 4), 1);
  assert.equal(smooth(0, 30), 30);
  assert.equal(smooth(3, null), null);
});

test('level state: within 1° level, past 30° hidden', () => {
  assert.equal(levelState(0.6), 'level');
  assert.equal(levelState(-1), 'level');
  assert.equal(levelState(4), 'tilted');
  assert.equal(levelState(-31), 'off');
  assert.equal(levelState(null), 'off');
});
