// Settings -> "가져오기": the zip that "내보내기" made (exportData.ts) back
// into the roll, e.g. on a new phone. Pure planning only; restoreZip in
// exportData.ts reads the zip and writes. A day the roll already has keeps
// this device's photo: one shot a day holds across a restore too.

import { FILM_NAMES, type FilmId, type Weather } from './film.ts';
import { CAPSULE_MAX } from './capsule.ts';
import { normalizeMemo } from './memo.ts';
import { tr } from './i18n.ts';
import type { Shot } from './store.ts';

export const MANIFEST = 'rollcam.json';
export const photoPath = (file: string) => `photos/${file}`;

export type RestorePlan = {
  /** shots to write, oldest first */
  add: Shot[];
  /** days the device already has */
  kept: number;
  /** rows that are malformed or whose photo is missing from the zip */
  broken: number;
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
// exported names are '<day>-<ms>.jpg'; anything with a path in it is refused
const FILE = /^[\w.-]+\.jpe?g$/i;

function realDay(day: unknown): day is string {
  if (typeof day !== 'string') return false;
  const m = day.match(DAY);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

function weatherOf(w: unknown): Weather | null {
  if (!w || typeof w !== 'object') return null;
  const o = w as Record<string, unknown>;
  const out: Weather = {};
  for (const k of ['code', 'cloud', 'tempC', 'windMs'] as const) if (typeof o[k] === 'number' && Number.isFinite(o[k])) out[k] = o[k];
  return Object.keys(out).length ? out : null;
}

/** One manifest row -> a Shot, or null when it can't be trusted. */
export function readShot(row: unknown): Shot | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (!realDay(r.day)) return null;
  if (typeof r.file !== 'string' || !FILE.test(r.file) || r.file.startsWith('.')) return null;
  if (typeof r.film !== 'string' || !(r.film in FILM_NAMES)) return null;
  if (typeof r.takenAt !== 'number' || !Number.isFinite(r.takenAt)) return null;
  return {
    day: r.day,
    file: r.file,
    film: r.film as FilmId,
    reason: typeof r.reason === 'string' ? r.reason : '',
    weather: weatherOf(r.weather),
    takenAt: r.takenAt,
    memo: typeof r.memo === 'string' ? normalizeMemo(r.memo) : '',
    capsule: typeof r.capsule === 'string' ? normalizeMemo(r.capsule, CAPSULE_MAX) : '',
  };
}

/** Throws a user-facing message when the zip isn't a ROLLCAM export. */
export function parseManifest(json: string): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error(tr('ROLLCAM 내보내기 파일이 아니에요', 'Not a ROLLCAM export file', 'ROLLCAMの書き出しファイルではありません'));
  }
  const shots = (data as { shots?: unknown } | null)?.shots;
  if (!Array.isArray(shots)) throw new Error(tr('ROLLCAM 내보내기 파일이 아니에요', 'Not a ROLLCAM export file', 'ROLLCAMの書き出しファイルではありません'));
  return shots;
}

/**
 * What a restore will do. `inZip` holds the zip's entry names, `has` says
 * whether the device already has a day. A day listed twice counts once.
 * Days after `today` are refused: a roll can't hold tomorrow.
 */
export function planRestore(rows: unknown[], inZip: Set<string>, has: (day: string) => boolean, today: string): RestorePlan {
  const add = new Map<string, Shot>();
  let kept = 0;
  let broken = 0;
  for (const row of rows) {
    const s = readShot(row);
    if (!s || s.day > today || !inZip.has(photoPath(s.file))) {
      broken++;
      continue;
    }
    if (has(s.day)) kept++;
    else if (!add.has(s.day)) add.set(s.day, s);
  }
  return { add: [...add.values()].sort((a, b) => a.day.localeCompare(b.day)), kept, broken };
}

/** The result line in Settings. */
export function restoreLine(p: Pick<RestorePlan, 'kept' | 'broken'>, added: number): string {
  const parts = [added ? tr(`${added}장을 롤에 되돌렸어요`, `${added} ${added === 1 ? 'photo' : 'photos'} back in your roll`, `${added}枚をロールに戻しました`) : tr('새로 더할 사진이 없어요', 'Nothing new to add', '新しく足す写真はありません')];
  if (p.kept) parts.push(tr(`이미 있는 날 ${p.kept}장은 이 기기 사진을 남겼어요`, `kept this phone's photo on ${p.kept} ${p.kept === 1 ? 'day' : 'days'} already shot`, `撮影済みの${p.kept}日はこの端末の写真を残しました`));
  if (p.broken) parts.push(tr(`읽지 못한 ${p.broken}장은 건너뛰었어요`, `skipped ${p.broken} unreadable`, `読めなかった${p.broken}枚はスキップしました`));
  return parts.join(' · ');
}

/** Picked month covers from an export ('YYYY-MM' -> 'YYYY-MM-DD'); anything malformed is dropped. */
export function parseCovers(json: string): Record<string, string> {
  let covers: unknown;
  try {
    covers = (JSON.parse(json) as { covers?: unknown } | null)?.covers;
  } catch {
    return {};
  }
  if (!covers || typeof covers !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [m, d] of Object.entries(covers as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}$/.test(m) && realDay(d) && d.startsWith(m)) out[m] = d;
  }
  return out;
}
