// "뒷면 공유": the back of a print as a 4:5 image, the lab stamp the photo
// viewer shows when a print is turned over: paper with its maker's line run
// diagonally, and the stamp's rows (film, date, sky, why, the line, roll,
// book, luck, run). Same rows as the screen (backRows.ts).

import { ImageFormat, PaintStyle, Skia, matchFont } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backRows } from './backRows';
import { krFont } from './fonts';
import { tr } from './i18n';
import { fitLine, wrapLine } from './memo';
import type { Shot } from './store';
import { FILM_TINT } from '../ui/theme';

const W = 1080;
const H = 1350;
const INK = '#8A5A3C';

export async function composeBack(shot: Shot, facts: { frame: number; book: { found: number; total: number }; run: number }): Promise<File> {
  const surface = Skia.Surface.MakeOffscreen(W, H);
  if (!surface) throw new Error('offscreen surface unavailable');
  const c = surface.getCanvas();
  const paint = (color: string) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setAntiAlias(true);
    return p;
  };
  c.drawRect(Skia.XYWHRect(0, 0, W, H), paint('#EDE6DA'));

  // the paper maker's line, faint and diagonal
  const wm = matchFont({ fontFamily: 'monospace', fontSize: 30 });
  const line = 'ROLLCAM PAPER · DAYLIGHT · ROLLCAM PAPER · DAYLIGHT · ROLLCAM PAPER · DAYLIGHT';
  c.save();
  c.rotate(-24, W / 2, H / 2);
  // the rotated rows must reach every corner: repeat the line across from well left to well right
  const lw = wm.measureText(line).width + 30;
  const faint = paint('rgba(138,90,60,0.08)');
  for (let y = -400; y < H + 400; y += 92) for (let x = -700; x < W + 500; x += lw) c.drawText(line, x, y, faint, wm);
  c.restore();

  // the stamp
  const rows = backRows(shot, facts.frame, facts.book, facts.run);
  const label = matchFont({ fontFamily: 'monospace', fontSize: 26 });
  const head = matchFont({ fontFamily: 'monospace', fontSize: 36, fontWeight: 'bold' });
  const value = await krFont('regular', 36);
  const BX = 120;
  const BW = W - BX * 2;
  const KEY_W = 130;
  const LINE = 50;
  // characters the share font lacks (emoji, another script) are left out rather than drawn as boxes
  const drawable = (v: string) => fitLine(v, Infinity, (ch) => value.has(ch), (t) => value.measureText(t).width);
  const lines = rows.map(([k, v]) => ({ k, v: wrapLine(drawable(v), BW - 72 - KEY_W - (k === 'FILM' ? 36 : 0), (t) => value.measureText(t).width, 2) }));
  const BH = 150 + lines.reduce((n, l) => n + Math.max(1, l.v.length) * LINE + 14, 0);
  const BY = (H - BH) / 2 - 20;
  c.save();
  c.rotate(-1.5, W / 2, H / 2);
  const ink = paint(INK);
  ink.setAlphaf(0.88);
  const box = paint(INK);
  box.setStyle(PaintStyle.Stroke);
  box.setStrokeWidth(4);
  box.setAlphaf(0.88);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(BX, BY, BW, BH), 10, 10), box);
  c.drawText('ROLLCAM LAB', BX + 36, BY + 70, ink, head);
  const no = `No. ${shot.day.slice(8)}`;
  c.drawText(no, BX + BW - 36 - head.measureText(no).width, BY + 70, ink, head);
  const rule = paint(INK);
  rule.setAlphaf(0.5);
  c.drawRect(Skia.XYWHRect(BX + 36, BY + 100, BW - 72, 2), rule);
  let y = BY + 160;
  const keyInk = paint(INK);
  keyInk.setAlphaf(0.7);
  for (const l of lines) {
    c.drawText(l.k, BX + 36, y, keyInk, label);
    let vx = BX + 36 + KEY_W;
    if (l.k === 'FILM') {
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(vx, y - 22, 22, 22), 4, 4), paint(FILM_TINT[shot.film] ?? '#C9B79C'));
      vx += 36;
    }
    l.v.forEach((t, i) => value.draw(c, t, vx, y + i * LINE, paint('#3A2A20')));
    y += Math.max(1, l.v.length) * LINE + 14;
  }
  c.restore();

  const foot = await krFont('regular', 26);
  const f = tr('이 사진은 이 기기에만 현상돼 있어요', 'This photo is developed on this phone only', 'この写真はこの端末でだけ現像されています');
  const fp = paint(INK);
  fp.setAlphaf(0.55);
  foot.draw(c, f, (W - foot.measureText(f).width) / 2, H - 80, fp);

  surface.flush();
  const out = new File(Paths.cache, `back-${shot.day}.jpg`);
  if (out.exists) out.delete();
  out.create();
  await out.write(surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 92));
  return out;
}

export async function shareBack(shot: Shot, facts: { frame: number; book: { found: number; total: number }; run: number }): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(tr('공유를 쓸 수 없는 기기예요', "This phone can't share", 'この端末では共有できません'));
  const file = await composeBack(shot, facts);
  await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', dialogTitle: tr('인화지 뒷면 공유', 'Share the back of the print', 'プリントの裏を共有') });
}
