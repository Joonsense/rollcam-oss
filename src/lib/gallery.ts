// "갤러리에도 저장": each print also goes to the phone's Pictures/ROLLCAM album,
// where Google Photos (or whatever backs up the gallery) picks it up, so the
// roll stops living only on this phone. Off by default; the photos dir stays
// the roll's own copy. Pure; the copying is galleryCopy.ts.

import { FILM_NAMES, type FilmId } from './film.ts';
import { tr } from './i18n.ts';

/** 'ROLLCAM_2026-10-25_RainyMono.jpg': sorts by date in any gallery. */
export const galleryName = (s: { day: string; film: FilmId }) => `ROLLCAM_${s.day}_${(FILM_NAMES[s.film] ?? 'Film').replace(/[^A-Za-z0-9]+/g, '')}.jpg`;

/**
 * The prints still to copy, oldest first: every day not yet in the album.
 * Marks are per day, so a roll restored from a zip (older days) still gets
 * copied, and turning the setting off and on never copies a day twice.
 */
export const galleryPending = <T extends { day: string; takenAt: number }>(shots: T[], copied: Set<string>) => shots.filter((s) => !copied.has(s.day)).sort((a, b) => a.takenAt - b.takenAt);

/** The settings row note, with the copy's progress while it runs. */
export function galleryNote(on: boolean, progress: { done: number; total: number } | null, failed: number): string {
  if (on && failed) return tr(`갤러리에 넣지 못한 사진 ${failed}장 · 다시 켜면 그 사진만 다시 넣어요`, `${failed} ${failed === 1 ? "photo didn't" : "photos didn't"} make it to the gallery · turn it off and on to retry them`, `ギャラリーに入らなかった写真 ${failed}枚 · もう一度オンにするとその写真だけ入れ直します`);
  if (on && progress && progress.done < progress.total) return tr(`지금까지 찍은 사진 넣는 중 · ${progress.done}/${progress.total}`, `Adding your roll so far · ${progress.done}/${progress.total}`, `これまでの写真を追加中 · ${progress.done}/${progress.total}`);
  return on
    ? tr('사진 앱의 ROLLCAM 앨범에도 남아요 · 갤러리 백업이 켜져 있으면 롤도 함께 지켜져요', 'Prints also land in the ROLLCAM album · if your gallery backs up, so does your roll', '写真アプリの ROLLCAM アルバムにも残ります · ギャラリーのバックアップがオンならロールも守られます')
    : tr('찍은 사진을 사진 앱의 ROLLCAM 앨범에도 남겨요', 'Also keep each print in the ROLLCAM album of your gallery', '撮った写真を写真アプリの ROLLCAM アルバムにも残します');
}
