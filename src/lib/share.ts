// "This month's roll" as one image (spec §5.3): a contact sheet of the 36-frame
// strip on darkroom black, for sharing to SNS. Drawn with the same Skia
// offscreen path as developing, so it works offline and needs no server.

import { BlurStyle, ClipOp, ImageFormat, PaintStyle, Skia, TileMode, matchFont, type SkCanvas, type SkImage, type SkSurface } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { monthStrip } from './strip';
import { photoUri, type Shot } from './store';
import { skyColor, weatherLine, type DaySky } from './sky';
import { loadImage } from './develop';
import { krFont } from './fonts';
import { monthStats, statsLine, weatherSentence, type RecapFact, type YearSummary } from './stats';
import { FILM_NAMES } from './film';
import { SMOOTH_FROM, tempYear } from './tempYear';
import { isLucky } from './lucky';
import { drawSparkle } from './sparkle';
import { count as unitCount, monthLong, monthShort, quote, tr, whyText } from './i18n';
import { diaryPick, diaryScale, fitLine, memoLines, wrapLine } from './memo';
import { FILM_TINT } from '../ui/theme';

const W = 1080;
// Korean text uses the bundled RollcamSans (fonts.ts); Skia's system font
// match has no Hangul. Mono stays the system face for the Latin kicker.
const LINE_H = 46;
const COLS = 6;
const PAD = 54;
const GAP = 12;
const CELL = Math.floor((W - PAD * 2 - 24 - GAP * (COLS - 1)) / COLS);
const CELL_H = Math.round(CELL * 1.32);
const ROW_H = CELL_H + 34; // frame + sprocket band

function drawCover(canvas: SkCanvas, img: SkImage, x: number, y: number, w: number, h: number) {
  const iw = img.width();
  const ih = img.height();
  const k = Math.max(w / iw, h / ih);
  const sw = w / k;
  const sh = h / k;
  canvas.drawImageRect(img, Skia.XYWHRect((iw - sw) / 2, (ih - sh) / 2, sw, sh), Skia.XYWHRect(x, y, w, h), Skia.Paint());
}

