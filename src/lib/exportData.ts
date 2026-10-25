// Settings -> "데이터 내보내기 (zip)": every photo plus a JSON of the metadata,
// handed to the system share sheet. Nothing leaves the device otherwise.
// "가져오기" reads such a zip back (planning in restore.ts). Both go one photo
// at a time through zipStream.ts, so years of photos never sit in memory whole.

import { File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { inflateSync } from 'fflate';
import { dayKey } from './day';
import { tr } from './i18n';
import { coverKey } from './covers';
import { diaryText } from './diaryText';
import { MANIFEST, parseCovers, parseManifest, photoPath, planRestore, restoreLine } from './restore';
import { TAIL, ZipWriter, crc32, dataStart, findDirectory, readDirectory } from './zipStream';
import { allShots, getSetting, getShot, rawPhotoUri, restoreShot, setSetting, settingsWith } from './store';

/**
 * Zips the roll and hands it to the share sheet. Returns the photo count and
 * when the zip was made; the caller asks whether it was saved before calling
 * markExported (the share sheet can't tell a save from a cancel).
 */
export async function exportZip(onProgress?: (done: number, total: number) => void): Promise<{ count: number; at: number }> {
  const at = Date.now();
  const shots = allShots();
  const out = new File(Paths.cache, `rollcam-${dayKey(new Date())}.zip`);
  if (out.exists) out.delete();
  out.create();
  // one photo in memory at a time, straight into the file (zipStream.ts)
  const h = out.open(FileMode.WriteOnly);
  try {
    const zip = new ZipWriter((b) => h.writeBytesSync(b));
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      const f = new File(rawPhotoUri(s.file));
      if (f.exists) zip.add(photoPath(s.file), await f.bytes(), new Date(s.takenAt));
      if (i % 10 === 9) onProgress?.(i + 1, shots.length);
    }
    // picked month covers ride along so a restore keeps them
    const covers = Object.fromEntries(settingsWith('cover:').map((r) => [r.k.slice('cover:'.length), r.v]));
    zip.add(MANIFEST, new TextEncoder().encode(JSON.stringify({ exportedAt: new Date().toISOString(), shots, covers }, null, 2)));
    zip.finish();
  } finally {
    h.close();
  }
  await Sharing.shareAsync(out.uri, { mimeType: 'application/zip', dialogTitle: tr('ROLLCAM 내보내기', 'ROLLCAM export', 'ROLLCAM 書き出し') });
  return { count: shots.length, at };
}

/** The roll as of `at` (epoch ms) is safe somewhere else: Settings' backup line counts from here. */
export const markExported = (at: number) => setSetting('exportedAt', String(at));

/** Largest entry a ROLLCAM export holds (a print is a few MB, the manifest less). */
const MAX_ENTRY = 64 * 1024 * 1024;

const notZip = () => new Error(tr('zip 파일을 열지 못했어요', "Couldn't open the zip file", 'zipファイルを開けませんでした'));

/** Reads entries of a zip on disk by its central directory, one at a time (zipStream.ts). */
async function openZip(h: FileHandle) {
  const size = h.size ?? 0;
  h.offset = Math.max(0, size - TAIL);
  let dir: ReturnType<typeof findDirectory> = null;
  try {
    dir = findDirectory(await h.readBytes(Math.min(size, TAIL)));
  } catch {
    throw notZip(); // zip64: bigger than any export this app writes
  }
  if (!dir || dir.offset + dir.size > size) throw notZip();
  h.offset = dir.offset;
  const entries = new Map(readDirectory(await h.readBytes(dir.size)).map((e) => [e.name, e]));
  const read = async (name: string): Promise<Uint8Array | null> => {
    const e = entries.get(name);
    // a photo or the manifest is a few MB; anything claiming more is corrupt (or a zip bomb)
    if (!e || e.size > MAX_ENTRY || e.compressed > MAX_ENTRY || e.offset + 30 + e.compressed > size) return null;
    h.offset = e.offset;
    const start = dataStart(e, await h.readBytes(30));
    if (start + e.compressed > size) return null;
    h.offset = start;
    const raw = await h.readBytes(e.compressed);
    // inflate into exactly the size the directory states, then check it
    const data = e.method === 8 ? inflateSync(raw, { out: new Uint8Array(e.size) }) : e.method === 0 ? raw : null;
    return data && data.length === e.size && crc32(data) === e.crc ? data : null;
  };
  return { names: new Set(entries.keys()), read };
}

/**
 * Picks an export zip and adds the days this device doesn't have. Returns the
 * result line, or null if the picker was closed. Throws a user-facing message.
 */
export async function restoreZip(onProgress?: (done: number, total: number) => void): Promise<string | null> {
  const pick = await File.pickFileAsync({ mimeTypes: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'] });
  if (pick.canceled) return null;
  const h = pick.result.open(FileMode.ReadOnly);
  try {
    const zip = await openZip(h);
    let manifest: Uint8Array | null = null;
    try {
      manifest = await zip.read(MANIFEST);
    } catch {
      throw notZip();
    }
    if (!manifest) throw new Error(tr('ROLLCAM 내보내기 파일이 아니에요', 'Not a ROLLCAM export file', 'ROLLCAMの書き出しファイルではありません'));
    const json = new TextDecoder().decode(manifest);
    const plan = planRestore(parseManifest(json), zip.names, (d) => !!getShot(d), dayKey(new Date()));
    // a cover picked on this phone stays; the zip fills in the rest
    for (const [m, d] of Object.entries(parseCovers(json))) if (!getSetting(coverKey(m), '')) setSetting(coverKey(m), d);
    let added = 0;
    let failed = 0;
    // one photo in memory at a time, however big the roll
    for (let i = 0; i < plan.add.length; i++) {
      const s = plan.add[i];
      if (i % 10 === 0) onProgress?.(i, plan.add.length);
      let jpeg: Uint8Array | null = null;
      try {
        jpeg = await zip.read(photoPath(s.file));
      } catch {}
      // JPEG files start FF D8; anything else is not a photo this app made
      if (jpeg && jpeg.length > 2 && jpeg[0] === 0xff && jpeg[1] === 0xd8) {
        if (restoreShot(s, jpeg)) added++;
      } else failed++;
    }
    // a restored phone holds the zip it came from: count unsaved photos from when that zip was made
    if (added && !getSetting('exportedAt', '')) {
      const made = Date.parse(String((JSON.parse(json) as { exportedAt?: unknown }).exportedAt ?? ''));
      const latest = Math.max(0, ...plan.add.map((s) => s.takenAt));
      markExported(Number.isFinite(made) ? Math.max(made, latest) : latest);
    }
    return restoreLine({ kept: plan.kept, broken: plan.broken + failed }, added);
  } finally {
    h.close();
  }
}

/** Every line as a text file, through the share sheet (notes apps, mail, drive). Returns how many days had a line. */
export async function exportDiary(): Promise<number> {
  const shots = allShots();
  const n = shots.filter((s) => s.memo).length;
  if (!n) throw new Error(tr('아직 남긴 한 줄이 없어요', 'No lines yet', 'まだ一行がありません'));
  const out = new File(Paths.cache, `rollcam-lines-${dayKey(new Date())}.txt`);
  if (out.exists) out.delete();
  out.create();
  await out.write(diaryText(shots));
  await Sharing.shareAsync(out.uri, { mimeType: 'text/plain', dialogTitle: tr('한 줄 일기 내보내기', 'Export lines', '一行日記を書き出す') });
  return n;
}
