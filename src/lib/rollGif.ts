// "롤 GIF": the month's prints as an endlessly looping GIF, each frame a small
// print on paper with its frame number and film, for chats and X, where a
// moving picture travels. Frames are drawn with Skia, encoded by gif.ts.

import { AlphaType, ColorType, Skia, matchFont } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { loadImage } from './develop';
import { FILM_NAMES } from './film';
import { isLucky } from './lucky';
import { drawSparkle } from './sparkle';
import { encodeGif, toIndices } from './gif';
import { tr } from './i18n';
import { SPEEDS } from './playback';
import { photoUri, type Shot } from './store';
import { thumbUri } from './thumbs';
import { FILM_TINT } from '../ui/theme';

const W = 280;
const H = 380;
const PAD = 12;
const FOOT = 40;

type GifFrame = { shot: Shot; label: string };

/** Up to 31 frames; `speed` is the player's speed index. `progress` gets 0..1 as frames are drawn. */
export function composeRollGif(month: string, shots: Shot[], speed = 1, progress?: (p: number) => void): Promise<File> {
  if (!shots.length) throw new Error(tr('이 달엔 사진이 없어요', 'No photos this month', 'この月は写真がありません'));
  const frames = shots.map((s) => ({ shot: s, label: `No.${s.day.slice(8)}` }));
  return composeGif(frames, `ROLLCAM ${month.slice(2).replace('-', '.')}`, Math.round(SPEEDS[speed] / 10), `roll-${month}.gif`, progress);
}

/** A year's month covers, one frame a month (labels in ASCII: the matched monospace face has no Hangul). */
export function composeYearGif(year: number, covers: { month: string; cover: Shot | null }[], progress?: (p: number) => void): Promise<File> {
  const frames = covers.flatMap((m) => (m.cover ? [{ shot: m.cover, label: `${year}.${m.month.slice(5)}` }] : []));
  if (!frames.length) throw new Error(tr('이 해엔 사진이 없어요', 'No photos this year', 'この年は写真がありません'));
  return composeGif(frames, `ROLLCAM ${year}`, 70, `year-${year}.gif`, progress);
}

async function composeGif(list: GifFrame[], brand: string, delay: number, fileName: string, progress?: (p: number) => void): Promise<File> {
  const surface = Skia.Surface.MakeOffscreen(W, H);
  if (!surface) throw new Error('offscreen surface unavailable');
  const c = surface.getCanvas();
  const paint = (color: string) => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(color));
    p.setAntiAlias(true);
    return p;
  };
  const mono = matchFont({ fontFamily: 'monospace', fontSize: 15, fontWeight: 'bold' });
  const small = matchFont({ fontFamily: 'monospace', fontSize: 12 });
  const frames: Uint8Array[] = [];
  const pw = W - PAD * 2;
  const ph = H - PAD - FOOT;
  for (let i = 0; i < list.length; i++) {
    const s = list[i].shot;
    c.drawRect(Skia.XYWHRect(0, 0, W, H), paint('#F4EFE6'));
    try {
      let img;
      try {
        img = await loadImage(thumbUri(s.file));
      } catch {
        img = await loadImage(photoUri(s.file));
      }
      const k = Math.max(pw / img.width(), ph / img.height());
      const sw = pw / k;
      const sh = ph / k;
      c.drawImageRect(img, Skia.XYWHRect((img.width() - sw) / 2, (img.height() - sh) / 2, sw, sh), Skia.XYWHRect(PAD, PAD, pw, ph), Skia.Paint());
    } catch {
      c.drawRect(Skia.XYWHRect(PAD, PAD, pw, ph), paint('#1A1816'));
    }
    const y = H - FOOT / 2 + 5;
    if (isLucky(s.takenAt)) drawSparkle(c, W - PAD - 14, PAD + 14, 9, paint('#FFC86B'));
    const label = list[i].label;
    c.drawText(label, PAD, y, paint('#2A2420'), mono);
    const lx = PAD + mono.measureText(label).width + 10;
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(lx, y - 10, 10, 10), 2, 2), paint(FILM_TINT[s.film] ?? '#C9B79C'));
    const name = FILM_NAMES[s.film];
    c.drawText(name, lx + 16, y, paint('#5A4E42'), small);
    // the brand sits at the right unless a long film name needs the room
    const mark = brand;
    const mx = W - PAD - small.measureText(mark).width;
    if (mx > lx + 16 + small.measureText(name).width + 10) c.drawText(mark, mx, y, paint('rgba(200,84,30,0.8)'), small);
    surface.flush();
    const px = surface.makeImageSnapshot().readPixels(0, 0, { width: W, height: H, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    if (!px || !(px instanceof Uint8Array)) throw new Error('could not read frame');
    frames.push(toIndices(px, W, H));
    progress?.((i + 1) / list.length);
    // let the spinner breathe between frames
    await new Promise((r) => setTimeout(r, 0));
  }
  // the last frame holds a little longer before the loop starts again
  const gif = encodeGif(frames, W, H, frames.map((_, i) => (i === frames.length - 1 ? delay * 3 : delay)));
  const out = new File(Paths.cache, fileName);
  if (out.exists) out.delete();
  out.create();
  await out.write(gif);
  return out;
}

export async function shareRollGif(file: File): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(tr('공유를 쓸 수 없는 기기예요', "This phone can't share", 'この端末では共有できません'));
  await Sharing.shareAsync(file.uri, { mimeType: 'image/gif', dialogTitle: tr('롤 GIF 공유', 'Share roll GIF', 'ロールGIFを共有') });
}
