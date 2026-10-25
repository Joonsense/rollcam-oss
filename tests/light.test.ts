/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lightNote } from '../src/lib/light.ts';

const at = (h: number, m = 0) => new Date(2026, 9, 25, h, m);
const rise = at(6, 50);
const set = at(17, 40);

test('light note: inside the window, the hour before, else nothing', () => {
  assert.equal(lightNote(at(17, 30), rise, set), '해 질 녘 빛 · 50분 남음');
  assert.equal(lightNote(at(18, 19), rise, set), '해 질 녘 빛 · 1분 남음');
  assert.equal(lightNote(at(16, 42), rise, set), '해 질 녘 빛까지 18분');
  assert.equal(lightNote(at(15, 0), rise, set), '');
  assert.equal(lightNote(at(18, 30), rise, set), '');
  assert.equal(lightNote(at(6, 20), rise, set), '해 뜰 녘 빛 · 70분 남음');
  assert.equal(lightNote(at(12), null, null), '');
});

test('no light note when something outranks Golden Roll', () => {
  assert.equal(lightNote(at(17, 30), rise, set, () => false), '');
  assert.equal(lightNote(at(17, 30), rise, set, (t) => t === rise), '');
});

test('moon note on full-moon nights only', async () => {
  const { moonNote } = await import('../src/lib/light.ts');
  const { daysFromFull } = await import('../src/lib/moon.ts');
  // find a full-moon night in late 2026 by scanning
  let full = new Date(2026, 9, 1, 22);
  while (daysFromFull(full) > 0.5) full = new Date(full.getTime() + 86400000);
  const rise = new Date(full.getFullYear(), full.getMonth(), full.getDate(), 6, 50);
  const set = new Date(full.getFullYear(), full.getMonth(), full.getDate(), 17, 40);
  assert.equal(moonNote(full, rise, set), '보름달 뜬 밤');
  const noon = new Date(full.getFullYear(), full.getMonth(), full.getDate(), 12);
  assert.equal(moonNote(noon, rise, set), '');
  const later = new Date(full.getTime() + 7 * 86400000);
  assert.equal(moonNote(later, new Date(later.getFullYear(), later.getMonth(), later.getDate(), 6), new Date(later.getFullYear(), later.getMonth(), later.getDate(), 18)), '');
});
