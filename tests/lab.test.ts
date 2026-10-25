/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atLab, labDay, labLine, revealAt, waitKey } from '../src/lib/lab.ts';
import { setLang } from '../src/lib/i18n.ts';

test('a print comes back the next morning at 7, across months and years', () => {
  assert.equal(revealAt('2026-10-25').getTime(), new Date(2026, 9, 26, 7).getTime());
  assert.equal(revealAt('2026-10-31').getTime(), new Date(2026, 10, 1, 7).getTime());
  assert.equal(revealAt('2026-12-31').getTime(), new Date(2027, 0, 1, 7).getTime());
  assert.equal(waitKey('2026-10-25'), 'wait:2026-10-25');
});

test('only prints shot with the setting on wait, and only until 7 am', () => {
  assert.equal(atLab('2026-10-25', new Date(2026, 9, 25, 21), true), true);
  assert.equal(atLab('2026-10-25', new Date(2026, 9, 26, 6, 59), true), true);
  assert.equal(atLab('2026-10-25', new Date(2026, 9, 26, 7), true), false);
  assert.equal(atLab('2026-10-25', new Date(2026, 9, 25, 21), false), false);
  assert.deepEqual(['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30'].map((d) => labDay(d, new Date(2026, 10, 1, 3))), [true, true, true, false]);
  // shot on the 26th in Seoul, opened in Hawaii while it is still the 25th there: still at the lab
  assert.equal(atLab('2026-10-26', new Date(2026, 9, 25, 15), true), true);
});

test('lab line says tomorrow before midnight and counts down', () => {
  assert.equal(labLine('2026-10-25', new Date(2026, 9, 25, 21, 48)), '내일 아침 7시 현상 · 9시간 12분 남음');
  assert.equal(labLine('2026-10-25', new Date(2026, 9, 26, 6, 30)), '아침 7시 현상 · 30분 남음');
  setLang('en');
  assert.equal(labLine('2026-10-25', new Date(2026, 9, 25, 21, 48)), 'Back from the lab at 7 am tomorrow · 9 h 12 min');
  setLang('ko');
});
