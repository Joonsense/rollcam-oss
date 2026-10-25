/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PALETTE, encodeGif, toIndices } from '../src/lib/gif.ts';

// a straightforward GIF decoder, enough to read back what encodeGif writes
function decode(gif: Uint8Array) {
  let p = 0;
  const u8 = () => gif[p++];
  const u16 = () => gif[p++] | (gif[p++] << 8);
  const head = String.fromCharCode(...gif.slice(0, 6));
  p = 6;
  const w = u16();
  const h = u16();
  const flags = u8();
  p += 2;
  if (flags & 0x80) p += 3 * (1 << ((flags & 7) + 1));
  const frames: Uint8Array[] = [];
  const delays: number[] = [];
  let loop = false;
  for (;;) {
    const b = u8();
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = u8();
      if (label === 0xf9) {
        p += 2;
        delays.push(u16());
        p += 2;
      } else {
        const n = u8();
        if (String.fromCharCode(...gif.slice(p, p + n)) === 'NETSCAPE2.0') loop = true;
        p += n;
        for (let s = u8(); s; s = u8()) p += s;
      }
      continue;
    }
    assert.equal(b, 0x2c);
    p += 8;
    p += 1;
    const min = u8();
    const data: number[] = [];
    for (let s = u8(); s; s = u8()) for (let i = 0; i < s; i++) data.push(u8());
    // LZW
    const clear = 1 << min;
    const end = clear + 1;
    let size = min + 1;
    let dict: number[][] = [];
    const reset = () => {
      dict = [];
      for (let i = 0; i < clear; i++) dict[i] = [i];
      dict[clear] = [];
      dict[end] = [];
      size = min + 1;
    };
    reset();
    const out: number[] = [];
    let bitPos = 0;
    let prev: number[] | null = null;
    for (;;) {
      let code = 0;
      for (let i = 0; i < size; i++) {
        const bit = (data[(bitPos + i) >> 3] >> ((bitPos + i) & 7)) & 1;
        code |= bit << i;
      }
      bitPos += size;
      if (code === clear) {
        reset();
        prev = null;
        continue;
      }
      if (code === end) break;
      let entry: number[];
      if (code < dict.length) entry = dict[code];
      else entry = [...prev!, prev![0]];
      out.push(...entry);
      if (prev) {
        dict.push([...prev, entry[0]]);
        if (dict.length === 1 << size && size < 12) size++;
      }
      prev = entry;
    }
    frames.push(Uint8Array.from(out));
  }
  return { head, w, h, frames, delays, loop };
}

test('encodeGif round-trips through a GIF decoder, long runs and the 4096-code reset included', () => {
  const w = 120;
  const h = 90;
  const noise = new Uint8Array(w * h).map((_, i) => (i * 7919 + (i >> 3) * 31) % 256);
  const flat = new Uint8Array(w * h).fill(17);
  const ramp = new Uint8Array(w * h).map((_, i) => i % 256);
  const gif = encodeGif([noise, flat, ramp], w, h, [45, 90]);
  const d = decode(gif);
  assert.equal(d.head, 'GIF89a');
  assert.equal(d.w, w);
  assert.equal(d.h, h);
  assert.ok(d.loop);
  assert.deepEqual(d.delays, [45, 90, 45]);
  assert.deepEqual(d.frames[0], noise);
  assert.deepEqual(d.frames[1], flat);
  assert.deepEqual(d.frames[2], ramp);
});

test('dithered indices land on near colours', () => {
  const rgba = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 128, 128, 128, 255]);
  const idx = toIndices(rgba, 4, 1);
  const rgb = (i: number) => [PALETTE[idx[i] * 3], PALETTE[idx[i] * 3 + 1], PALETTE[idx[i] * 3 + 2]];
  assert.deepEqual(rgb(0), [255, 0, 0]);
  assert.deepEqual(rgb(1), [0, 0, 0]);
  assert.deepEqual(rgb(2), [255, 255, 255]);
  for (const c of rgb(3)) assert.ok(Math.abs(c - 128) <= 52);
  assert.ok(Math.max(...idx) < 256);
});
