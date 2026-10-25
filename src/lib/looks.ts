// Film looks. Spec §4: every film = color table + grain + vignette, so a new
// film is one entry here. `filmColor` below is the whole color part of a film
// (hue moves, saturation, white balance, per-channel S-curves, faded blacks,
// split toning). It is baked into a 3D LUT (lut.ts) that the develop shader
// samples, so this function is the one source of truth for color and the shader
// only adds the optical part: halation, light leak, flash, grain, vignette.

import type { FilmId } from './film.ts';

export type RGB = [number, number, number];

/**
 * Selective color, like a film's dye response: colors near `hue` (HSV degrees,
 * 0 red, 30 orange/skin, 60 yellow, 120 green, 210 sky, 300 magenta) within
 * `width` degrees move by `shift` degrees, scale saturation by `sat` and
 * brightness by `lum`. Greys are never touched.
 */
export type Hue = { hue: number; width: number; shift?: number; sat?: number; lum?: number };

export type Look = {
  sat: number; // 1 = unchanged, 0 = mono
  contrast: number; // S-curve strength, 1 = unchanged, <1 = flatter
  curves?: RGB; // per-channel contrast multiplier (dye layers differ), default 1
  hues?: Hue[]; // applied first, so a mono film still renders colors as different greys
  gain: RGB; // per-channel multiply (white balance / tint)
  lift: RGB; // faded blacks 0..1 (whites stay put)
  shadow?: RGB; // tint added to the shadows (split toning)
  highlight?: RGB; // tint added to the highlights
  halation?: number; // 0..1 red-orange glow bleeding from bright areas
  leak?: number; // 0..1 warm light leak from one edge (edge picked per shot)
  grain: number; // 0..1 strength
  grainSize: number; // px at 1080 wide
  vignette: number; // 0..1
  blur?: number; // motion blur px at 1080 wide
  flash?: number; // center brightening 0..1
};

// Hue moves follow the stock each film is named after: Gold/Ultramax warm
// yellow-greens, Portra quiet skin and soft cyan skies, Fuji cool greens and
// pinker skin, Ektar deep blue and red, 800T cyan shadows with red glow, and a
// yellow-filter sky for the mono roll.
const SKIN = 30;
const GREEN = 115;
const SKY = 215;

