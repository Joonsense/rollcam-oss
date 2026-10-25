/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diaryText } from '../src/lib/diaryText.ts';

test('diary text: oldest first, a heading per month, days without a line left out', () => {
  const t = diaryText([
    { day: '2026-10-25', film: 'rainy-mono', weather: { code: 61, tempC: 12 }, memo: '우산 없이 귀가' },
    { day: '2026-09-30', film: 'daily-negative', weather: null, memo: '첫 장' },
    { day: '2026-10-01', film: 'golden-roll', weather: null, memo: '' },
  ]);
  assert.equal(
    t,
    ['ROLLCAM · 한 줄 일기', '', '# 2026년 9월', '', '09.30 (Daily Negative)', '첫 장', '', '# 2026년 10월', '', '10.25 (Rainy Mono · 비 · 12°)', '우산 없이 귀가', ''].join('\n'),
  );
  assert.equal(diaryText([]), 'ROLLCAM · 한 줄 일기\n');
});
