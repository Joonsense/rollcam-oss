/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WHATS_NEW_ID, whatsNew, whatsNewDue } from '../src/lib/whatsNew.ts';

test("what's new shows once, only to people with a roll", () => {
  assert.equal(whatsNewDue('', 12), true);
  assert.equal(whatsNewDue('0.3.0', 12), true);
  assert.equal(whatsNewDue(WHATS_NEW_ID, 12), false);
  assert.equal(whatsNewDue('', 0), false);
  assert.ok(whatsNew().length >= 3);
  for (const n of whatsNew()) assert.ok(n.title && n.body && n.icon);
});
