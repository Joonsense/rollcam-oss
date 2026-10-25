/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { untilNext, whyOnly, widgetLine, widgetState } from '../src/widget/state.ts';

const shots = [
  { day: '2026-10-01', film: 'golden-roll', reason: "해 지는 무렵 — 'Golden Roll'" },
  { day: '2026-10-22', film: 'rainy-mono', reason: "비 오는 오후 — 'Rainy Mono'" },
  { day: '2026-10-23', film: 'motion-lofi', reason: "바람 센 오후 — 'Motion Lo-Fi'" },
];

test('widget: today shot, frame and month progress', () => {
  const st = widgetState(new Date(2026, 9, 23, 15), shots);
  assert.equal(st.day, '2026-10-23');
  assert.equal(st.frame, 23);
  assert.equal(st.month, 10);
  assert.equal(st.days, 31);
  assert.equal(st.shots, 3);
  assert.equal(st.today?.film, 'motion-lofi');
});

test('widget: after midnight the frame is empty again', () => {
  const st = widgetState(new Date(2026, 9, 24, 0, 5), shots);
  assert.equal(st.today, null);
  assert.equal(st.frame, 24);
  assert.equal(st.shots, 3);
});

test('widget: reason without the film, time to the next roll', () => {
  assert.equal(whyOnly("비 오는 오후 — 'Rainy Mono'"), '비 오는 오후');
  assert.equal(untilNext(new Date(2026, 9, 23, 20, 48)), '3시간 12분');
  assert.equal(untilNext(new Date(2026, 9, 23, 23, 15)), '45분');
});

test('widget line prefers the day memo over the film reason', () => {
  const shot = { day: '2026-10-25', film: 'rainy-mono', reason: "비 오는 오후 — 'Rainy Mono'" };
  assert.equal(widgetLine(shot), '비 오는 오후');
  assert.equal(widgetLine({ ...shot, memo: '' }), '비 오는 오후');
  assert.equal(widgetLine({ ...shot, memo: '우산 없이 귀가' }), '“우산 없이 귀가”');
});

test('month dots: calendar rows, film on shot days, today and missed', async () => {
  const { monthDots } = await import('../src/widget/state.ts');
  // October 2026 starts on a Thursday
  const rows = monthDots(new Date(2026, 9, 25, 12), [
    { day: '2026-10-01', film: 'rainy-mono', reason: '' },
    { day: '2026-10-24', film: 'golden-roll', reason: '' },
  ]);
  assert.equal(rows.length, 5);
  assert.ok(rows.every((r) => r.length === 7));
  assert.equal(rows[0][3], null);
  assert.deepEqual(rows[0][4], { day: 1, film: 'rainy-mono', state: 'shot' });
  const flat = rows.flat().filter((x) => x !== null);
  assert.equal(flat.length, 31);
  assert.equal(flat[1].state, 'missed');
  assert.equal(flat[23].state, 'shot');
  assert.equal(flat[24].state, 'today');
  assert.equal(flat[25].state, 'future');
});

test('widget tomorrow line', async () => {
  const { tomorrowLine } = await import('../src/widget/state.ts');
  assert.equal(tomorrowLine({ labels: ['아침', '한낮'] }, 'Rainy Mono', true, false), '내일 아침 Rainy Mono');
  assert.equal(tomorrowLine({ labels: ['아침'] }, 'Autumn Maple', false, true), '내일 하루 종일 ✦ Autumn Maple');
  assert.equal(tomorrowLine(null, 'x', true, false), '');
});

test('month dots mark lucky frames', async () => {
  const { monthDots } = await import('../src/widget/state.ts');
  const { isLucky, LUCKY_SINCE } = await import('../src/lib/lucky.ts');
  let t = LUCKY_SINCE + 3600000;
  while (!isLucky(t)) t += 1000;
  const d = new Date(t);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const rows = monthDots(new Date(d.getFullYear(), d.getMonth(), 28, 12), [{ day, film: 'rainy-mono', reason: '', takenAt: t }]);
  const dot = rows.flat().find((x) => x && x.day === d.getDate());
  assert.equal(dot?.lucky, true);
});

test("the empty frame's past print: whole years only, nearest first", async () => {
  const { findYearEcho } = await import('../src/lib/echo.ts');
  const { echoLine } = await import('../src/widget/state.ts');
  const have = new Set(['2024-10-25', '2026-09-25']);
  const get = (d: string) => (have.has(d) ? d : null);
  // a month back exists but the widget only reaches for years
  assert.deepEqual(findYearEcho('2026-10-25', get), { label: '2년 전 오늘', years: 2, shot: '2024-10-25' });
  assert.equal(findYearEcho('2026-10-26', get), null);
  assert.equal(echoLine('1년 전 오늘', 'Golden Roll'), '1년 전 오늘 · Golden Roll · 오늘 찍으면 나란히');
});

test('widget screen reader labels', async () => {
  const { todayLabel, monthLabel } = await import('../src/widget/state.ts');
  const now = new Date(2026, 9, 25, 15);
  const empty = widgetState(now, []);
  assert.equal(todayLabel(empty, null), '오늘의 롤, 10월 25일, 아직 비어 있음, 눌러서 찍기');
  const shot = widgetState(now, [{ day: '2026-10-25', film: 'rainy-mono', reason: "비 오는 오후 — 'Rainy Mono'" }]);
  assert.equal(todayLabel(shot, 'Rainy Mono'), '오늘의 롤, 10월 25일, Rainy Mono, 비 오는 오후');
  assert.equal(monthLabel(shot), '이번 달 롤, 10월, 31칸 중 1장, 눌러서 롤 보기');
});

test('same date in other years, newest first', async () => {
  const { sameDate } = await import('../src/lib/echo.ts');
  const roll = [{ day: '2024-10-25' }, { day: '2026-10-25' }, { day: '2025-10-25' }, { day: '2025-10-24' }];
  assert.deepEqual(sameDate('2026-10-25', roll).map((s) => s.day), ['2025-10-25', '2024-10-25']);
  assert.deepEqual(sameDate('2025-10-24', roll), []);
});
