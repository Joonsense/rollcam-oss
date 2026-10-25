// Copies prints into Pictures/ROLLCAM through the local module
// modules/rollcam-gallery (MediaStore, Android 10+, no permission). kv
// `gallery` is the switch; `gallery:<day>` marks a day already in the album.

import { requireOptionalNativeModule } from 'expo';
import { galleryName, galleryPending } from './gallery';
import { allShots, getSetting, isAtLab, rawPhotoUri, setSetting, settingsWith } from './store';

type GalleryModule = { supported: boolean; save(path: string, name: string, takenAt: number): Promise<string> };
const native = requireOptionalNativeModule<GalleryModule>('RollcamGallery');

/** Android 10+ with the module built in; elsewhere the setting row is hidden. */
export const gallerySupported = () => !!native?.supported;
export const galleryOn = () => gallerySupported() && getSetting('gallery', '0') === '1';

export type GalleryState = { done: number; total: number; failed: number; running: boolean };
let state: GalleryState = { done: 0, total: 0, failed: 0, running: false };
const listeners = new Set<(s: GalleryState) => void>();
const emit = (next: Partial<GalleryState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
};
/** Settings follows a copy whoever started it (a shot, a restore, the switch). */
export function onGallery(l: (s: GalleryState) => void): () => void {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

let running = false;
let again = false;

/**
 * Copies every print whose day isn't in the album yet, oldest first. One run
 * at a time: a call during a run (a new shot, a restore) makes it go round
 * once more at the end. A print that fails is skipped and counted, and
 * tried again on the next run (the next shot, or the switch going round).
 */
export async function syncGallery(): Promise<void> {
  if (!native || !galleryOn()) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  let failed = 0;
  try {
    do {
      again = false;
      failed = 0;
      const copied = new Set(settingsWith('gallery:').map((r) => r.k.slice('gallery:'.length)));
      // a print still at the lab ("아침에 현상") goes in on the first run after 7
      const todo = galleryPending(allShots(), copied).filter((x) => !isAtLab(x.day));
      emit({ done: 0, total: todo.length, failed, running: true });
      for (let i = 0; i < todo.length; i++) {
        if (!galleryOn()) return; // switched off mid-way
        const s = todo[i];
        try {
          await native.save(rawPhotoUri(s.file), galleryName(s), s.takenAt);
          setSetting(`gallery:${s.day}`, '1');
        } catch {
          failed++;
        }
        emit({ done: i + 1, failed });
      }
    } while (again);
  } finally {
    running = false;
    again = false;
    emit({ running: false, failed });
  }
}
