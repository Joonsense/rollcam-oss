/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { THUMB_EDGE, thumbName, thumbSize } from '../src/lib/thumbSize.ts';

test('small copies keep the aspect, cap the long edge and never upscale', () => {
  assert.deepEqual(thumbSize(1200, 1600), { w: 270, h: THUMB_EDGE });
  assert.deepEqual(thumbSize(1600, 900), { w: THUMB_EDGE, h: 203 });
  assert.deepEqual(thumbSize(200, 100), { w: 200, h: 100 });
  // a very tall selfie (9:20) still gets at least a pixel across
  assert.deepEqual(thumbSize(1, 5000), { w: 1, h: THUMB_EDGE });
  assert.deepEqual(thumbSize(0, 0), { w: 1, h: 1 });
});

test('thumb names carry the edge so a new size makes new files', () => {
  assert.equal(thumbName('2026-10-25-1.jpg'), `t${THUMB_EDGE}-2026-10-25-1.jpg`);
});
