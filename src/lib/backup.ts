// Photos live only on this device, so the last export is the only copy
// anywhere else. Settings shows how old it is and how many photos came since,
// and leans on it once enough of the roll would be lost with the phone.


import { monthDay, tr } from './i18n.ts';
/** Photos since the last export at which the export row turns amber. */
export const BACKUP_NUDGE = 30;

/** Days of the roll (by day key) shot after an export at `at` (epoch ms). */
export const shotsSince = (shots: { takenAt: number }[], at: number | null) => (at === null ? shots.length : shots.filter((s) => s.takenAt > at).length);

/** Whether the export row should stand out: a month of photos with no copy elsewhere. */
export const backupDue = (since: number) => since >= BACKUP_NUDGE;

/** The export row's note: '마지막 10월 3일 · 그 뒤 22장' / '아직 내보낸 적 없어요 · 41장'. */
export function backupLine(at: number | null, since: number, now: Date): string {
  if (at === null)
    return since ? tr(`아직 내보낸 적 없어요 · 이 기기에만 ${since}장`, `Never exported · ${since} ${since === 1 ? 'photo' : 'photos'} only on this phone`, `まだ書き出していません · この端末だけに${since}枚`) : tr('모든 사진과 기록을 zip 하나로', 'Every photo and record in one zip', 'すべての写真と記録をひとつのzipに');
  const d = new Date(at);
  const md = monthDay(d.getMonth() + 1, d.getDate());
  const when = d.getFullYear() === now.getFullYear() ? md : tr(`${d.getFullYear()}년 ${md}`, `${md}, ${d.getFullYear()}`, `${d.getFullYear()}年${md}`);
  return since
    ? tr(`마지막 ${when} · 그 뒤 ${since}장은 이 기기에만`, `Last ${when} · ${since} ${since === 1 ? 'photo' : 'photos'} since, only on this phone`, `前回 ${when} · その後の${since}枚はこの端末だけ`)
    : tr(`마지막 ${when} · 모두 내보냈어요`, `Last ${when} · everything exported`, `前回 ${when} · すべて書き出し済み`);
}

/** '186MB' / '940KB' / '1.2GB' for the roll's size on the phone. */
export function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  if (bytes < 1024 ** 3) return `${Math.round(bytes / 1024 / 1024)}MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
}
