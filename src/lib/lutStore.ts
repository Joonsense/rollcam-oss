// Baked film LUTs kept on disk, so each film is baked once per install (about
// half a second on a phone's JS engine) instead of once per app launch. The
// file name hashes the look and grid size, so retuning a film re-bakes it.

import { File, Paths } from 'expo-file-system';
import { LUT_N, type Look } from './looks';
import { bakeLut, type Lut } from './lut';

const mem = new WeakMap<Look, Lut>();

/** FNV-1a, enough to tell film tunings apart. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function lutFile(look: Look): File {
  return new File(Paths.cache, `lut-${hash(`${LUT_N}:${JSON.stringify(look)}`)}.rgba`);
}

/** The film's LUT from memory, then disk, else baked and saved. */
export function filmLut(look: Look): Lut {
  const hit = mem.get(look);
  if (hit) return hit;
  const width = LUT_N * LUT_N;
  const size = width * LUT_N * 4;
  const file = lutFile(look);
  let lut: Lut | null = null;
  try {
    if (file.exists && file.size === size) lut = { n: LUT_N, width, height: LUT_N, rgba: file.bytesSync() };
  } catch {
    lut = null; // unreadable cache: bake again
  }
  if (!lut) {
    lut = bakeLut(look);
    try {
      if (file.exists) file.delete();
      file.create();
      file.writeSync(lut.rgba);
    } catch {} // cache is best effort
  }
  mem.set(look, lut);
  return lut;
}
