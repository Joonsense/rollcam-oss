// Small copies of the prints for the roll strip, the year covers and the
// cards. A month of 1600px prints decoded for 50px cells held ~300 MB on a
// test phone (docs/DEVICE-TEST.md #12); a 360px copy decodes in a fraction.
// Made lazily from the print the first time a screen needs it, kept in the
// cache dir (the OS may clear it; they are simply made again).

import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { loadImage } from './develop';
import { isAtLab, photoUri, rawPhotoUri } from './store';
import { THUMB_EDGE, thumbName, thumbSize } from './thumbSize';

const dir = () => {
  const d = new Directory(Paths.cache, 'thumbs');
  if (!d.exists) d.create({ intermediates: true });
  return d;
};

const thumbFile = (file: string) => new File(dir(), thumbName(file));

/** The small copy if it is there, else the print itself. */
export function thumbUri(file: string): string {
  if (isAtLab(file.slice(0, 10))) return photoUri(file);
  const t = thumbFile(file);
  return t.exists ? t.uri : photoUri(file);
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Makes the missing small copies, one at a time (low-end phones keep one
 * decoded print in memory). Resolves to how many were made; never throws.
 * Calls are chained so two screens asking at once don't race on a file.
 */
export function ensureThumbs(files: string[]): Promise<number> {
  const run = queue.then(async () => {
    let made = 0;
    for (const file of files) {
      try {
        const out = thumbFile(file);
        if (out.exists) continue;
        const img = await loadImage(rawPhotoUri(file));
        const { w, h } = thumbSize(img.width(), img.height(), THUMB_EDGE);
        const surface = Skia.Surface.MakeOffscreen(w, h);
        if (!surface) continue;
        const p = Skia.Paint();
        surface.getCanvas().drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(0, 0, w, h), p);
        surface.flush();
        const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 84);
        // write under a temp name first so a half-written file never shows
        const tmp = new File(dir(), `${thumbName(file)}.part`);
        if (tmp.exists) tmp.delete();
        tmp.create();
        await tmp.write(bytes);
        await tmp.move(out);
        made++;
      } catch {
        // that cell keeps showing the full print
      }
    }
    return made;
  });
  queue = run.catch(() => 0);
  return run;
}

/**
 * For a screen: re-renders once the missing small copies of `files` are made.
 * Returns a counter to put in deps / keys if the screen memoizes sources.
 */
export function useThumbs(files: string[]): number {
  const [made, setMade] = useState(0);
  const key = files.join('|');
  useEffect(() => {
    let live = true;
    ensureThumbs(key ? key.split('|') : []).then((n) => {
      if (live && n > 0) setMade((m) => m + n);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return made;
}
