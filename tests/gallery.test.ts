/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { galleryName, galleryNote, galleryPending } from '../src/lib/gallery.ts';

test('gallery file name sorts by date and names the film', () => {
  assert.equal(galleryName({ day: '2026-10-25', film: 'rainy-mono' }), 'ROLLCAM_2026-10-25_RainyMono.jpg');
  assert.equal(galleryName({ day: '2026-01-02', film: 'motion-lofi' }), 'ROLLCAM_2026-01-02_MotionLoFi.jpg');
});

test('only days not in the album yet, oldest first', () => {
  const shots = [
    { day: '2026-10-03', takenAt: 30 },
    { day: '2026-10-01', takenAt: 10 },
    { day: '2026-10-02', takenAt: 20 },
  ];
  assert.deepEqual(galleryPending(shots, new Set()).map((s) => s.takenAt), [10, 20, 30]);
  // a restored older day is still copied though a newer one is in
  assert.deepEqual(galleryPending(shots, new Set(['2026-10-03'])).map((s) => s.day), ['2026-10-01', '2026-10-02']);
  assert.deepEqual(galleryPending(shots, new Set(['2026-10-01', '2026-10-02', '2026-10-03'])), []);
});

test('settings note', () => {
  assert.match(galleryNote(false, null, 0), /ROLLCAM 앨범에도 남겨요/);
  assert.match(galleryNote(true, null, 0), /갤러리 백업/);
  assert.equal(galleryNote(true, { done: 3, total: 40 }, 0), '지금까지 찍은 사진 넣는 중 · 3/40');
  assert.match(galleryNote(true, { done: 40, total: 40 }, 0), /갤러리 백업/);
  assert.equal(galleryNote(true, null, 2), '갤러리에 넣지 못한 사진 2장 · 다시 켜면 그 사진만 다시 넣어요');
  // switched off: no progress or failure left showing
  assert.match(galleryNote(false, { done: 5, total: 40 }, 2), /ROLLCAM 앨범에도 남겨요/);
});
