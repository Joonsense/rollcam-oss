/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REVIEW_GAP_DAYS, REVIEW_MIN_SHOTS, reviewDue } from '../src/lib/review.ts';

test('review card only after a few weeks of photos, then rarely', () => {
  const now = Date.UTC(2026, 10, 1);
  const day = 86400000;
  assert.equal(reviewDue(REVIEW_MIN_SHOTS - 1, null, now), false);
  assert.equal(reviewDue(REVIEW_MIN_SHOTS, null, now), true);
  assert.equal(reviewDue(60, now - (REVIEW_GAP_DAYS - 1) * day, now), false);
  assert.equal(reviewDue(60, now - REVIEW_GAP_DAYS * day, now), true);
});
