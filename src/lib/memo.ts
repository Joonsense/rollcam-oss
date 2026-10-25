// "오늘의 한 줄": one line of words next to the day's one photo. Written on the
// day itself; after midnight it is developed with the print and stays as is,
// the same way the photo can't be retaken.

import { tr } from './i18n.ts';

/** Characters, not UTF-16 units: an emoji or a Hangul syllable counts as one. */
export const MEMO_MAX = 40;

/** Typed text -> the stored line: one line, single spaces, at most `max` characters. '' clears. */
export function normalizeMemo(input: string, max = MEMO_MAX): string {
  const one = input.replace(/\s+/g, ' ').trim();
  return Array.from(one).slice(0, max).join('').trim();
}

/** Characters left while typing (may go negative before normalizeMemo cuts it). */
export const memoLeft = (input: string, max = MEMO_MAX) => max - Array.from(input.replace(/\s+/g, ' ').trim()).length;

/** Only the day's own memo can be written or changed. */
export const memoEditable = (day: string, today: string) => day === today;

/**
 * Keeps what a font can draw and ends with '…' where the line runs past
 * `maxW`. `has` says whether a character has a glyph, `width` measures a
 * string; both come from the Skia font at draw time.
 */
export function fitLine(text: string, maxW: number, has: (ch: string) => boolean, width: (s: string) => number): string {
  const line = Array.from(text)
    .filter((ch) => ch === ' ' || has(ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (width(line) <= maxW) return line;
  const chars = Array.from(line);
  let n = chars.length;
  while (n > 0 && width(`${chars.slice(0, n).join('').trimEnd()}…`) > maxW) n--;
  return n > 0 ? `${chars.slice(0, n).join('').trimEnd()}…` : '';
}

/** The month's lines under the roll strip, in day order, with each shot's index in `shots`. */
export function memoLines<T extends { day: string; memo: string }>(shots: T[]): { day: string; memo: string; index: number }[] {
  return shots
    .map((s, index) => ({ day: s.day, memo: s.memo, index }))
    .filter((x) => x.memo)
    .sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Up to `max` lines for the month's diary image: all of them when they fit,
 * else evenly spread across the month, first and last kept.
 */
export function diaryPick<T>(lines: T[], max: number): T[] {
  if (lines.length <= max) return lines;
  if (max <= 1) return lines.slice(0, max);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(lines[Math.round((i * (lines.length - 1)) / (max - 1))]);
  return out;
}

/**
 * How big the diary image draws `n` lines: a month with one or a few lines
 * gets larger prints and words (and room to wrap) instead of a short list at
 * the top of an empty card. `k` scales the prints, `rows` caps the wrap.
 */
export function diaryScale(n: number): { k: number; rows: number } {
  if (n <= 1) return { k: 1.8, rows: 4 };
  if (n <= 3) return { k: 1.4, rows: 3 };
  return { k: 1, rows: 2 };
}

/**
 * Breaks a line into at most `maxLines` rows no wider than `maxW`, at spaces
 * when it can (Korean wraps by word too), mid-word when a word alone is too
 * wide. The last row ends in '…' if text is left over.
 */
export function wrapLine(text: string, maxW: number, width: (s: string) => number, maxLines: number): string[] {
  const rows: string[] = [];
  let rest = text.trim();
  while (rest && rows.length < maxLines) {
    if (width(rest) <= maxW) {
      rows.push(rest);
      rest = '';
      break;
    }
    const chars = Array.from(rest);
    let n = 1;
    while (n < chars.length && width(chars.slice(0, n + 1).join('')) <= maxW) n++;
    const cut = chars.slice(0, n).join('');
    const space = cut.lastIndexOf(' ');
    const take = space > 0 && chars[n] !== ' ' ? cut.slice(0, space) : cut;
    rows.push(take.trimEnd());
    rest = rest.slice(take.length).trimStart();
  }
  if (rest && rows.length) {
    const last = Array.from(rows[rows.length - 1]);
    while (last.length && width(`${last.join('')}…`) > maxW) last.pop();
    rows[rows.length - 1] = `${last.join('').trimEnd()}…`;
  }
  return rows;
}

/**
 * Every line across the roll, newest first, grouped by month ('YYYY-MM'),
 * keeping only those containing `query` (case and spacing ignored).
 */
export function searchLines<T extends { day: string; memo: string }>(shots: T[], query: string): { month: string; items: T[] }[] {
  const q = query.toLowerCase().replace(/\s+/g, '');
  const hits = shots.filter((s) => s.memo && (!q || s.memo.toLowerCase().replace(/\s+/g, '').includes(q))).sort((a, b) => b.day.localeCompare(a.day));
  const out: { month: string; items: T[] }[] = [];
  for (const s of hits) {
    const m = s.day.slice(0, 7);
    if (out[out.length - 1]?.month !== m) out.push({ month: m, items: [] });
    out[out.length - 1].items.push(s);
  }
  return out;
}

const PROMPTS: Record<string, [string, string, string]> = {
  'daily-negative': ['오늘은 어떤 날이었나요', 'How was today?', '今日はどんな日でしたか'],
  'grey-portra': ['흐린 날, 누구와 있었나요', 'A grey day. Who were you with?', 'くもりの日、誰といましたか'],
  'golden-roll': ['그 빛 아래 무엇이 있었나요', 'What was in that light?', 'その光の下に何がありましたか'],
  'night-tungsten': ['이 밤은 어디였나요', 'Where were you tonight?', '今夜はどこにいましたか'],
  'rainy-mono': ['빗소리 들으며 무슨 생각을 했나요', 'What were you thinking, listening to the rain?', '雨音を聞きながら何を考えましたか'],
  'summer-kodak': ['더운 날, 가장 시원했던 순간은', 'The coolest moment of a hot day?', '暑い日のいちばん涼しかった瞬間は'],
  'winter-fuji': ['차가운 공기 속 오늘 한마디', 'One line from the cold, clear air', '冷たい空気の中の今日のひとこと'],
  'haze-film': ['안개 속에서 무엇이 보였나요', 'What did you see through the fog?', '霧の中に何が見えましたか'],
  'motion-lofi': ['바람이 무엇을 날려 보냈나요', 'What did the wind blow away?', '風が何を吹き飛ばしましたか'],
  'snow-pastel': ['눈 오는 날, 누구에게 연락했나요', 'Who did you text on a snowy day?', '雪の日、誰に連絡しましたか'],
  'storm-push': ['천둥 치던 날의 기억', 'Remember the storm', '雷の日の記憶'],
  'party-flash': ['오늘을 축하해 준 사람', 'Who celebrated with you today?', '今日を祝ってくれた人'],
  'spring-bloom': ['벚꽃 아래 누구와 걸었나요', 'Who walked with you under the blossoms?', '桜の下を誰と歩きましたか'],
  'autumn-maple': ['단풍 든 길 위의 한 줄', 'One line from the turning leaves', '紅葉の道の上の一行'],
  'moon-silver': ['보름달에 무슨 소원을 빌었나요', 'What did you wish on the full moon?', '満月に何を願いましたか'],
  'postcard': ['여기까지 무엇을 보러 왔나요', 'What did you come all this way to see?', 'ここまで何を見に来ましたか'],
  'blue-hour': ['불이 하나둘 켜질 때 어디에 있었나요', 'Where were you as the lights came on?', '灯りがともりはじめたとき、どこにいましたか'],
  'first-snow': ['올겨울 첫눈, 무슨 소원을 빌었나요', 'The first snow. What did you wish for?', 'この冬の初雪、何を願いましたか'],
};

/** The memo field's placeholder: a question that fits the day's film. */
export const memoPrompt = (film: string) => {
  const p = PROMPTS[film] ?? PROMPTS['daily-negative'];
  return tr(p[0], p[1], p[2]);
};