export const LOOKS: Record<FilmId, Look> = {
  'daily-negative': {
    sat: 0.88, contrast: 1.0, curves: [1, 1, 0.96], gain: [1.03, 1.0, 0.95], lift: [0.05, 0.045, 0.04], shadow: [0, 0.01, 0.02], highlight: [0.02, 0.01, 0],
    hues: [{ hue: SKIN, width: 35, sat: 1.04, lum: 0.02 }, { hue: GREEN, width: 50, shift: -8, sat: 0.9 }, { hue: SKY, width: 40, sat: 1.05 }],
    halation: 0.15, grain: 0.18, grainSize: 1.6, vignette: 0.28,
  },
  'golden-roll': {
    sat: 1.08, contrast: 1.12, curves: [1, 1, 0.92], gain: [1.1, 1.0, 0.84], lift: [0.05, 0.03, 0.01], shadow: [0.01, 0, 0.02], highlight: [0.05, 0.02, -0.03],
    hues: [{ hue: 45, width: 40, sat: 1.15, lum: 0.03 }, { hue: GREEN, width: 50, shift: -14, sat: 0.85 }, { hue: SKY, width: 45, sat: 0.9 }],
    halation: 0.45, leak: 0.35, grain: 0.2, grainSize: 1.6, vignette: 0.38,
  },
  'night-tungsten': {
    sat: 0.95, contrast: 1.2, curves: [1, 1, 0.94], gain: [1.08, 1.0, 0.86], lift: [0.01, 0.025, 0.06], shadow: [0, 0.02, 0.05], highlight: [0.04, 0.01, -0.02],
    hues: [{ hue: 0, width: 30, sat: 1.12 }, { hue: GREEN, width: 50, shift: 16, sat: 0.8 }, { hue: SKY, width: 45, shift: -12, sat: 1.1 }],
    halation: 0.75, grain: 0.42, grainSize: 2.4, vignette: 0.45,
  },
  'rainy-mono': {
    sat: 0.0, contrast: 1.12, gain: [0.97, 1.0, 1.06], lift: [0.04, 0.045, 0.06], shadow: [0, 0.005, 0.02],
    hues: [{ hue: SKY, width: 60, lum: -0.08 }, { hue: SKIN, width: 40, lum: 0.05 }, { hue: GREEN, width: 50, lum: 0.03 }],
    halation: 0.1, grain: 0.26, grainSize: 1.8, vignette: 0.35, blur: 1.2,
  },
  'snow-pastel': {
    sat: 0.7, contrast: 0.82, gain: [1.03, 1.04, 1.06], lift: [0.1, 0.1, 0.11], shadow: [0.02, 0.02, 0.04], highlight: [0, 0.01, 0.03],
    hues: [{ hue: SKY, width: 50, shift: -6, sat: 0.85, lum: 0.03 }, { hue: 330, width: 40, sat: 1.12 }, { hue: SKIN, width: 30, shift: -4 }],
    halation: 0.25, grain: 0.12, grainSize: 1.4, vignette: 0.15,
  },
  // Fuji Superia under falling snow: cool lifted blacks and blue shadows, but
  // street lamps and red scarves keep a warm glow, so the first snow reads as
  // an evening, not as the flat white of Snow Pastel.
  'first-snow': {
    sat: 0.86, contrast: 0.94, curves: [0.96, 1, 1.06], gain: [0.97, 1.01, 1.07], lift: [0.06, 0.07, 0.1], shadow: [0, 0.015, 0.05], highlight: [0.02, 0.02, 0.04],
    hues: [{ hue: SKY, width: 50, shift: -8, sat: 1.05 }, { hue: 0, width: 30, sat: 1.18 }, { hue: 45, width: 30, sat: 1.12, lum: 0.02 }, { hue: SKIN, width: 30, lum: 0.03 }],
    halation: 0.55, leak: 0.12, grain: 0.14, grainSize: 1.4, vignette: 0.26,
  },
  // A clear full-moon night: silver moonlight, cool blue shadows that stay
  // open, warm street lights quieted, a soft glow and fine night grain.
  'moon-silver': {
    sat: 0.6, contrast: 1.08, curves: [0.96, 1, 1.06], gain: [0.93, 0.99, 1.1], lift: [0.03, 0.04, 0.08], shadow: [0, 0.015, 0.06], highlight: [0.02, 0.03, 0.05],
    hues: [{ hue: SKIN, width: 40, sat: 0.7, lum: 0.02 }, { hue: 45, width: 30, sat: 0.6 }, { hue: SKY, width: 50, shift: -6, sat: 1.1, lum: 0.03 }],
    halation: 0.25, grain: 0.3, grainSize: 2.0, vignette: 0.5,
  },
  // Postcard: a holiday print, Ektar-like. Warm sun on skin and stone, a deep
  // clear blue sky and lush greens, clean blacks, a touch of glow.
  'postcard': {
    sat: 1.12, contrast: 1.1, curves: [1.02, 1, 0.98], gain: [1.06, 1.01, 0.94], lift: [0.03, 0.025, 0.02], shadow: [0, 0.005, 0.02], highlight: [0.04, 0.02, -0.01],
    hues: [{ hue: SKY, width: 50, shift: 6, sat: 1.25, lum: -0.04 }, { hue: GREEN, width: 50, shift: -6, sat: 1.12 }, { hue: SKIN, width: 30, sat: 1.06, lum: 0.03 }, { hue: 0, width: 25, sat: 1.15 }],
    halation: 0.3, grain: 0.15, grainSize: 1.5, vignette: 0.3,
  },
  // Blue hour: a deep, clean blue sky and blue shadows, while lamps and lit
  // windows that just came on stay warm against it, with a little glow.
  'blue-hour': {
    sat: 1.0, contrast: 1.1, curves: [0.96, 1, 1.04], gain: [0.9, 0.98, 1.12], lift: [0.02, 0.03, 0.07], shadow: [0, 0.01, 0.07], highlight: [0.04, 0.02, -0.01],
    hues: [{ hue: SKY, width: 60, shift: 8, sat: 1.25, lum: -0.03 }, { hue: 40, width: 35, sat: 1.2, lum: 0.03 }, { hue: GREEN, width: 50, shift: 25, sat: 0.7 }, { hue: SKIN, width: 25, sat: 0.95, lum: 0.02 }],
    halation: 0.5, grain: 0.3, grainSize: 2.0, vignette: 0.42,
  },
  // Cherry blossom days: airy, pink petals lifted and pushed toward magenta
  // without turning skin pink, soft cyan sky, greens pale like new leaves.
  'spring-bloom': {
    sat: 0.95, contrast: 0.9, curves: [1, 0.98, 1], gain: [1.04, 1.0, 1.02], lift: [0.07, 0.06, 0.07], shadow: [0.01, 0, 0.02], highlight: [0.045, 0.01, 0.03],
    hues: [{ hue: 330, width: 45, shift: -4, sat: 1.25, lum: 0.04 }, { hue: SKIN, width: 25, lum: 0.03 }, { hue: GREEN, width: 50, shift: -10, sat: 0.85, lum: 0.03 }, { hue: SKY, width: 45, shift: -10, sat: 0.95, lum: 0.04 }],
    halation: 0.3, leak: 0.18, grain: 0.13, grainSize: 1.4, vignette: 0.2,
  },
  // Foliage: reds and oranges deep and dense (kept off skin's hue), greens
  // turned toward yellow, a clear blue autumn sky behind them.
  'autumn-maple': {
    sat: 1.12, contrast: 1.1, curves: [1, 1, 0.94], gain: [1.07, 1.0, 0.9], lift: [0.03, 0.025, 0.02], shadow: [0.01, 0, 0.02], highlight: [0.04, 0.02, -0.02],
    hues: [{ hue: 5, width: 25, shift: 3, sat: 1.25 }, { hue: 18, width: 14, sat: 1.15, lum: -0.02 }, { hue: 60, width: 30, sat: 1.15 }, { hue: GREEN, width: 55, shift: -22, sat: 0.95 }, { hue: SKY, width: 45, sat: 1.08, lum: -0.03 }],
    halation: 0.3, grain: 0.18, grainSize: 1.6, vignette: 0.32,
  },
  'haze-film': {
    sat: 0.8, contrast: 0.8, gain: [1.04, 1.01, 0.94], lift: [0.09, 0.08, 0.06], highlight: [0.03, 0.02, 0],
    hues: [{ hue: GREEN, width: 50, shift: 6, sat: 0.8 }, { hue: SKY, width: 45, sat: 0.85, lum: 0.03 }],
    halation: 0.35, grain: 0.16, grainSize: 1.6, vignette: 0.22,
  },
  'grey-portra': {
    sat: 0.85, contrast: 0.98, curves: [1, 0.98, 0.94], gain: [1.05, 1.0, 0.96], lift: [0.05, 0.045, 0.045], shadow: [0, 0.01, 0.02], highlight: [0.03, 0.015, 0],
    hues: [{ hue: SKIN, width: 30, shift: 3, sat: 0.92, lum: 0.02 }, { hue: GREEN, width: 50, shift: -6, sat: 0.8 }, { hue: SKY, width: 45, shift: -8, sat: 0.9 }],
    halation: 0.2, grain: 0.18, grainSize: 1.6, vignette: 0.3,
  },
  'summer-kodak': {
    sat: 1.25, contrast: 1.14, gain: [1.06, 1.04, 0.9], lift: [0.02, 0.03, 0.04], highlight: [0.04, 0.02, -0.02],
    hues: [{ hue: 0, width: 30, sat: 1.12 }, { hue: SKIN, width: 25, sat: 0.92 }, { hue: SKY, width: 45, sat: 1.15, lum: -0.04 }],
    halation: 0.3, leak: 0.25, grain: 0.16, grainSize: 1.5, vignette: 0.3, flash: 0.1,
  },
  'winter-fuji': {
    sat: 1.05, contrast: 1.16, curves: [0.95, 1, 1.05], gain: [0.94, 1.02, 1.08], lift: [0.0, 0.025, 0.04], shadow: [0, 0.02, 0.03], highlight: [0, 0.01, 0.02],
    hues: [{ hue: GREEN, width: 50, shift: 14, sat: 1.05 }, { hue: SKIN, width: 30, shift: -4, sat: 0.9 }, { hue: SKY, width: 40, shift: -6 }, { hue: 320, width: 40, sat: 1.08 }],
    halation: 0.15, grain: 0.15, grainSize: 1.4, vignette: 0.3,
  },
  'storm-push': {
    sat: 0.75, contrast: 1.45, curves: [1, 1, 1.06], gain: [0.98, 1.0, 1.04], lift: [0.0, 0.0, 0.02], shadow: [0, 0.01, 0.03],
    hues: [{ hue: SKY, width: 50, shift: -10, sat: 0.85, lum: -0.06 }, { hue: 0, width: 30, sat: 0.9 }],
    halation: 0.3, grain: 0.5, grainSize: 2.6, vignette: 0.55,
  },
  'motion-lofi': {
    sat: 0.92, contrast: 1.06, gain: [1.0, 1.0, 0.98], lift: [0.03, 0.03, 0.03],
    hues: [{ hue: GREEN, width: 50, shift: 10, sat: 0.9 }, { hue: 0, width: 30, sat: 1.06 }],
    halation: 0.2, leak: 0.2, grain: 0.22, grainSize: 1.8, vignette: 0.5, blur: 2.5,
  },
  'party-flash': {
    sat: 1.15, contrast: 1.18, gain: [1.05, 1.0, 0.98], lift: [0.01, 0.0, 0.01],
    hues: [{ hue: 0, width: 30, sat: 1.1 }, { hue: SKIN, width: 30, sat: 0.95, lum: 0.03 }],
    halation: 0.4, leak: 0.15, grain: 0.2, grainSize: 1.7, vignette: 0.4, flash: 0.35,
  },
};

