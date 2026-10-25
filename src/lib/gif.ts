// A small animated GIF encoder for the roll's flipbook share (rollGif.ts):
// one fixed 256-colour palette for every frame with ordered dithering, and
// plain GIF LZW. No quantising per frame, so a month of frames encodes in a
// few seconds on a phone. Pure.

// 216 colours (6 levels a channel) plus a 40-step grey ramp: near-neutral
// pixels take the ramp, so whites, skies and the mono film don't pick up
// coloured dither noise
const L = 6;
const GREYS = 40;
const CUBE = L * L * L;

/** The palette as 256 RGB triples: the 6x6x6 cube, then the greys. */
export const PALETTE: Uint8Array = (() => {
  const p = new Uint8Array(256 * 3);
  let i = 0;
  for (let r = 0; r < L; r++)
    for (let g = 0; g < L; g++)
      for (let b = 0; b < L; b++) {
        p[i * 3] = r * 51;
        p[i * 3 + 1] = g * 51;
        p[i * 3 + 2] = b * 51;
        i++;
      }
  for (let k = 0; k < GREYS; k++) {
    const v = Math.round((k * 255) / (GREYS - 1));
    p[i * 3] = v;
    p[i * 3 + 1] = v;
    p[i * 3 + 2] = v;
    i++;
  }
  return p;
})();

// 4x4 Bayer thresholds, centred on 0 (-0.5..0.5)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

// per threshold and byte value: the dithered cube level and grey step
const levelTable = (n: number) => {
  const t = new Uint8Array(16 * 256);
  for (let k = 0; k < 16; k++)
    for (let v = 0; v < 256; v++) {
      const s = (v / 255) * (n - 1) + BAYER[k];
      t[k * 256 + v] = s < 0 ? 0 : s > n - 1 ? n - 1 : Math.round(s);
    }
  return t;
};
const CUBE_LV = levelTable(L);
const GREY_LV = levelTable(GREYS);
const NEUTRAL = 14; // max channel spread still read as grey

/** RGBA pixels -> palette indices, ordered-dithered so gradients don't band. */
export function toIndices(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = (y & 3) * 4;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const k = (row + (x & 3)) * 256;
      const r = rgba[p];
      const g = rgba[p + 1];
      const b = rgba[p + 2];
      const hi = r > g ? (r > b ? r : b) : g > b ? g : b;
      const lo = r < g ? (r < b ? r : b) : g < b ? g : b;
      out[y * w + x] = hi - lo <= NEUTRAL ? CUBE + GREY_LV[k + ((r + g + b + g) >> 2)] : (CUBE_LV[k + r] * L + CUBE_LV[k + g]) * L + CUBE_LV[k + b];
    }
  }
  return out;
}

class Bytes {
  buf = new Uint8Array(1 << 16);
  n = 0;
  push(b: number) {
    if (this.n === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.n++] = b;
  }
  word(v: number) {
    this.push(v & 0xff);
    this.push((v >> 8) & 0xff);
  }
  str(s: string) {
    for (let i = 0; i < s.length; i++) this.push(s.charCodeAt(i));
  }
  out() {
    return this.buf.slice(0, this.n);
  }
}

const table = new Int16Array(4096 * 256);

/** GIF LZW for 8-bit indices, written as data sub-blocks. */
function lzw(indices: Uint8Array, out: Bytes) {
  const minCode = 8;
  const clear = 1 << minCode;
  const end = clear + 1;
  out.push(minCode);
  let block: number[] = [];
  let acc = 0;
  let bits = 0;
  const emit = (code: number, size: number) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      block.push(acc & 0xff);
      acc >>>= 8;
      bits -= 8;
      if (block.length === 255) {
        out.push(255);
        for (const b of block) out.push(b);
        block = [];
      }
    }
  };
  // prefix * 256 + index -> code, -1 when absent; a typed table is far
  // faster than a Map on Hermes. Reset on every clear code.
  const dict = table;
  dict.fill(-1);
  let next = end + 1;
  let size = minCode + 1;
  emit(clear, size);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const hit = dict[key];
    if (hit !== -1) {
      prefix = hit;
      continue;
    }
    emit(prefix, size);
    if (next < 4096) {
      dict[key] = next++;
      // grow after the code that no longer fits has been assigned
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(clear, size);
      dict.fill(-1);
      next = end + 1;
      size = minCode + 1;
    }
    prefix = k;
  }
  emit(prefix, size);
  emit(end, size);
  if (bits > 0) block.push(acc & 0xff);
  while (block.length) {
    const part = block.splice(0, 255);
    out.push(part.length);
    for (const b of part) out.push(b);
  }
  out.push(0);
}

/**
 * An endlessly looping GIF from frames of palette indices (toIndices), each
 * shown `delays[i]` hundredths of a second.
 */
export function encodeGif(frames: Uint8Array[], w: number, h: number, delays: number[]): Uint8Array {
  const o = new Bytes();
  o.str('GIF89a');
  o.word(w);
  o.word(h);
  o.push(0xf7); // global colour table, 8 bits, 256 entries
  o.push(0);
  o.push(0);
  for (const b of PALETTE) o.push(b);
  // NETSCAPE2.0: loop forever
  o.push(0x21);
  o.push(0xff);
  o.push(11);
  o.str('NETSCAPE2.0');
  o.push(3);
  o.push(1);
  o.word(0);
  o.push(0);
  frames.forEach((f, i) => {
    o.push(0x21);
    o.push(0xf9);
    o.push(4);
    o.push(0);
    o.word(delays[i] ?? 45);
    o.push(0);
    o.push(0);
    o.push(0x2c);
    o.word(0);
    o.word(0);
    o.word(w);
    o.word(h);
    o.push(0);
    lzw(f, o);
  });
  o.push(0x3b);
  return o.out();
}