export async function composeRoll(month: string, shots: Shot[], sky: Record<string, DaySky>, today: string): Promise<File> {
  const byDay = new Map(shots.map((s) => [s.day, s]));
  const frames = monthStrip(month, new Set(byDay.keys()), today);
  const rows = frames.length / COLS;
  const st = monthStats(month, shots, today);
  const lines = [statsLine(st), weatherSentence(st)].filter(Boolean);
  const head = 150 + (lines.length ? 24 + lines.length * LINE_H + 22 : 0);
  const H = PAD + head + rows * ROW_H + 34 + 120;
  const surface = Skia.Surface.MakeOffscreen(W, H);
  if (!surface) throw new Error('offscreen surface unavailable');
  const c = surface.getCanvas();
  const paint = (color: string) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    return p;
  };

  c.drawRect(Skia.XYWHRect(0, 0, W, H), paint('#0E0D0C'));
  const [y, m] = month.split('-');
  const kicker = matchFont({ fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold' });
  const title = await krFont('bold', 88);
  const body = await krFont('regular', 30);
  const small = await krFont('regular', 24);
  c.drawText(`ROLL ${y}`, PAD, PAD + 30, paint('#FF9A3C'), kicker);
  title.draw(c, monthLong(Number(m)), PAD, PAD + 118, paint('#F2ECE4'));
  const count = tr(`${shots.length} / ${frames.filter((f) => f.kind === 'day').length}장`, `${shots.length} / ${frames.filter((f) => f.kind === 'day').length}`, `${shots.length} / ${frames.filter((f) => f.kind === 'day').length}枚`);
  body.draw(c, count, W - PAD - body.measureText(count).width, PAD + 118, paint('#8C847A'));
  lines.forEach((l, i) => body.draw(c, l, PAD, PAD + 150 + 24 + LINE_H * (i + 1) - 14, paint('#B5ACA1')));

  // film base
  const top = PAD + head;
  const stripRect = Skia.RRectXY(Skia.XYWHRect(PAD, top, W - PAD * 2, rows * ROW_H + 34), 14, 14);
  // amber film base with edge printing, same as the roll screen
  c.drawRRect(stripRect, paint('#1C130C'));
  const rim = paint('#3A2717');
  rim.setStyle(PaintStyle.Stroke);
  rim.setStrokeWidth(2);
  c.drawRRect(stripRect, rim);
  const edgeFont = matchFont({ fontFamily: 'monospace', fontSize: 17, fontWeight: 'bold' });
  const edgeInk = paint('rgba(255,154,60,0.7)');
  const holeRim = paint('#4A3220');
  holeRim.setStyle(PaintStyle.Stroke);
  holeRim.setStrokeWidth(1.5);
  // perforations, leaving room for the stock code (left) and frame number (right)
  const holes = (yy: number, label?: string, frame?: number) => {
    const n = COLS * 2;
    const step = (W - PAD * 2) / n;
    for (let i = 0; i < n; i++) {
      if ((label && i < 3) || (frame && i === n - 1)) continue;
      const h = Skia.RRectXY(Skia.XYWHRect(PAD + step * i + step / 2 - 11, yy + 9, 22, 14), 4, 4);
      c.drawRRect(h, paint('#0E0D0C'));
      c.drawRRect(h, holeRim);
    }
    if (label) c.drawText(label, PAD + 18, yy + 22, edgeInk, edgeFont);
    if (frame) {
      // ▸ isn't in the system monospace face, so the arrow is a path
      const t = String(frame);
      const tx = W - PAD - 18 - edgeFont.measureText(t).width;
      c.drawText(t, tx, yy + 22, edgeInk, edgeFont);
      c.drawPath(
        Skia.Path.Polygon(
          [
            { x: tx - 18, y: yy + 10 },
            { x: tx - 8, y: yy + 16 },
            { x: tx - 18, y: yy + 22 },
          ],
          true,
        ),
        edgeInk,
      );
    }
  };
  const dayFont = matchFont({ fontFamily: 'monospace', fontSize: 26 });

  // decode photos up front (sequential keeps memory flat on low-end phones)
  const imgs = new Map<string, SkImage>();
  for (const s of shots) {
    try {
      imgs.set(s.day, await loadImage(photoUri(s.file)));
    } catch {}
  }

  for (let r = 0; r < rows; r++) {
    const ry = top + r * ROW_H;
    holes(ry, r % 2 === 0 ? 'ROLLCAM 400' : undefined, r * COLS + 1);
    for (let i = 0; i < COLS; i++) {
      const f = frames[r * COLS + i];
      const x = PAD + 12 + i * (CELL + GAP);
      const fy = ry + 34;
      const rr = Skia.RRectXY(Skia.XYWHRect(x, fy, CELL, CELL_H), 6, 6);
      if (f.kind === 'leader') {
        c.drawRRect(rr, paint('#2E1C10'));
        continue;
      }
      const img = imgs.get(f.day);
      if (img) {
        c.save();
        c.clipRRect(rr, ClipOp.Intersect, true);
        drawCover(c, img, x, fy, CELL, CELL_H);
        c.restore();
        const shot = byDay.get(f.day);
        if (shot && isLucky(shot.takenAt)) drawSparkle(c, x + CELL - 14, fy + 14, 9, paint('#FFC86B'));
      } else {
        const s = sky[f.day];
        const onSky = f.state === 'missed' || f.state === 'today';
        c.drawRRect(rr, paint(onSky ? skyColor(s?.code, s?.tempMax) : '#1A1816'));
        const d = String(Number(f.day.slice(8)));
        c.drawText(d, x + (CELL - dayFont.measureText(d).width) / 2, fy + CELL_H / 2 + 9, paint(onSky ? 'rgba(14,13,12,0.55)' : '#4A443E'), dayFont);
      }
    }
  }
  holes(top + rows * ROW_H);

  // footer: subtle glow line + wordmark
  const glow = Skia.Paint();
  glow.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: W, y: 0 }, [Skia.Color('rgba(255,154,60,0)'), Skia.Color('rgba(255,154,60,0.6)'), Skia.Color('rgba(255,154,60,0)')], null, TileMode.Clamp));
  c.drawRect(Skia.XYWHRect(PAD, H - 96, W - PAD * 2, 2), glow);
  const mark = tr('ROLLCAM · 하루 한 장, 필름은 날씨가 고릅니다', 'ROLLCAM · One photo a day, the weather picks the film', 'ROLLCAM · 一日一枚、フィルムは天気が選ぶ');
  small.draw(c, mark, (W - small.measureText(mark).width) / 2, H - 50, paint('#8C847A'));

  return writeJpeg(surface, `roll-${month}.jpg`);
}

