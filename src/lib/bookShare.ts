// The film book as one 9:16 story image: every film's slot, collected ones
// with their latest print, missing ones as a dashed outline in the film's
// tint (seasonal ones counting down). Geometry in bookLayout.ts.

import { ClipOp, ImageFormat, PaintStyle, Skia, TileMode, matchFont, type SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { BOOK_H, BOOK_W, bookSlots } from './bookLayout';
import { loadImage } from './develop';
import { FILM_NAMES, seasonWait } from './film';
import type { FilmBook } from './filmbook';
import { krFont } from './fonts';
import { tr } from './i18n';
import { photoUri, type Shot } from './store';
import { thumbUri } from './thumbs';
import { FILM_TINT } from '../ui/theme';

export async function composeBook(book: FilmBook<Shot>, today: string, lat?: number | null): Promise<File> {
  const surface = Skia.Surface.MakeOffscreen(BOOK_W, BOOK_H);
  if (!surface) throw new Error('offscreen surface unavailable');
  const c = surface.getCanvas();
  const paint = (color: string) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setAntiAlias(true);
    return p;
  };
  c.drawRect(Skia.XYWHRect(0, 0, BOOK_W, BOOK_H), paint('#0E0D0C'));
  const pool = Skia.Paint();
  pool.setShader(Skia.Shader.MakeRadialGradient({ x: BOOK_W / 2, y: 900 }, BOOK_W, [Skia.Color('rgba(255,154,60,0.08)'), Skia.Color('rgba(255,154,60,0)')], null, TileMode.Clamp));
  c.drawRect(Skia.XYWHRect(0, 0, BOOK_W, BOOK_H), pool);

  const kicker = matchFont({ fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold' });
  const title = await krFont('bold', 80);
  const sub = await krFont('regular', 30);
  const small = await krFont('regular', 22);
  const name = matchFont({ fontFamily: 'monospace', fontSize: 21, fontWeight: 'bold' });
  const big = matchFont({ fontFamily: 'monospace', fontSize: 40, fontWeight: 'bold' });
  // '지금' needs Hangul, which the matched monospace face lacks
  const bigKr = await krFont('bold', 34);
  const total = book.entries.length;
  c.drawText('ROLLCAM · FILM BOOK', 72, 236, paint('#FF9A3C'), kicker);
  title.draw(c, tr('필름 도감', 'Film book', 'フィルム図鑑'), 72, 326, paint('#F2ECE4'));
  const line = book.found === total ? tr(`${total}종을 모두 모았어요`, `All ${total} films collected`, `${total}種すべて集めました`) : tr(`${total}종 중 ${book.found}종 · 남은 필름 ${total - book.found}종`, `${book.found} of ${total} · ${total - book.found} still to come`, `${total}種中${book.found}種 · 残り${total - book.found}種`);
  sub.draw(c, line, 72, 380, paint('#8C847A'));

  const slots = bookSlots(total);
  for (let i = 0; i < total; i++) {
    const e = book.entries[i];
    const s = slots[i];
    const tint = FILM_TINT[e.film] ?? '#C9B79C';
    const coverR = Skia.RRectXY(Skia.XYWHRect(s.x, s.y, s.w, s.cover), 10, 10);
    const last = e.shots[e.shots.length - 1];
    let img: SkImage | null = null;
    if (last) {
      try {
        img = await loadImage(thumbUri(last.file));
      } catch {
        try {
          img = await loadImage(photoUri(last.file));
        } catch {}
      }
    }
    if (img) {
      c.save();
      c.clipRRect(coverR, ClipOp.Intersect, true);
      const k = Math.max(s.w / img.width(), s.cover / img.height());
      const sw = s.w / k;
      const sh = s.cover / k;
      c.drawImageRect(img, Skia.XYWHRect((img.width() - sw) / 2, (img.height() - sh) / 2, sw, sh), Skia.XYWHRect(s.x, s.y, s.w, s.cover), Skia.Paint());
      c.restore();
    } else {
      c.drawRRect(coverR, paint('#151311'));
      const dash = paint(tint);
      dash.setStyle(PaintStyle.Stroke);
      dash.setStrokeWidth(2.5);
      dash.setAlphaf(0.7);
      dash.setPathEffect(Skia.PathEffect.MakeDash([14, 10], 0));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(s.x + 2, s.y + 2, s.w - 4, s.cover - 4), 9, 9), dash);
      const wait = seasonWait(e.film, today, lat);
      const mark = wait ? (wait.open ? tr('지금', 'NOW', 'いま') : `D-${wait.days}`) : '?';
      const ink = paint(tint);
      ink.setAlphaf(0.8);
      const cy = s.y + s.cover / 2;
      if (wait?.open) bigKr.draw(c, mark, s.x + (s.w - bigKr.measureText(mark).width) / 2, cy + 13, ink);
      else {
        const f = wait ? name : big;
        c.drawText(mark, s.x + (s.w - f.measureText(mark).width) / 2, cy + (f === name ? 8 : 13), ink, f);
      }
    }
    // name band: tint chip and the film's name
    const by = s.y + s.cover + 34;
    const chip = paint(tint);
    if (!img) {
      chip.setStyle(PaintStyle.Stroke);
      chip.setStrokeWidth(2);
    }
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(s.x + 2, by - 15, 16, 16), 3, 3), chip);
    let label = FILM_NAMES[e.film];
    while (label.length > 3 && name.measureText(label).width > s.w - 30) label = `${label.slice(0, -2)}…`;
    c.drawText(label, s.x + 26, by, paint(img ? '#F2ECE4' : '#6A625A'), name);
  }

  const mark = tr('ROLLCAM · 필름은 날씨가 고릅니다', 'ROLLCAM · the weather picks the film', 'ROLLCAM · フィルムは天気が選ぶ');
  small.draw(c, mark, (BOOK_W - small.measureText(mark).width) / 2, BOOK_H - 150, paint('#8C847A'));

  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 92);
  const out = new File(Paths.cache, `book-${today}.jpg`);
  if (out.exists) out.delete();
  out.create();
  await out.write(bytes);
  return out;
}
