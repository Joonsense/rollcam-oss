// The lab stamp's lines on the back of a print, shared by the flipped print
// (screens/PrintBack.tsx) and its share image (backShare.ts). Pure.

import { FILM_NAMES } from './film.ts';
import { monthLong, tr, whyText } from './i18n.ts';
import { isLucky } from './lucky.ts';
import { weatherLine } from './sky.ts';
import type { Shot } from './store.ts';

/** '오후 3:12' */
export function clockLine(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const hm = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
  return tr(`${h < 12 ? '오전' : '오후'} ${hm}`, `${hm} ${h < 12 ? 'AM' : 'PM'}`, `${h < 12 ? '午前' : '午後'} ${hm}`);
}

/** [label, value] rows for a print, `frame`/`book`/`run` as of its day (backFacts.ts). */
export function backRows(shot: Shot, frame: number, book: { found: number; total: number }, run = 0): [string, string][] {
  const why = whyText(shot.reason);
  const sky = weatherLine(shot.weather);
  return [
    ['FILM', FILM_NAMES[shot.film]],
    ['DATE', `${shot.day.replaceAll('-', '.')}  ${clockLine(shot.takenAt)}`],
    ...(sky ? ([['SKY', sky]] as [string, string][]) : []),
    ['WHY', why],
    ...(shot.memo ? ([['NOTE', shot.memo]] as [string, string][]) : []),
    ['ROLL', tr(`${Number(shot.day.slice(5, 7))}월 ${frame}번째 장`, `${monthLong(Number(shot.day.slice(5, 7)))}, frame ${frame}`, `${Number(shot.day.slice(5, 7))}月 ${frame}枚目`)],
    ['BOOK', tr(`필름 도감 ${book.found} / ${book.total}`, `Film book ${book.found} / ${book.total}`, `フィルム図鑑 ${book.found} / ${book.total}`)],
    ...(isLucky(shot.takenAt) ? ([['LUCK', tr('럭키 컷 · 빛샘', 'Lucky frame · light leak', 'ラッキーカット · 光漏れ')]] as [string, string][]) : []),
    ...(run >= 2 ? ([['RUN', tr(`${run}일째 이어 찍는 중`, `${run} days in a row`, `${run}日連続で撮影中`)]] as [string, string][]) : []),
  ];
}