/** Resolves once the JPEG is on disk (expo-file-system 58: write() is async), so a share never sends half a file. */
async function writeJpeg(surface: SkSurface, name: string): Promise<File> {
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 92);
  const out = new File(Paths.cache, name);
  if (out.exists) out.delete();
  out.create();
  await out.write(bytes);
  return out;
}

/** The reason line minus the film name it repeats, in the current language: "비 오는 오후 — 'Rainy Mono'" -> "비 오는 오후". */
export const reasonOnly = whyText;

// One print for sharing: 4:5 (Instagram feed), the developed photo on paper
// lying on the darkroom table, with the film, the day and why it loaded.
const PW = 1080;
const BORDER = 30;
const CAPTION = 168;
const MEMO_H = 46; // the day's one line, when there is one

export type PrintFormat = 'feed' | 'story';

/** `feed` is 4:5 for a post; `story` is 9:16 with the print kept clear of the story UI bands. */
export async function composePrint(shot: Shot, format: PrintFormat = 'feed'): Promise<File> {
  const PH = format === 'story' ? 1920 : 1350;
  const img = await loadImage(photoUri(shot.file));
  const surface = Skia.Surface.MakeOffscreen(PW, PH);
  if (!surface) throw new Error('offscreen surface unavailable');
  const c = surface.getCanvas();
  const paint = (color: string) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    return p;
  };

  // table: darkroom black with a faint safelight pool up top
  c.drawRect(Skia.XYWHRect(0, 0, PW, PH), paint('#0E0D0C'));
  const pool = Skia.Paint();
  pool.setShader(Skia.Shader.MakeRadialGradient({ x: PW / 2, y: PH * 0.3 }, PW * 0.85, [Skia.Color('rgba(255,154,60,0.10)'), Skia.Color('rgba(255,154,60,0)')], null, TileMode.Clamp));
  c.drawRect(Skia.XYWHRect(0, 0, PW, PH), pool);

  // print size: as large as fits, keeping the photo's own aspect
  const maxPaperH = format === 'story' ? 1240 : PH - 150;
  const caption = CAPTION + (shot.memo ? MEMO_H : 0);
  const photoW = Math.min(PW - 150 - BORDER * 2, ((maxPaperH - BORDER - caption) * img.width()) / img.height());
  const photoH = (photoW * img.height()) / img.width();
  const paperW = photoW + BORDER * 2;
  const paperH = photoH + BORDER + caption;
  const x = (PW - paperW) / 2;
  const y = (PH - paperH) / 2 - (format === 'story' ? 30 : 14);

  c.save();
  c.rotate(-1.4, PW / 2, PH / 2);
  const shadow = paint('rgba(0,0,0,0.75)');
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 26, true));
  c.drawRect(Skia.XYWHRect(x + 6, y + 22, paperW, paperH), shadow);
  c.drawRect(Skia.XYWHRect(x, y, paperW, paperH), paint('#F4EFE6'));
  c.drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(x + BORDER, y + BORDER, photoW, photoH), Skia.Paint());

  const mono = matchFont({ fontFamily: 'monospace', fontSize: 34, fontWeight: 'bold' });
  const small = matchFont({ fontFamily: 'monospace', fontSize: 22 });
  const body = await krFont('regular', 27);
  const fine = await krFont('regular', 22);
  const cy = y + BORDER + photoH;
  const left = x + BORDER;
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(left, cy + 42, 22, 22), 4, 4), paint(FILM_TINT[shot.film] ?? '#C9B79C'));
  c.drawText(FILM_NAMES[shot.film], left + 36, cy + 63, paint('#2A2420'), mono);
  const date = shot.day.replaceAll('-', '.');
  c.drawText(date, x + paperW - BORDER - small.measureText(date).width, cy + 62, paint('#9A8E80'), small);
  // a lucky frame (lib/lucky.ts) says so on the paper, above the date
  if (isLucky(shot.takenAt)) {
    const word = 'LUCKY CUT';
    const lx = x + paperW - BORDER - small.measureText(word).width;
    c.drawText(word, lx, cy + 30, paint('#D9822B'), small);
    drawSparkle(c, lx - 16, cy + 23, 9, paint('#FF9A3C'));
  }
  // the memo reads first, in ink; the lab's lines follow it
  let ly = cy + 108;
  if (shot.memo) {
    const hand = await krFont('bold', 29);
    const line = fitLine(quote(shot.memo), paperW - BORDER * 2, (ch) => hand.has(ch), (t) => hand.measureText(t).width);
    if (line) hand.draw(c, line, left, ly, paint('#2A2420'));
    ly += MEMO_H;
  }
  body.draw(c, reasonOnly(shot.reason), left, ly, paint('#5A4E42'));
  const wx = weatherLine(shot.weather);
  if (wx) fine.draw(c, wx, left, ly + 38, paint('#9A8E80'));
  c.restore();

  const mark = 'ROLLCAM';
  const markFont = matchFont({ fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold' });
  if (format === 'story') {
    // above and below the print, inside the story's safe area
    const kick = matchFont({ fontFamily: 'monospace', fontSize: 30, fontWeight: 'bold' });
    const no = `No. ${shot.day.slice(8)}`; // № has no glyph in the matched monospace face
    c.drawText(no, (PW - kick.measureText(no).width) / 2, y - 70, paint('#FF9A3C'), kick);
    const line = tr('하루 한 장, 필름은 날씨가 고릅니다', 'One photo a day, the weather picks the film', '一日一枚、フィルムは天気が選ぶ');
    const lf = await krFont('regular', 30);
    lf.draw(c, line, (PW - lf.measureText(line).width) / 2, y + paperH + 110, paint('#8C847A'));
    c.drawText(mark, (PW - markFont.measureText(mark).width) / 2, y + paperH + 160, paint('rgba(255,154,60,0.55)'), markFont);
  } else {
    c.drawText(mark, (PW - markFont.measureText(mark).width) / 2, PH - 34, paint('rgba(255,154,60,0.55)'), markFont);
  }

  return writeJpeg(surface, `print-${shot.day}-${format}.jpg`);
}

// "올해의 롤": the year on one 9:16 card for stories. Twelve month covers, a
// dot per day in the film's color, then the year's facts. Kept inside the
// story's safe area (top and bottom ~200px stay quiet).
const YW = 1080;
const YH = 1920;

export async function composeYear(y: YearSummary<Shot>, facts: RecapFact[], shots: Shot[] = []): Promise<File> {
  const surface = Skia.Surface.MakeOffscreen(YW, YH);
  if (!surface) throw new Error('offscreen surface unavailable');
  const c = surface.getCanvas();
  const paint = (color: string) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    return p;
  };
  c.drawRect(Skia.XYWHRect(0, 0, YW, YH), paint('#0E0D0C'));
  const pool = Skia.Paint();
  pool.setShader(Skia.Shader.MakeRadialGradient({ x: YW / 2, y: 700 }, YW, [Skia.Color('rgba(255,154,60,0.09)'), Skia.Color('rgba(255,154,60,0)')], null, TileMode.Clamp));
  c.drawRect(Skia.XYWHRect(0, 0, YW, YH), pool);

  const X = 72;
  const kicker = matchFont({ fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold' });
  const title = await krFont('bold', 84);
  const sub = await krFont('regular', 32);
  const label = await krFont('regular', 26);
  const value = await krFont('bold', 34);
  const small = await krFont('regular', 22);
  c.drawText(`ROLLCAM · ${y.year}`, X, 236, paint('#FF9A3C'), kicker);
  title.draw(c, tr('올해의 롤', 'My year in a roll', '今年のロール'), X, 330, paint('#F2ECE4'));
  sub.draw(c, tr(`${y.days}일 중 ${y.shots}장을 찍었어요`, `${y.shots} photos in ${y.days} days`, `${y.days}日中${y.shots}枚撮りました`), X, 388, paint('#8C847A'));

  // twelve month covers, 4 x 3
  const GAP = 14;
  const CW = (YW - X * 2 - GAP * 3) / 4;
  const CH = Math.round(CW * 0.86);
  const top = 432;
  const monthFont = matchFont({ fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold' });
  for (let i = 0; i < 12; i++) {
    const mo = y.months[i];
    const x = X + (i % 4) * (CW + GAP);
    const yy = top + Math.floor(i / 4) * (CH + GAP);
    const rr = Skia.RRectXY(Skia.XYWHRect(x, yy, CW, CH), 8, 8);
    let drawn = false;
    if (mo.cover) {
      try {
        const img = await loadImage(photoUri(mo.cover.file));
        c.save();
        c.clipRRect(rr, ClipOp.Intersect, true);
        drawCover(c, img, x, yy, CW, CH);
        // a little shade so the month reads on any photo
        const shade = Skia.Paint();
        shade.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: yy + CH - 70 }, { x: 0, y: yy + CH }, [Skia.Color('rgba(0,0,0,0)'), Skia.Color('rgba(0,0,0,0.55)')], null, TileMode.Clamp));
        c.drawRect(Skia.XYWHRect(x, yy + CH - 70, CW, 70), shade);
        c.restore();
        drawn = true;
      } catch {}
    }
    if (!drawn) c.drawRRect(rr, paint(mo.days > 0 ? '#1C130C' : '#151311'));
    const name = monthShort(i + 1);
    const ink = mo.cover ? '#F2ECE4' : mo.days > 0 ? 'rgba(255,154,60,0.5)' : '#3A3530';
    small.draw(c, name, x + 14, yy + CH - 16, paint(ink));
    if (mo.shots) {
      const n = String(mo.shots);
      c.drawText(n, x + CW - 14 - monthFont.measureText(n).width, yy + CH - 16, paint('#F2ECE4'), monthFont);
    }
  }

  // a dot per day, 12 rows: the film's color on shot days
  const dotTop = top + 3 * (CH + GAP) + 40;
  const step = (YW - X * 2 - 44) / 31;
  const r = Math.min(9, step * 0.32);
  const tiny = matchFont({ fontFamily: 'monospace', fontSize: 15 });
  for (let i = 0; i < 12; i++) {
    const ry = dotTop + i * (r * 2 + 8);
    c.drawText(String(i + 1).padStart(2, '0'), X, ry + r + 5, paint('#4A443E'), tiny);
    y.months[i].dots.forEach((d, j) => {
      const cx = X + 44 + j * step + step / 2;
      const color = d.state === 'shot' ? (d.film ? FILM_TINT[d.film] ?? '#FF9A3C' : '#FF9A3C') : d.state === 'future' ? '#1A1816' : '#2A2622';
      c.drawCircle(cx, ry + r, r, paint(color));
    });
  }

  // the year in degrees: one line through each photo's temperature (a week's average once busy), dots in film tints
  let below = dotTop + 12 * (r * 2 + 8);
  const temps = tempYear(y.year, shots, YW - X * 2, 56, 4);
  if (temps) {
    const ty = below + 26;
    const b = Skia.PathBuilder.Make();
    // a busy year (TempLine's rule): small faint dots, the week's average drawn over them
    const busy = temps.points.length > SMOOTH_FROM;
    temps.line.forEach((p, i) => (i ? b.lineTo(X + p.x, ty + p.y) : b.moveTo(X + p.x, ty + p.y)));
    for (const p of temps.points) {
      const dot = paint(FILM_TINT[p.film] ?? '#F2ECE4');
      if (busy) dot.setAlphaf(0.55);
      c.drawCircle(X + p.x, ty + p.y, busy ? 2.2 : 3.5, dot);
    }
    const line = paint(busy ? 'rgba(242,236,228,0.8)' : 'rgba(242,236,228,0.3)');
    line.setStyle(PaintStyle.Stroke);
    line.setStrokeWidth(busy ? 2.5 : 2);
    c.drawPath(b.build(), line);
    below = ty + 56;
  }

  // facts, two columns
  const factTop = below + 50;
  facts.slice(0, 4).forEach((f, i) => {
    const fx = X + (i % 2) * ((YW - X * 2) / 2);
    const fy = factTop + Math.floor(i / 2) * 104;
    label.draw(c, f.label, fx, fy, paint('#8C847A'));
    value.draw(c, f.value, fx, fy + 46, paint('#F2ECE4'));
  });

  const mark = tr('ROLLCAM · 하루 한 장, 필름은 날씨가 고릅니다', 'ROLLCAM · One photo a day, the weather picks the film', 'ROLLCAM · 一日一枚、フィルムは天気が選ぶ');
  small.draw(c, mark, (YW - small.measureText(mark).width) / 2, YH - 150, paint('#8C847A'));
  return writeJpeg(surface, `year-${y.year}.jpg`);
}

// "이 달의 한 줄": the month's memos as one 9:16 story card, a small print
// beside each line. Longer months show an even spread of their lines.
const DIARY_MAX = 8;

export async function composeDiary(month: string, shots: Shot[]): Promise<File> {
  const all = memoLines(shots);
  if (!all.length) throw new Error(tr('이 달엔 남긴 한 줄이 없어요', 'No lines kept this month', 'この月は一行がありません'));
  const picked = diaryPick(all, DIARY_MAX);
  const surface = Skia.Surface.MakeOffscreen(YW, YH);
  if (!surface) throw new Error('offscreen surface unavailable');
  const c = surface.getCanvas();
  const paint = (color: string) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    return p;
  };
  c.drawRect(Skia.XYWHRect(0, 0, YW, YH), paint('#0E0D0C'));
  const pool = Skia.Paint();
  pool.setShader(Skia.Shader.MakeRadialGradient({ x: YW / 2, y: 520 }, YW, [Skia.Color('rgba(255,154,60,0.08)'), Skia.Color('rgba(255,154,60,0)')], null, TileMode.Clamp));
  c.drawRect(Skia.XYWHRect(0, 0, YW, YH), pool);

  const X = 72;
  const [y, m] = month.split('-');
  const kicker = matchFont({ fontFamily: 'monospace', fontSize: 26, fontWeight: 'bold' });
  const title = await krFont('bold', 76);
  const sub = await krFont('regular', 30);
  const { k, rows: maxRows } = diaryScale(picked.length);
  const kt = Math.min(k, 1.4); // words grow less than prints
  const hand = await krFont('bold', Math.round(33 * kt));
  const small = await krFont('regular', 22);
  const dateFont = matchFont({ fontFamily: 'monospace', fontSize: Math.round(22 * kt), fontWeight: 'bold' });
  const filmFont = matchFont({ fontFamily: 'monospace', fontSize: Math.round(20 * kt) });
  c.drawText(`ROLL ${y}`, X, 248, paint('#FF9A3C'), kicker);
  title.draw(c, tr(`${Number(m)}월의 한 줄`, `${monthLong(Number(m))} in lines`, `${Number(m)}月の一行`), X, 336, paint('#F2ECE4'));
  sub.draw(c, tr(`${shots.length}장 중 한 줄 ${all.length}개`, `${unitCount(all.length, '', 'line')} from ${unitCount(shots.length, '', 'photo')}`, `${shots.length}枚中、一行は${all.length}つ`), X, 390, paint('#8C847A'));

  const has = (ch: string) => hand.has(ch);
  const measure = (t: string) => hand.measureText(t).width;
  const TW = Math.round(96 * k);
  const TH = Math.round(120 * k);
  const textX = X + TW + 34;
  const textW = YW - textX - X;
  const lineH = Math.round(42 * kt);
  const textTop = Math.round(72 * kt);
  const blocks = picked.map((l) => {
    const rows = wrapLine(quote(fitLine(l.memo, Infinity, has, measure)), textW, measure, maxRows);
    return { l, rows, h: Math.max(TH + 34, textTop + (rows.length - 1) * lineH + 34) };
  });
  const more = all.length > picked.length ? tr(`그 밖에 한 줄 ${all.length - picked.length}개`, `and ${unitCount(all.length - picked.length, '', 'more line')}`, `ほかに一行${all.length - picked.length}つ`) : '';
  // a full month lists from under the title; a few lines sit in the middle of the card
  const listTop = 452;
  const listBottom = YH - 230;
  const total = blocks.reduce((a, b) => a + b.h, 0) + (more ? 40 : 0);
  let top = listTop + Math.max(0, Math.floor((listBottom - listTop - total) / 2));
  for (const { l, rows, h } of blocks) {
    const shot = shots[l.index];
    // a small print: paper border, the photo, a slight tilt per day
    c.save();
    c.rotate(Number(l.day.slice(8)) % 2 ? -2 : 1.5, X + TW / 2, top + TH / 2);
    c.drawRect(Skia.XYWHRect(X - 6, top - 6, TW + 12, TH + 22), paint('#F4EFE6'));
    try {
      drawCover(c, await loadImage(photoUri(shot.file)), X, top, TW, TH);
    } catch {
      c.drawRect(Skia.XYWHRect(X, top, TW, TH), paint('#1A1816'));
    }
    c.restore();
    const date = l.day.slice(5).replace('-', '.');
    c.drawText(date, textX, top + Math.round(24 * kt), paint('#FF9A3C'), dateFont);
    const fx = textX + dateFont.measureText(date).width + 18;
    const chip = Math.round(16 * kt);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(fx, top + Math.round(8 * kt), chip, chip), 3, 3), paint(FILM_TINT[shot.film] ?? '#C9B79C'));
    c.drawText(FILM_NAMES[shot.film], fx + chip + 10, top + Math.round(23 * kt), paint('#8C847A'), filmFont);
    rows.forEach((r, i) => hand.draw(c, r, textX, top + textTop + i * lineH, paint('#F2ECE4')));
    top += h;
  }
  if (more) small.draw(c, more, textX, top + 8, paint('#8C847A'));

  const mark = tr('ROLLCAM · 하루 한 장, 한 줄', 'ROLLCAM · One photo, one line a day', 'ROLLCAM · 一日一枚、一行');
  small.draw(c, mark, (YW - small.measureText(mark).width) / 2, YH - 150, paint('#8C847A'));
  return writeJpeg(surface, `diary-${month}.jpg`);
}

export async function shareRoll(file: File): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(tr('공유를 쓸 수 없는 기기예요', "Sharing isn't available on this phone", 'この端末では共有できません'));
  await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', dialogTitle: tr('이번 달 롤 공유', "Share this month's roll", '今月のロールを共有') });
}

/** One developed photo as a print (composePrint); the bare JPEG if composing fails. */
export async function sharePhoto(shot: Shot, format: PrintFormat = 'feed'): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(tr('공유를 쓸 수 없는 기기예요', "Sharing isn't available on this phone", 'この端末では共有できません'));
  let uri = photoUri(shot.file);
  try {
    uri = (await composePrint(shot, format)).uri;
  } catch {}
  await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: tr('오늘의 한 장 공유', "Share today's photo", '今日の一枚を共有') });
}
