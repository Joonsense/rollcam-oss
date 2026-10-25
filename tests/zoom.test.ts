/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_ZOOM, clampPan, pinchScale } from '../src/lib/zoom.ts';

test('pinch scale follows the fingers between 1x and the max', () => {
  assert.equal(pinchScale(1, 100, 200), 2);
  assert.equal(pinchScale(2, 100, 50), 1);
  assert.equal(pinchScale(1, 100, 50), 1);
  assert.equal(pinchScale(3, 100, 200), MAX_ZOOM);
  assert.equal(pinchScale(2, 0, 100), 2);
});

test('pan stays inside the zoomed print', () => {
  assert.deepEqual(clampPan(1, 50, 50, 300, 400), { x: 0, y: 0 });
  assert.deepEqual(clampPan(2, 500, -500, 300, 400), { x: 150, y: -200 });
  assert.deepEqual(clampPan(2, 20, 30, 300, 400), { x: 20, y: 30 });
});
