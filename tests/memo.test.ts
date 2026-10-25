/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MEMO_MAX, diaryPick, diaryScale, fitLine, memoEditable, memoLeft, memoLines, normalizeMemo, searchLines, wrapLine } from '../src/lib/memo.ts';

test('memo is one trimmed line, cut by characters not code units', () => {
  assert.equal(normalizeMemo('  비 맞고\n\n 집에   옴  '), '비 맞고 집에 옴');
  assert.equal(normalizeMemo('   '), '');
  const long = '가'.repeat(MEMO_MAX + 5);
  assert.equal(Array.from(normalizeMemo(long)).length, MEMO_MAX);
  // emoji are one character each and never split in half
  const emoji = '🌧'.repeat(MEMO_MAX + 1);
  assert.equal(normalizeMemo(emoji), '🌧'.repeat(MEMO_MAX));
  // a cut that lands on a space leaves no trailing space
  assert.equal(normalizeMemo(`${'a'.repeat(MEMO_MAX - 1)} bcd`), 'a'.repeat(MEMO_MAX - 1));
});

test('characters left counts the line as it will be stored', () => {
  assert.equal(memoLeft(''), MEMO_MAX);
  assert.equal(memoLeft('  a  b '), MEMO_MAX - 3);
  assert.equal(memoLeft('🌧🌧'), MEMO_MAX - 2);
  assert.ok(memoLeft('x'.repeat(MEMO_MAX + 2)) < 0);
});

test('only the day itself can write its memo', () => {
  assert.equal(memoEditable('2026-10-25', '2026-10-25'), true);
  assert.equal(memoEditable('2026-10-24', '2026-10-25'), false);
});

test('fitLine drops glyphs the font lacks and ellipsizes to width', () => {
  const has = (ch: string) => ch !== '🌧' && ch !== '똠';
  const width = (s: string) => Array.from(s).length * 10;
  assert.equal(fitLine('비 🌧 온다', 1000, has, width), '비 온다');
  assert.equal(fitLine('똠양꿍 먹음', 1000, has, width), '양꿍 먹음');
  assert.equal(fitLine('가나다라마바사', 50, has, width), '가나다라…');
  assert.equal(fitLine('가나 다라마', 40, has, width), '가나…');
  assert.equal(fitLine('가나다', 5, has, width), '');
  assert.equal(fitLine('🌧🌧', 100, has, width), '');
});

test('month lines keep only days with a memo, in day order, pointing at the shot', () => {
  const shots = [
    { day: '2026-10-03', memo: '셋째 날' },
    { day: '2026-10-01', memo: '' },
    { day: '2026-10-02', memo: '둘째 날' },
  ];
  assert.deepEqual(memoLines(shots), [
    { day: '2026-10-02', memo: '둘째 날', index: 2 },
    { day: '2026-10-03', memo: '셋째 날', index: 0 },
  ]);
  assert.deepEqual(memoLines([]), []);
});

test('diary keeps every line that fits, else spreads across the month', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i);
  assert.deepEqual(diaryPick([1, 2, 3], 9), [1, 2, 3]);
  const p = diaryPick(xs, 5);
  assert.equal(p.length, 5);
  assert.equal(p[0], 0);
  assert.equal(p[4], 19);
  assert.deepEqual(p, [...new Set(p)].sort((a, b) => a - b));
  assert.deepEqual(diaryPick(xs, 1), [0]);
});

test('wrapLine breaks at spaces, then mid-word, and ends with an ellipsis', () => {
  const w = (s: string) => Array.from(s).length * 10;
  assert.deepEqual(wrapLine('짧은 줄', 100, w, 2), ['짧은 줄']);
  assert.deepEqual(wrapLine('비 맞고 집에 왔다 우산은 없었다', 80, w, 2), ['비 맞고 집에', '왔다 우산은…']);
  assert.deepEqual(wrapLine('가나다라마바사아자차', 50, w, 3), ['가나다라마', '바사아자차']);
  const r = wrapLine('aaaa bbbb cccc dddd', 40, w, 2);
  assert.equal(r.length, 2);
  assert.ok(r.every((x) => w(x) <= 40));
  assert.ok(r[1].endsWith('…'));
  assert.deepEqual(wrapLine('', 40, w, 2), []);
});

test('diary image: few lines draw bigger, a full month keeps list size', () => {
  assert.deepEqual(diaryScale(1), { k: 1.8, rows: 4 });
  assert.deepEqual(diaryScale(3), { k: 1.4, rows: 3 });
  assert.deepEqual(diaryScale(4), { k: 1, rows: 2 });
  assert.deepEqual(diaryScale(8), { k: 1, rows: 2 });
});

test('search lines: newest first, by month, ignoring case and spaces', () => {
  const shots = [
    { day: '2026-09-02', memo: '첫 출근' },
    { day: '2026-10-05', memo: 'Coffee 한 잔' },
    { day: '2026-10-09', memo: '' },
    { day: '2026-10-20', memo: '퇴근길 하늘' },
  ];
  assert.deepEqual(searchLines(shots, '').map((g) => [g.month, g.items.map((x) => x.day)]), [
    ['2026-10', ['2026-10-20', '2026-10-05']],
    ['2026-09', ['2026-09-02']],
  ]);
  assert.deepEqual(searchLines(shots, 'coffee').flatMap((g) => g.items.map((x) => x.day)), ['2026-10-05']);
  assert.deepEqual(searchLines(shots, '첫출근').flatMap((g) => g.items.map((x) => x.day)), ['2026-09-02']);
  assert.deepEqual(searchLines(shots, '없는말'), []);
});

test('memo prompt fits the film, with a fallback', async () => {
  const { memoPrompt } = await import('../src/lib/memo.ts');
  const { FILM_NAMES } = await import('../src/lib/film.ts');
  for (const f of Object.keys(FILM_NAMES)) assert.ok(memoPrompt(f).length > 3, f);
  assert.match(memoPrompt('rainy-mono'), /빗소리/);
  assert.equal(memoPrompt('unknown'), memoPrompt('daily-negative'));
});