/** Grid points per axis of the baked 3D LUT (lut.ts). 33 is the usual .cube size. */
export const LUT_N = 33;

/** Luma weights (Rec. 709). */
export const LUMA: RGB = [0.2126, 0.7152, 0.0722];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * S-curve pinned at 0, 0.5 and 1. k > 1 adds contrast with a soft toe and
 * shoulder (never clips), k < 1 flattens.
 */
export function tone(x: number, k: number): number {
  const v = clamp01(x);
  return v < 0.5 ? 0.5 * Math.pow(2 * v, k) : 1 - 0.5 * Math.pow(2 * (1 - v), k);
}

const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

type Stage = (r: number, g: number, b: number, out: number[]) => void;

/** One channel of HSV -> RGB (n = 5 red, 3 green, 1 blue; h in sextants). */
function hsvChannel(n: number, h: number, s: number, v: number): number {
  const k = (n + h) % 6;
  return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
}

/**
 * The color stage of one film as a scalar function (no arrays or closures per
 * pixel), because a LUT bake runs it 36k times on the phone's JS engine.
 * Order: hue moves -> saturation + white balance -> per-channel S-curves over
 * faded blacks -> split toning. Hue / saturation moves keep the pixel's luma
 * (turning a sky cyan must not brighten it); only `lum` changes brightness.
 */
