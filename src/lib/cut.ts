// "필름 컷": a photo shared as one frame of 35mm negative on a light table
// (4:5). Sprocket holes, edge printing with the date and the film, and the
// day before and after on the same strip, dimmed, when the roll has them.
// Geometry in cutLayout.ts.

import { BlurStyle, ClipOp, ImageFormat, PaintStyle, Skia, TileMode, matchFont, type SkCanvas, type SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CUT_H, CUT_W, cutLayout, edgeLeft, edgeRight, type Rect } from './cutLayout';
import { addDays } from './day';
import { loadImage } from './develop';
import { FILM_NAMES } from './film';
import { isLucky } from './lucky';
import { tr } from './i18n';
import { getShot, photoUri, type Shot } from './store';

const BASE = '#1E140C'; // amber-black film base, as on the roll screen
const EDGE_INK = 'rgba(255,154,60,0.78)';

function cover(c: SkCanvas, img: SkImage, r: Rect, alpha = 1) {
  const k = Math.max(r.w / img.width(), r.h / img.height());
  const sw = r.w / k;
  const sh = r.h / k;
  const p = Skia.Paint();
  p.setAlphaf(alpha);
  c.drawImageRect(img, Skia.XYWHRect((img.width() - sw) / 2, (img.height() - sh) / 2, sw, sh), Skia.XYWHRect(r.x, r.y, r.w, r.h), p);
}

async function neighbour(day: string): Promise<SkImage | null> {
  const s = getShot(day);
  if (!s) return null;
  try {
    return await loadImage(photoUri(s.file));
  } catch {
    return null;
  }
}

export async function composeCut(shot: Shot): Promise<File> {
  const img = await loadImage(photoUri(shot.file));
  const l = cutLayout(img.width() / img.height());
  const surface = Skia.Surface.MakeOffscreen(CUT_W, CUT_H);
  if (!surface) throw new Error('offscreen surface unavailable');
  const c = surface.getCanvas();
  const paint = (color: string) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    return p;
  };

  // light table: warm white, brightest under the frame
  c.drawRect(Skia.XYWHRect(0, 0, CUT_W, CUT_H), paint('#E9E5DD'));
  const glow = Skia.Paint();
  glow.setShader(Skia.Shader.MakeRadialGradient({ x: CUT_W / 2, y: l.frame.y + l.frame.h / 2 }, CUT_W * 0.8, [Skia.Color('#FBF9F4'), Skia.Color('#E2DDD3')], null, TileMode.Clamp));
  c.drawRect(Skia.XYWHRect(0, 0, CUT_W, CUT_H), glow);

  // the strip, with a soft shadow on the table
  const shadow = paint('rgba(0,0,0,0.35)');
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 18, true));
  c.drawRect(Skia.XYWHRect(l.strip.x + 8, l.strip.y - 20, l.strip.w, l.strip.h + 40), shadow);
  c.drawRect(Skia.XYWHRect(l.strip.x, l.strip.y - 20, l.strip.w, l.strip.h + 40), paint(BASE));
  // light shows through the holes
  for (const h of l.holes) c.drawRRect(Skia.RRectXY(Skia.XYWHRect(h.x, h.y, h.w, h.h), 6, 6), paint('#F6F3EC'));

  // yesterday above, tomorrow below: dimmed if shot, bare base otherwise
  for (const [r, day] of [
    [l.prev, addDays(shot.day, -1)],
    [l.next, addDays(shot.day, 1)],
  ] as const) {
    const n = await neighbour(day);
    c.save();
    c.clipRect(Skia.XYWHRect(r.x, r.y, r.w, r.h), ClipOp.Intersect, true);
    c.drawRect(Skia.XYWHRect(r.x, r.y, r.w, r.h), paint('#2A1C10'));
    if (n) {
      cover(c, n, r, 0.42);
    }
    c.restore();
  }

  // today's frame
  cover(c, img, l.frame);
  const line = paint('rgba(0,0,0,0.5)');
  line.setStyle(PaintStyle.Stroke);
  line.setStrokeWidth(2);
  c.drawRect(Skia.XYWHRect(l.frame.x, l.frame.y, l.frame.w, l.frame.h), line);

  // edge printing, running along the strip
  const edgeFont = matchFont({ fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold' });
  const ink = paint(EDGE_INK);
  // runs along [top, top + len] of the frame side, shrunk to fit a short (landscape) frame
  const runText = (text: string, x: number, angle: 90 | -90, top: number, len: number) => {
    const w22 = edgeFont.measureText(text).width;
    const size = Math.max(12, Math.min(22, (22 * len) / w22));
    const font = size === 22 ? edgeFont : matchFont({ fontFamily: 'monospace', fontSize: size, fontWeight: 'bold' });
    const w = font.measureText(text).width;
    c.save();
    c.translate(x, top + len / 2);
    c.rotate(angle, 0, 0);
    c.drawText(text, -w / 2, size * 0.36, ink, font);
    c.restore();
  };
  // the left side leaves its top 56px to the frame number
  runText(edgeLeft(shot.day), l.edge[0], -90, l.frame.y + 56, l.frame.h - 64);
  runText(edgeRight(FILM_NAMES[shot.film], isLucky(shot.takenAt)), l.edge[1], 90, l.frame.y + 8, l.frame.h - 16);
  // frame number down from the frame's top corner, the lab's arrow just above it
  const no = String(Number(shot.day.slice(8)));
  const numFont = matchFont({ fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold' });
  c.save();
  c.translate(l.edge[0], l.frame.y + 6);
  c.rotate(-90, 0, 0);
  c.drawText(no, -numFont.measureText(no).width, 9, ink, numFont);
  c.restore();
  c.drawPath(
    Skia.Path.Polygon(
      [
        { x: l.edge[0] - 8, y: l.frame.y - 24 },
        { x: l.edge[0] + 8, y: l.frame.y - 24 },
        { x: l.edge[0], y: l.frame.y - 10 },
      ],
      true,
    ),
    ink,
  );

  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 92);
  const out = new File(Paths.cache, `cut-${shot.day}.jpg`);
  if (out.exists) out.delete();
  out.create();
  await out.write(bytes);
  return out;
}

/** One photo as a film cut; the bare JPEG if composing fails. */
export async function shareCut(shot: Shot): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(tr('공유를 쓸 수 없는 기기예요', "This phone can't share", 'この端末では共有できません'));
  let uri = photoUri(shot.file);
  try {
    uri = (await composeCut(shot)).uri;
  } catch {}
  await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: tr('필름 컷 공유', 'Share film frame', 'フィルムコマを共有') });
}
