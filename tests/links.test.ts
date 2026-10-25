/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkTarget } from '../src/lib/links.ts';

test('launcher shortcut links', () => {
  assert.equal(linkTarget('rollcam://camera'), 'camera');
  assert.equal(linkTarget('rollcam://roll/'), 'roll');
  assert.equal(linkTarget('rollcam://book?from=shortcut'), 'book');
  assert.equal(linkTarget('rollcam://settings'), null);
  assert.equal(linkTarget('https://example.com/book'), null);
  assert.equal(linkTarget(null), null);
  // the dev client's own exp+ links are not ours
  assert.equal(linkTarget('exp+rollcam://expo-development-client'), null);
});