function makeStage(l: Look): Stage {
  const [LR, LG, LB] = LUMA;
  const hues = (l.hues ?? []).map((m) => ({ hue: m.hue, width: m.width, shift: m.shift ?? 0, sat: m.sat ?? 1, lum: m.lum ?? 0 }));
  const [gr, gg, gb] = l.gain;
  const [lr, lg, lb] = l.lift;
  const kr = l.contrast * (l.curves?.[0] ?? 1);
  const kg = l.contrast * (l.curves?.[1] ?? 1);
  const kb = l.contrast * (l.curves?.[2] ?? 1);
  const [sr, sg, sb] = l.shadow ?? [0, 0, 0];
  const [hr, hg, hb] = l.highlight ?? [0, 0, 0];
  const sat = l.sat;

  return (r, g, b, out) => {
    r = clamp01(r);
    g = clamp01(g);
    b = clamp01(b);

    // hue moves (HSV), weights against the original hue so entries never chain
    if (hues.length) {
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      const s = max > 0 ? d / max : 0;
      const chroma = smooth(0.03, 0.3, s); // greys and near greys stay put
      if (chroma > 0) {
        let h = 0;
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
        let dh = 0;
        let ks = 1;
        let dv = 0;
        for (let i = 0; i < hues.length; i++) {
          const m = hues[i];
          const dist = Math.abs(((h - m.hue + 540) % 360) - 180);
          if (dist >= m.width) continue;
          const w = chroma * 0.5 * (1 + Math.cos((Math.PI * dist) / m.width));
          dh += m.shift * w;
          ks *= 1 + (m.sat - 1) * w;
          dv += m.lum * w;
        }
        const y = r * LR + g * LG + b * LB + dv;
        const h2 = (h + dh + 360) % 360 / 60;
        const s2 = clamp01(s * ks);
        r = hsvChannel(5, h2, s2, max);
        g = hsvChannel(3, h2, s2, max);
        b = hsvChannel(1, h2, s2, max);
        const fix = y - (r * LR + g * LG + b * LB);
        r = clamp01(r + fix);
        g = clamp01(g + fix);
        b = clamp01(b + fix);
      }
    }

    const y0 = r * LR + g * LG + b * LB;
    r = lr + tone(clamp01((y0 + (r - y0) * sat) * gr), kr) * (1 - lr);
    g = lg + tone(clamp01((y0 + (g - y0) * sat) * gg), kg) * (1 - lg);
    b = lb + tone(clamp01((y0 + (b - y0) * sat) * gb), kb) * (1 - lb);
    const y1 = r * LR + g * LG + b * LB;
    const sw = (1 - y1) * (1 - y1);
    const hw = y1 * y1;
    out[0] = clamp01(r + sr * sw + hr * hw);
    out[1] = clamp01(g + sg * sw + hg * hw);
    out[2] = clamp01(b + sb * sw + hb * hw);
  };
}

