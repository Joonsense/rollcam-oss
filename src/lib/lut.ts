// Bakes a film's color stage (looks.ts filmColor) into a 3D LUT. Layout is the
// usual "strip" form: N slices of N x N side by side, blue picks the slice, red
// runs across a slice, green runs down. The develop shader samples it with the
// GPU's bilinear filter inside a slice and mixes the two nearest slices, so one
// texture lookup pair replaces the whole per-pixel color math.

import { LUT_N, colorStage, filmColor, type Look, type RGB } from './looks.ts';

export type Lut = { n: number; width: number; height: number; rgba: Uint8Array };

const cache = new WeakMap<Look, Lut>();

export function bakeLut(look: Look, n = LUT_N): Lut {
  const hit = n === LUT_N ? cache.get(look) : undefined;
  if (hit) return hit;
  const width = n * n;
  const rgba = new Uint8Array(width * n * 4);
  const step = 1 / (n - 1);
  const stage = colorStage(look);
  const out = [0, 0, 0];
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++) {
        stage(r * step, g * step, b * step, out);
        const o = (g * width + b * n + r) * 4;
        rgba[o] = Math.round(out[0] * 255);
        rgba[o + 1] = Math.round(out[1] * 255);
        rgba[o + 2] = Math.round(out[2] * 255);
        rgba[o + 3] = 255;
      }
    }
  }
  const lut = { n, width, height: n, rgba };
  if (n === LUT_N) cache.set(look, lut);
  return lut;
}

/** CPU twin of the shader lookup (trilinear). Used by tests and tooling. */
export function sampleLut(lut: Lut, rgb: RGB): RGB {
  const { n, width, rgba } = lut;
  const m = n - 1;
  const at = (r: number, g: number, b: number, ch: number) => rgba[(g * width + b * n + r) * 4 + ch] / 255;
  const [fr, fg, fb] = rgb.map((v) => Math.min(1, Math.max(0, v)) * m);
  const r0 = Math.floor(fr), g0 = Math.floor(fg), b0 = Math.floor(fb);
  const r1 = Math.min(r0 + 1, m), g1 = Math.min(g0 + 1, m), b1 = Math.min(b0 + 1, m);
  const tr = fr - r0, tg = fg - g0, tb = fb - b0;
  const mix = (a: number, c: number, t: number) => a + (c - a) * t;
  return [0, 1, 2].map((ch) => {
    const slice = (b: number) =>
      mix(mix(at(r0, g0, b, ch), at(r1, g0, b, ch), tr), mix(at(r0, g1, b, ch), at(r1, g1, b, ch), tr), tg);
    return mix(slice(b0), slice(b1), tb);
  }) as RGB;
}

/** Adobe / Resolve .cube text (red fastest), for previewing a film outside the app. */
export function toCube(look: Look, title: string, n = LUT_N): string {
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${n}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  const step = 1 / (n - 1);
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++) lines.push(filmColor(look, [r * step, g * step, b * step]).map((v) => v.toFixed(6)).join(' '));
  return lines.join('\n') + '\n';
}
