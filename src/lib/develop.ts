// "Develops" a captured photo: base (+ motion / rain blur) -> film shader
// (halation, film color from the baked 3D LUT, flash, light leak, grain,
// vignette) -> date stamp, all on a Skia offscreen surface. Runs after the
// shot (no live preview filter, spec §4), so the camera stays fast on every
// device.

import { AlphaType, BlurStyle, ColorType, FilterMode, ImageFormat, MipmapMode, Skia, TileMode, matchFont, type SkImage } from '@shopify/react-native-skia';
import { FILM_SKSL } from './filmShader';
import { filmUniforms, type Look } from './looks';
import { filmLut } from './lutStore';
import { luckyLook } from './lucky';
import { STAMP_COLORS, type StampColor } from './stampColor';

/** Long edge of the developed print. Big enough for a 4x6 print at ~270 dpi. */
export const PRINT_EDGE = 1600;

let filmEffect: ReturnType<typeof Skia.RuntimeEffect.Make> | undefined;
const lutImages = new WeakMap<Look, SkImage>();

function lutImage(look: Look): SkImage {
  const hit = lutImages.get(look);
  if (hit) return hit;
  const lut = filmLut(look);
  const img = Skia.Image.MakeImage(
    { width: lut.width, height: lut.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    Skia.Data.fromBytes(lut.rgba),
    lut.width * 4,
  );
  if (!img) throw new Error('film LUT image failed');
  lutImages.set(look, img);
  return img;
}

function fit(w: number, h: number) {
  const k = Math.min(1, PRINT_EDGE / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** Date stamp text like `'26 10 22`. */
export function stampText(d: Date): string {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `'${yy} ${mm} ${dd}`;
}

/**
 * `lucky`: a lucky frame (lucky.ts) gets a strong light leak and more halation.
 * Only the shader's optical uniforms change; the film color and its cached LUT stay.
 */
export function develop(src: SkImage, look: Look, opts: { date: Date; stamp: boolean; seed: number; stampColor?: StampColor; lucky?: boolean }): Uint8Array {
  const { w, h } = fit(src.width(), src.height());
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('offscreen surface unavailable');
  const canvas = surface.getCanvas();
  const unit = w / 1080; // look params are tuned at 1080 wide
  const full = Skia.XYWHRect(0, 0, w, h);

  // 1. base print (+ motion / rain blur)
  const base = Skia.Paint();
  if (look.blur) base.setImageFilter(Skia.ImageFilter.MakeBlur(look.blur * unit, look.blur * unit * 0.25, TileMode.Clamp));
  canvas.drawImageRect(src, Skia.XYWHRect(0, 0, src.width(), src.height()), full, base);
  surface.flush();
  const print = surface.makeImageSnapshot();

  // 2. quarter-size blurred copy feeds the halation glow
  const q = 4;
  const small = Skia.Surface.MakeOffscreen(Math.ceil(w / q), Math.ceil(h / q));
  if (!small) throw new Error('offscreen surface unavailable');
  const blur = Skia.Paint();
  blur.setImageFilter(Skia.ImageFilter.MakeBlur(6 * unit, 6 * unit, TileMode.Clamp));
  small.getCanvas().drawImageRect(print, Skia.XYWHRect(0, 0, w, h), Skia.XYWHRect(0, 0, w / q, h / q), blur);
  small.flush();
  const glow = small.makeImageSnapshot();

  // 3. film shader over the whole frame
  filmEffect ??= Skia.RuntimeEffect.Make(FILM_SKSL) ?? undefined;
  if (!filmEffect) throw new Error('film shader failed to compile');
  const film = Skia.Paint();
  film.setShader(
    filmEffect.makeShaderWithChildren(filmUniforms(opts.lucky ? luckyLook(look) : look, { w, h }, unit, opts.seed), [
      print.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None),
      glow.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None, Skia.Matrix().scale(q, q)),
      lutImage(look).makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None),
    ]),
  );
  canvas.drawRect(full, film);

  // 4. date stamp, bottom right, LED look in the chosen colour
  if (opts.stamp) {
    const size = Math.round(34 * unit);
    const font = matchFont({ fontFamily: 'monospace', fontSize: size, fontWeight: 'bold' });
    const text = stampText(opts.date);
    const tw = font.measureText(text).width;
    const x = w - tw - 40 * unit;
    const y = h - 40 * unit;
    const halo = Skia.Paint();
    const led = STAMP_COLORS[opts.stampColor ?? 'orange'];
    halo.setColor(Skia.Color(led.halo));
    halo.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 6 * unit, true));
    canvas.drawText(text, x, y, halo, font);
    const ink = Skia.Paint();
    ink.setColor(Skia.Color(led.ink));
    canvas.drawText(text, x, y, ink, font);
  }

  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 90);
}

/** Load an encoded image from a file:// uri. */
export async function loadImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) throw new Error('could not decode photo');
  return img;
}
