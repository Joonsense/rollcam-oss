// Photos live only on the device (spec §2, §6): JPEGs in the app's document
// directory, one SQLite row per day. The day key is the primary key, which is
// what enforces "one shot a day" at the storage level.

import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import type { FilmId, Weather } from './film';
import { atLab, labDay, waitKey } from './lab';
import { labPaperUri } from './labPaper';

export type Shot = {
  day: string; // 'YYYY-MM-DD'
  file: string; // file name inside the photos dir
  film: FilmId;
  reason: string;
  weather: Weather | null;
  takenAt: number; // epoch ms
  /** "오늘의 한 줄" (lib/memo.ts), '' when none */
  memo: string;
  /** "1년 뒤의 나에게" (lib/capsule.ts), sealed until the same date next year; '' when none */
  capsule: string;
};

type Row = { day: string; file: string; film: string; reason: string; weather: string | null; taken_at: number; memo: string | null; capsule: string | null };

const db = SQLite.openDatabaseSync('rollcam.db');
db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS shots (
    day TEXT PRIMARY KEY NOT NULL,
    file TEXT NOT NULL,
    film TEXT NOT NULL,
    reason TEXT NOT NULL,
    weather TEXT,
    taken_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);
`);
// 0.3.8: the memo column, added in place on rolls from before it
const cols = db.getAllSync<{ name: string }>('PRAGMA table_info(shots)').map((c) => c.name);
if (!cols.includes('memo')) db.execSync('ALTER TABLE shots ADD COLUMN memo TEXT');
// 0.3.9: the time capsule line
if (!cols.includes('capsule')) db.execSync('ALTER TABLE shots ADD COLUMN capsule TEXT');

const photosDir = new Directory(Paths.document, 'photos');
if (!photosDir.exists) photosDir.create({ intermediates: true });

const toShot = (r: Row): Shot => ({
  day: r.day,
  file: r.file,
  film: r.film as FilmId,
  reason: r.reason,
  weather: r.weather ? (JSON.parse(r.weather) as Weather) : null,
  takenAt: r.taken_at,
  memo: r.memo ?? '',
  capsule: r.capsule ?? '',
});

/** The print file itself, even while it is at the lab: export, thumbnails, decoding for the gallery. */
export function rawPhotoUri(file: string): string {
  return new File(photosDir, file).uri;
}

/** Whether `day`'s print is still at the lab (lib/lab.ts): only today's or last night's can be. */
export function isAtLab(day: string, now = new Date()): boolean {
  return labDay(day, now) && atLab(day, now, getSetting(waitKey(day), '') === '1');
}

/** What screens and shares show for a print: the undeveloped paper while it is at the lab. */
export function photoUri(file: string): string {
  // file names start with the day (saveShot)
  return isAtLab(file.slice(0, 10)) ? labPaperUri() : rawPhotoUri(file);
}

export function getShot(day: string): Shot | null {
  const r = db.getFirstSync<Row>('SELECT * FROM shots WHERE day = ?', day);
  return r ? toShot(r) : null;
}

export function monthShots(month: string): Shot[] {
  return db.getAllSync<Row>('SELECT * FROM shots WHERE day LIKE ? ORDER BY day', `${month}-%`).map(toShot);
}

/** Year of the first photo, or null before the first one. */
export function firstShotYear(): number | null {
  const r = db.getFirstSync<{ day: string | null }>('SELECT MIN(day) AS day FROM shots');
  return r?.day ? Number(r.day.slice(0, 4)) : null;
}

export function yearShots(year: number): Shot[] {
  return db.getAllSync<Row>('SELECT * FROM shots WHERE day LIKE ? ORDER BY day', `${year}-%`).map(toShot);
}

export function allShots(): Shot[] {
  return db.getAllSync<Row>('SELECT * FROM shots ORDER BY day').map(toShot);
}

/** Writes the developed JPEG and its row. Throws if the day already has a shot. */
export function saveShot(s: Omit<Shot, 'file' | 'memo' | 'capsule'>, jpeg: Uint8Array): Shot {
  if (getShot(s.day)) throw new Error('already shot today');
  const file = `${s.day}-${s.takenAt}.jpg`;
  const f = new File(photosDir, file);
  f.create();
  // expo-file-system 58: write() is async; the row must not exist before the file does
  f.writeSync(jpeg);
  try {
    db.runSync(
      'INSERT INTO shots (day, file, film, reason, weather, taken_at) VALUES (?, ?, ?, ?, ?, ?)',
      s.day,
      file,
      s.film,
      s.reason,
      s.weather ? JSON.stringify(s.weather) : null,
      s.takenAt,
    );
  } catch (e) {
    f.delete();
    throw e;
  }
  return { ...s, file, memo: '', capsule: '' };
}

/** A shot from an export zip (lib/restore.ts), under its exported name. Returns false if the day is taken. */
export function restoreShot(s: Shot, jpeg: Uint8Array): boolean {
  if (getShot(s.day)) return false;
  const f = new File(photosDir, s.file);
  if (f.exists) f.delete(); // no row points at it, or the day would be taken
  f.create();
  f.writeSync(jpeg);
  try {
    db.runSync(
      'INSERT INTO shots (day, file, film, reason, weather, taken_at, memo, capsule) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      s.day,
      s.file,
      s.film,
      s.reason,
      s.weather ? JSON.stringify(s.weather) : null,
      s.takenAt,
      s.memo || null,
      s.capsule || null,
    );
  } catch (e) {
    f.delete();
    throw e;
  }
  return true;
}

/** The day's one line; '' clears it. The caller checks memoEditable. */
export function setMemo(day: string, memo: string, capsule: string): void {
  db.runSync('UPDATE shots SET memo = ?, capsule = ? WHERE day = ?', memo || null, capsule || null, day);
}

export function getSetting(k: string, fallback: string): string {
  return db.getFirstSync<{ v: string }>('SELECT v FROM kv WHERE k = ?', k)?.v ?? fallback;
}

export function setSetting(k: string, v: string): void {
  db.runSync('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v);
}

/** Every kv entry whose key starts with `prefix` (e.g. 'cover:' for picked month covers). */
export function settingsWith(prefix: string): { k: string; v: string }[] {
  return db.getAllSync<{ k: string; v: string }>('SELECT k, v FROM kv WHERE k LIKE ?', `${prefix}%`);
}

/** Every print's file in the photos dir (for the roll's size in Settings). */
export function photoFiles(): File[] {
  return allShots().map((s) => new File(photosDir, s.file));
}
