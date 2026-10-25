// rollcam:// links, from the app icon shortcuts (plugins/withLauncher.js). Pure.

export type LinkTarget = 'camera' | 'roll' | 'book';

/** RollScreen focus prefix that opens the film book; a time suffix makes each tap a new focus. */
export const FILM_FOCUS = ':film:';

/** 'rollcam://book' -> 'book'; anything else (or no link) -> null. */
export function linkTarget(url: string | null | undefined): LinkTarget | null {
  const m = url?.match(/^rollcam:\/\/([a-z]+)\/?(?:[?#].*)?$/i);
  const t = m?.[1].toLowerCase();
  return t === 'camera' || t === 'roll' || t === 'book' ? t : null;
}
