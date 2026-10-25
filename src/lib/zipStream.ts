// A zip written and read one entry at a time, so a roll of years of JPEGs
// never sits in memory whole (the export used to hold every photo plus the
// zip, about twice the roll). Entries are stored, not deflated: JPEGs are
// already compressed. The reader takes any zip without zip64, stored or
// deflated (an older export, or one a desktop tool re-packed). Pure: the
// caller does the file I/O (exportData.ts).

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();

/** MS-DOS date and time, local, two-second steps (what unzip tools show). */
function dosTime(d: Date): [number, number] {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [time, date];
}

const ZIP32_MAX = 0xffffffff;

/**
 * Writes a stored zip through `write`, which gets each piece in order (the
 * caller appends them to a file). Throws past 4GB or 65,535 entries rather
 * than writing a zip nothing can open.
 */
export class ZipWriter {
  private at = 0;
  private dir: Uint8Array[] = [];
  private count = 0;
  private readonly write: (bytes: Uint8Array) => void;
  constructor(write: (bytes: Uint8Array) => void) {
    this.write = write;
  }

  add(name: string, data: Uint8Array, when: Date = new Date()): void {
    const n = enc.encode(name);
    const crc = crc32(data);
    const [time, date] = dosTime(when);
    if (this.at + 30 + n.length + data.length > ZIP32_MAX || this.count >= 0xffff) throw new Error('zip too large');
    const local = new Uint8Array(30 + n.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true); // version needed
    l.setUint16(6, 0x0800, true); // UTF-8 names
    l.setUint16(8, 0, true); // stored
    l.setUint16(10, time, true);
    l.setUint16(12, date, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, n.length, true);
    l.setUint16(28, 0, true);
    local.set(n, 30);

    const central = new Uint8Array(46 + n.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); // made by
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, n.length, true);
    c.setUint32(42, this.at, true); // local header offset
    central.set(n, 46);

    this.write(local);
    this.write(data);
    this.at += local.length + data.length;
    this.dir.push(central);
    this.count++;
  }

  /** The central directory and its end record. Returns the zip's size. */
  finish(): number {
    const start = this.at;
    let size = 0;
    for (const d of this.dir) {
      this.write(d);
      size += d.length;
    }
    if (start + size > ZIP32_MAX) throw new Error('zip too large');
    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, this.count, true);
    e.setUint16(10, this.count, true);
    e.setUint32(12, size, true);
    e.setUint32(16, start, true);
    this.write(end);
    this.dir = [];
    return start + size + 22;
  }
}

export type ZipEntry = { name: string; method: number; compressed: number; size: number; crc: number; offset: number };

/** How far from the end the end record can sit: 22 bytes plus the longest comment. */
export const TAIL = 22 + 0xffff;

/**
 * Finds the central directory from the zip's last bytes (`tail`, the final
 * min(size, TAIL) bytes). Null when there is no end record: not a zip.
 */
export function findDirectory(tail: Uint8Array): { offset: number; size: number; count: number } | null {
  const v = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  for (let i = tail.length - 22; i >= 0; i--) {
    if (v.getUint32(i, true) !== 0x06054b50) continue;
    const count = v.getUint16(i + 10, true);
    const size = v.getUint32(i + 12, true);
    const offset = v.getUint32(i + 16, true);
    if (count === 0xffff || size === ZIP32_MAX || offset === ZIP32_MAX) throw new Error('zip64');
    return { offset, size, count };
  }
  return null;
}

const dec = new TextDecoder();

/** Every entry in the central directory bytes. Stops at anything malformed. */
export function readDirectory(dir: Uint8Array): ZipEntry[] {
  const v = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  const out: ZipEntry[] = [];
  let i = 0;
  while (i + 46 <= dir.length && v.getUint32(i, true) === 0x02014b50) {
    const nameLen = v.getUint16(i + 28, true);
    const extra = v.getUint16(i + 30, true);
    const comment = v.getUint16(i + 32, true);
    if (i + 46 + nameLen > dir.length) break;
    out.push({
      name: dec.decode(dir.subarray(i + 46, i + 46 + nameLen)),
      method: v.getUint16(i + 10, true),
      crc: v.getUint32(i + 16, true),
      compressed: v.getUint32(i + 20, true),
      size: v.getUint32(i + 24, true),
      offset: v.getUint32(i + 42, true),
    });
    i += 46 + nameLen + extra + comment;
  }
  return out;
}

/** Where an entry's data starts, from its 30-byte local header (its own name and extra lengths). */
export function dataStart(entry: ZipEntry, local: Uint8Array): number {
  const v = new DataView(local.buffer, local.byteOffset, local.byteLength);
  if (local.length < 30 || v.getUint32(0, true) !== 0x04034b50) throw new Error('bad local header');
  return entry.offset + 30 + v.getUint16(26, true) + v.getUint16(28, true);
}
