/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync, zipSync, inflateSync } from 'fflate';
import { TAIL, ZipWriter, crc32, dataStart, findDirectory, readDirectory } from '../src/lib/zipStream.ts';

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** Reads one entry the way exportData does: header, then the data slice. */
function readEntry(zip: Uint8Array, name: string): Uint8Array {
  const d = findDirectory(zip.subarray(Math.max(0, zip.length - TAIL)))!;
  const e = readDirectory(zip.subarray(d.offset, d.offset + d.size)).find((x) => x.name === name)!;
  const start = dataStart(e, zip.subarray(e.offset, e.offset + 30));
  const raw = zip.subarray(start, start + e.compressed);
  return e.method === 8 ? inflateSync(raw) : raw;
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('our zip opens with fflate, entry by entry', () => {
  const parts: Uint8Array[] = [];
  const w = new ZipWriter((b) => parts.push(b));
  const jpeg = new Uint8Array(5000).map((_, i) => (i * 31) & 0xff);
  w.add('photos/2026-10-25-1.jpg', jpeg, new Date(2026, 9, 25, 18, 3, 7));
  w.add('rollcam.json', new TextEncoder().encode('{"shots":[]}'));
  const size = w.finish();
  const zip = concat(parts);
  assert.equal(size, zip.length);
  const files = unzipSync(zip);
  assert.deepEqual(files['photos/2026-10-25-1.jpg'], jpeg);
  assert.equal(new TextDecoder().decode(files['rollcam.json']), '{"shots":[]}');
  assert.deepEqual(readEntry(zip, 'photos/2026-10-25-1.jpg'), jpeg);
});

test('reads the zips older versions made (fflate, stored or deflated)', () => {
  const a = new TextEncoder().encode('hello '.repeat(200));
  for (const level of [0, 6] as const) {
    const zip = zipSync({ 'rollcam.json': a, 'photos/x.jpg': new Uint8Array([0xff, 0xd8, 1, 2]) }, { level });
    assert.deepEqual(readEntry(zip, 'rollcam.json'), a);
    assert.deepEqual(readEntry(zip, 'photos/x.jpg'), new Uint8Array([0xff, 0xd8, 1, 2]));
  }
});

test('not a zip', () => {
  assert.equal(findDirectory(new Uint8Array(100)), null);
});
