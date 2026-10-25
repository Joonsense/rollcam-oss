/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOOK_H, BOOK_W, bookSlots } from '../src/lib/bookLayout.ts';

test('film book slots fit the story card without overlap', () => {
  for (const n of [13, 15, 18]) {
    const s = bookSlots(n);
    assert.equal(s.length, n);
    for (const a of s) {
      assert.ok(a.x >= 0 && a.x + a.w <= BOOK_W && a.y >= 400 && a.y + a.h <= BOOK_H - 200, `inside ${n}`);
      assert.ok(a.cover > 0 && a.cover < a.h);
    }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = s[i];
        const b = s[j];
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `overlap ${i} ${j}`);
      }
  }
});
