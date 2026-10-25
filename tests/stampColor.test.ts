/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAMP_COLORS, STAMP_ORDER, readStamp } from '../src/lib/stampColor.ts';

test('stamp colour reads back, orange by default', () => {
  assert.equal(readStamp(''), 'orange');
  assert.equal(readStamp('red'), 'red');
  assert.equal(readStamp('yellow'), 'yellow');
  assert.equal(readStamp('purple'), 'orange');
  for (const c of STAMP_ORDER) assert.match(STAMP_COLORS[c].ink, /^#[0-9A-F]{6}$/i);
  // orange keeps the colour every photo so far was stamped with
  assert.equal(STAMP_COLORS.orange.ink, '#FF9A3C');
});
