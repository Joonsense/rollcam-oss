/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAPER_MIN_W, flashLabel, flashMode, nextFlash, nextTimer, printSize, readFacing, readFlash, readTimer, timerLabel } from '../src/lib/camera.ts';
import { setLang } from '../src/lib/i18n.ts';

test('camera settings: defaults, flash cycle per lens, front uses screen flash', () => {
  assert.equal(readFacing(''), 'back');
  assert.equal(readFacing('front'), 'front');
  assert.equal(readFlash(''), 'off');
  assert.equal(readFlash('on'), 'on');
  assert.equal(readFlash('torch'), 'off');
  assert.deepEqual([nextFlash('off', 'back'), nextFlash('auto', 'back'), nextFlash('on', 'back')], ['auto', 'on', 'off']);
  assert.deepEqual([nextFlash('off', 'front'), nextFlash('on', 'front'), nextFlash('auto', 'front')], ['on', 'off', 'off']);
  assert.equal(flashMode('on', 'back'), 'on');
  assert.equal(flashMode('auto', 'back'), 'auto');
  assert.equal(flashMode('on', 'front'), 'screen');
  assert.equal(flashMode('off', 'front'), 'off');
  // auto carried over from the back lens: shown and used as off
  assert.equal(flashMode('auto', 'front'), 'off');
  assert.equal(flashLabel('auto', 'front'), '끔');
  assert.equal(flashLabel('auto', 'back'), '자동');
});

test('print size: fills the stage at the photo ratio, never narrower than the margin needs', () => {
  const stage = { w: 340, h: 420 };
  // 3:4 back-lens photo: limited by height, paper hugs the photo
  const p = printSize(stage, 0.75);
  assert.deepEqual(p, { width: 302, height: 420, photo: 282 });
  // 9:20 front-lens photo: photo stays at its ratio, paper keeps the minimum width
  const q = printSize(stage, 0.45);
  assert.equal(q.width, PAPER_MIN_W);
  assert.equal(q.photo, 169);
  assert.equal(q.height, 420);
  // landscape: limited by width
  assert.deepEqual(printSize(stage, 1.5), { width: 340, height: 257, photo: 320 });
  assert.deepEqual(printSize(null, 1), { width: 0, height: 0, photo: 0 });
});

test('pinch zoom is logarithmic and clamped', async () => {
  const { pinchZoom, touchDistance } = await import('../src/lib/camera.ts');
  assert.equal(pinchZoom(0, 100, 100), 0);
  assert.ok(Math.abs(pinchZoom(0, 100, 200) - 0.35) < 1e-9);
  assert.ok(Math.abs(pinchZoom(0.35, 100, 200) - 0.7) < 1e-9);
  assert.equal(pinchZoom(0.2, 100, 50), 0);
  assert.equal(pinchZoom(0.9, 100, 400), 1);
  assert.equal(pinchZoom(0.4, 0, 100), 0.4);
  assert.equal(touchDistance([{ pageX: 0, pageY: 0 }]), null);
  assert.equal(touchDistance([{ pageX: 0, pageY: 0 }, { pageX: 3, pageY: 4 }]), 5);
});

test('locked screen on short phones keeps the print big', async () => {
  const { lockedLayout } = await import('../src/lib/camera.ts');
  assert.deepEqual(lockedLayout(915), { shutter: true, echo: true });
  assert.deepEqual(lockedLayout(720), { shutter: false, echo: true });
  assert.deepEqual(lockedLayout(640), { shutter: false, echo: false });
});

test('self-timer: off by default, off -> 3 s -> 10 s -> off, labels', () => {
  assert.equal(readTimer(''), 0);
  assert.equal(readTimer('3'), 3);
  assert.equal(readTimer('10'), 10);
  assert.equal(readTimer('5'), 0);
  assert.deepEqual([nextTimer(0), nextTimer(3), nextTimer(10)], [3, 10, 0]);
  assert.equal(timerLabel(0), '끔');
  assert.equal(timerLabel(10), '10초');
  setLang('en');
  assert.equal(timerLabel(3), '3s');
  setLang('ko');
});
