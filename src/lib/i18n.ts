// Korean, English and Japanese. The UI follows the phone's language unless
// Settings pins one. Lines live next to where they are used as
// tr('한국어', 'English', '日本語') calls; a line without Japanese falls back to English.
//
// Stored data stays in one form whatever the language: a shot's reason is saved
// as the Korean line chooseFilm makes ("비 오는 오후 — 'Rainy Mono'") and turned
// into the UI language only when shown (reasonText), so old rolls and exported
// zips read the same in every language.

export type Lang = 'ko' | 'en' | 'ja';

let current: Lang = 'ko';

export const lang = (): Lang => current;
/** English or Japanese: anything but the Korean the data is stored in. */
export const isEn = () => current !== 'ko';
export const isJa = () => current === 'ja';
export function setLang(l: Lang) {
  current = l;
}

/** The current language's line. */
export const tr = (ko: string, en: string, ja?: string) => (current === 'ko' ? ko : current === 'ja' ? (ja ?? en) : en);

/** A quoted line: “…” / 「…」. */
export const quote = (s: string) => (current === 'ja' ? `「${s}」` : `“${s}”`);

/** 'ko' for a Korean phone, 'ja' for a Japanese one, 'en' for everything else. */
export function deviceLang(locale?: string): Lang {
  let loc = locale;
  if (loc === undefined) {
    try {
      loc = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      return 'ko';
    }
  }
  const l = loc.toLowerCase();
  return l.startsWith('ko') ? 'ko' : l.startsWith('ja') ? 'ja' : 'en';
}

/** Settings value ('' = follow the phone) -> the language to use. */
export const pickLang = (setting: string, device: Lang): Lang => (setting === 'ko' || setting === 'en' || setting === 'ja' ? setting : device);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 1..12 -> '10월' / 'Oct' / '10月'. */
export const monthShort = (m: number) => tr(`${m}월`, MONTHS[m - 1] ?? String(m), `${m}月`);
/** 1..12 -> '10월' / 'October' / '10月'. */
export const monthLong = (m: number) => tr(`${m}월`, MONTHS_LONG[m - 1] ?? String(m), `${m}月`);
/** '10월 25일' / 'Oct 25' / '10月25日'. */
export const monthDay = (m: number, d: number) => tr(`${m}월 ${d}일`, `${MONTHS[m - 1]} ${d}`, `${m}月${d}日`);
/** '2026년 10월' / 'October 2026' / '2026年10月'. */
export const yearMonth = (y: number, m: number) => tr(`${y}년 ${m}월`, `${MONTHS_LONG[m - 1]} ${y}`, `${y}年${m}月`);

// Japanese counters for the Korean ones count() is called with
const JA_UNIT: Record<string, string> = { 장: '枚', 일: '日', 개: 'つ', 종: '種' };

/** Count with a unit: count(3, '장', 'photo') -> '3장' / '3 photos' / '3枚'. */
export const count = (n: number, ko: string, en: string, enPlural = `${en}s`) => tr(`${n}${ko}`, `${n} ${n === 1 ? en : enPlural}`, `${n}${JA_UNIT[ko] ?? ko}`);

// --- film reasons (lib/film.ts chooseFilm) -----------------------------------

const POD: Record<string, [string, string]> = {
  새벽: ['early morning', '明け方'],
  아침: ['morning', '朝'],
  한낮: ['midday', '昼'],
  오후: ['afternoon', '午後'],
  저녁: ['evening', '夕方'],
};

// "<kind> <part of day>" reasons, longest first so '올겨울 첫눈 내리는' wins over '눈 내리는'
const KINDS: [string, (pod: string) => string, (pod: string) => string][] = [
  ['올겨울 첫눈 내리는', (p) => `The winter's first snow, this ${p}`, (p) => `この冬はじめての雪の${p}`],
  ['벚꽃 피는', (p) => `A cherry blossom ${p}`, (p) => `桜の咲く${p}`],
  ['단풍 드는', (p) => `An autumn-leaves ${p}`, (p) => `紅葉の${p}`],
  ['멀리 떠나온', (p) => `A ${p} far from home`, (p) => `遠く旅先の${p}`],
  ['차갑고 맑은', (p) => `A cold, clear ${p}`, (p) => `冷たく晴れた${p}`],
  ['천둥 치는', (p) => `A stormy ${p}`, (p) => `雷の鳴る${p}`],
  ['비 오는', (p) => `A rainy ${p}`, (p) => `雨の${p}`],
  ['눈 내리는', (p) => `A snowy ${p}`, (p) => `雪の降る${p}`],
  ['안개 낀', (p) => `A foggy ${p}`, (p) => `霧の${p}`],
  ['바람 센', (p) => `A windy ${p}`, (p) => `風の強い${p}`],
  ['뜨거운', (p) => `A hot ${p}`, (p) => `暑い${p}`],
  ['평범한', (p) => `An ordinary ${p}`, (p) => `いつもの${p}`],
  ['흐린', (p) => `A grey ${p}`, (p) => `くもりの${p}`],
];

const FIXED: Record<string, [string, string]> = {
  '해 뜨는 무렵': ['Around sunrise', '日の出のころ'],
  '해 지는 무렵': ['Around sunset', '日の入りのころ'],
  '해가 진 밤': ['After dark', '日が暮れた夜'],
  '보름달 뜬 밤': ['A full-moon night', '満月の夜'],
  '해 진 뒤 푸른 무렵': ['Blue hour after sunset', '日没後の青い時間'],
  '해 뜨기 전 푸른 무렵': ['Blue hour before sunrise', '日の出前の青い時間'],
  '새해 첫날': ["New Year's Day", '元日'],
  크리스마스: ['Christmas', 'クリスマス'],
  생일: ['Your birthday', '誕生日'],
};

/** The "why" half of a stored reason in English (or Japanese); null if it isn't one we made. */
export function whyEn(why: string, ja = false): string | null {
  const w = why.trim();
  const i = ja ? 1 : 0;
  if (FIXED[w]) return FIXED[w][i];
  for (const [kind, en, jp] of KINDS) {
    if (!w.startsWith(`${kind} `)) continue;
    const pod = POD[w.slice(kind.length + 1)];
    if (pod) return (ja ? jp : en)(pod[i]);
  }
  return null;
}

/**
 * A stored reason in the current language. "비 오는 오후 — 'Rainy Mono'" stays
 * as is in Korean and becomes "A rainy afternoon — 'Rainy Mono'" in English,
 * "雨の午後 — 'Rainy Mono'" in Japanese. A line we can't read (hand-edited zip)
 * keeps just the film name part.
 */
export function reasonText(reason: string): string {
  if (current === 'ko' || !reason) return reason;
  const cut = reason.indexOf(' — ');
  const why = cut < 0 ? reason : reason.slice(0, cut);
  const film = cut < 0 ? '' : reason.slice(cut);
  const en = whyEn(why, current === 'ja');
  if (en) return `${en}${film}`;
  return film ? film.slice(3) : /[가-힣]/.test(reason) ? '' : reason;
}

/** Just the why, film name dropped: "비 오는 오후 — 'Rainy Mono'" -> "비 오는 오후" / "A rainy afternoon". */
export const whyText = (reason: string) => {
  const why = reason.split(' — ')[0];
  if (current === 'ko') return why;
  return whyEn(why, current === 'ja') ?? (/[가-힣]/.test(why) ? '' : why);
};