const stages = new WeakMap<Look, Stage>();

/** The film's color stage, built once per look. */
export function colorStage(l: Look): Stage {
  let st = stages.get(l);
  if (!st) stages.set(l, (st = makeStage(l)));
  return st;
}

/** Hue moves alone (the first step of the color stage). Greys are never moved. */
export function hueMoves(hues: Hue[] | undefined, rgb: RGB): RGB {
  const out = [0, 0, 0];
  // identity everywhere else: no contrast change, no lift, no tint, sat 1
  makeStage({ sat: 1, contrast: 1, gain: [1, 1, 1], lift: [0, 0, 0], hues, grain: 0, grainSize: 1, vignette: 0 })(rgb[0], rgb[1], rgb[2], out);
  return out as RGB;
}

/** One pixel through the film color stage (no grain / halation / vignette). */
export function filmColor(l: Look, rgb: RGB): RGB {
  const out = [0, 0, 0];
  colorStage(l)(rgb[0], rgb[1], rgb[2], out);
  return out as RGB;
}

/** Shader uniforms for develop.ts FILM_SKSL, in declaration order. */
export function filmUniforms(l: Look, size: { w: number; h: number }, unit: number, seed: number): number[] {
  const leakAngle = ((seed % 360) * Math.PI) / 180;
  return [
    size.w, size.h,
    LUT_N,
    l.halation ?? 0,
    l.grain, Math.max(1, l.grainSize * unit), seed % 1000,
    l.vignette,
    l.flash ?? 0,
    l.leak ?? 0, Math.cos(leakAngle), Math.sin(leakAngle),
  ];
}
