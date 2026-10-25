// Develop photos on a Mac with the app's own film shader (CanvasKit = the same
// Skia), so looks can be tuned and store images made without a device.
//
//   node --experimental-strip-types scripts/develop-node.ts <photo.jpg> <outdir> [film ...|all] [--date YYYY-MM-DD] [--seed N] [--lucky]
//
// Mirrors src/lib/develop.ts step for step; the shader and uniforms are
// imported from the app, so only the date-stamp font differs (Andale Mono here,
// Android's monospace on device).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { FILM_SKSL } from '../src/lib/filmShader.ts';
import { LOOKS, filmUniforms } from '../src/lib/looks.ts';
import { luckyLook } from '../src/lib/lucky.ts';
import { bakeLut } from '../src/lib/lut.ts';
import type { FilmId } from '../src/lib/film.ts';

const require = createRequire(import.meta.url);
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit.js');
const ck = await CanvasKitInit({ locateFile: (f: string) => require.resolve(`canvaskit-wasm/bin/full/${f}`) });

const PRINT_EDGE = 1600;
const STAMP_FONT = '/System/Library/Fonts/Supplemental/Andale Mono.ttf';

const args = process.argv.slice(2);
const take = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const dateArg = take('--date');
const seedArg = take('--seed');
// --lucky: develop as a lucky frame (lib/lucky.ts luckyLook)
const lucky = args.includes('--lucky') && (args.splice(args.indexOf('--lucky'), 1), true);
const [photo, outdir, ...filmArgs] = args;
if (!photo || !outdir) {
  console.error('usage: develop-node.ts <photo.jpg> <outdir> [film ...|all] [--date YYYY-MM-DD] [--seed N]');
  process.exit(1);
}
const films = (!filmArgs.length || filmArgs.includes('all') ? Object.keys(LOOKS) : filmArgs) as FilmId[];
const date = dateArg ? new Date(`${dateArg}T12:00:00`) : new Date();
const seed = seedArg ? Number(seedArg) : date.getTime();

const src = ck.MakeImageFromEncoded(readFileSync(photo));
if (!src) throw new Error(`cannot decode ${photo}`);
const stampFace = ck.Typeface.MakeTypefaceFromData(readFileSync(STAMP_FONT).buffer);

function stampText(d: Date) {
  return `'${String(d.getFullYear()).slice(2)} ${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}`;
}

function develop(film: FilmId): Uint8Array {
  const look = LOOKS[film];
  const k = Math.min(1, PRINT_EDGE / Math.max(src.width(), src.height()));
  const w = Math.round(src.width() * k);
  const h = Math.round(src.height() * k);
  const unit = w / 1080;
  const surface = ck.MakeSurface(w, h);
  const canvas = surface.getCanvas();
  const full = ck.XYWHRect(0, 0, w, h);

  const base = new ck.Paint();
  if (look.blur) base.setImageFilter(ck.ImageFilter.MakeBlur(look.blur * unit, look.blur * unit * 0.25, ck.TileMode.Clamp, null));
  canvas.drawImageRect(src, ck.XYWHRect(0, 0, src.width(), src.height()), full, base);
  surface.flush();
  const print = surface.makeImageSnapshot();

  const q = 4;
  const small = ck.MakeSurface(Math.ceil(w / q), Math.ceil(h / q));
  const blur = new ck.Paint();
  blur.setImageFilter(ck.ImageFilter.MakeBlur(6 * unit, 6 * unit, ck.TileMode.Clamp, null));
  small.getCanvas().drawImageRect(print, full, ck.XYWHRect(0, 0, w / q, h / q), blur);
  small.flush();
  const glow = small.makeImageSnapshot();

  const lut = bakeLut(look);
  const lutImage = ck.MakeImage(
    { width: lut.width, height: lut.height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB },
    lut.rgba,
    lut.width * 4,
  );
  if (!lutImage) throw new Error('film LUT image failed');
  const effect = ck.RuntimeEffect.Make(FILM_SKSL);
  if (!effect) throw new Error('film shader failed to compile');
  const paint = new ck.Paint();
  paint.setShader(
    effect.makeShaderWithChildren(filmUniforms(lucky ? luckyLook(look) : look, { w, h }, unit, seed), [
      print.makeShaderOptions(ck.TileMode.Clamp, ck.TileMode.Clamp, ck.FilterMode.Linear, ck.MipmapMode.None),
      glow.makeShaderOptions(ck.TileMode.Clamp, ck.TileMode.Clamp, ck.FilterMode.Linear, ck.MipmapMode.None, ck.Matrix.scaled(q, q)),
      lutImage.makeShaderOptions(ck.TileMode.Clamp, ck.TileMode.Clamp, ck.FilterMode.Linear, ck.MipmapMode.None),
    ]),
  );
  canvas.drawRect(full, paint);

  const size = Math.round(34 * unit);
  const font = new ck.Font(stampFace, size);
  const text = stampText(date);
  const tw = font.getGlyphWidths(font.getGlyphIDs(text)).reduce((a: number, b: number) => a + b, 0);
  const x = w - tw - 40 * unit;
  const y = h - 40 * unit;
  const halo = new ck.Paint();
  halo.setColor(ck.Color(255, 120, 30, 0.55));
  halo.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, 6 * unit, true));
  canvas.drawText(text, x, y, halo, font);
  const ink = new ck.Paint();
  ink.setColor(ck.Color(255, 154, 60, 1));
  canvas.drawText(text, x, y, ink, font);

  surface.flush();
  const out = surface.makeImageSnapshot().encodeToBytes(ck.ImageFormat.JPEG, 90);
  if (!out) throw new Error('encode failed');
  return out;
}

mkdirSync(outdir, { recursive: true });
const stem = basename(photo).replace(/\.[^.]+$/, '');
for (const f of films) {
  const file = join(outdir, films.length === 1 && !filmArgs.includes('all') ? `${stem}.jpg` : `${stem}-${f}.jpg`);
  writeFileSync(file, develop(f));
  console.log(file);
}
