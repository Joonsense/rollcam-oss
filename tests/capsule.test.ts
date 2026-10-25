/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAPSULE_MAX, capsuleAlerts, capsuleDate, capsuleOpen, capsuleOpensOn, capsuleWaiting } from '../src/lib/capsule.ts';
import { normalizeMemo } from '../src/lib/memo.ts';
import { readShot } from '../src/lib/restore.ts';

test('a capsule opens on the same date next year, Feb 29 on Feb 28', () => {
  assert.equal(capsuleOpensOn('2026-10-25'), '2027-10-25');
  assert.equal(capsuleOpensOn('2028-02-29'), '2029-02-28');
  assert.equal(capsuleOpensOn('2027-02-28'), '2028-02-28');
  assert.equal(capsuleDate('2026-10-25'), '2027.10.25');
  assert.equal(capsuleOpen('2026-10-25', '2027-10-24'), false);
  assert.equal(capsuleOpen('2026-10-25', '2027-10-25'), true);
  assert.equal(capsuleOpen('2026-10-25', '2030-01-01'), true);
});

test('capsule text is one line up to 80 characters', () => {
  assert.equal(Array.from(normalizeMemo('가'.repeat(100), CAPSULE_MAX)).length, CAPSULE_MAX);
});

test('opening-morning alerts, one per morning, within the week', () => {
  const shots = [
    { day: '2025-10-27', capsule: '내년엔 더 자주 걷기' },
    { day: '2025-10-26', capsule: '' },
    { day: '2024-10-28', capsule: '2년 된 편지는 이미 열렸다' },
  ];
  const a = capsuleAlerts(new Date(2026, 9, 25, 20), shots);
  assert.equal(a.length, 1);
  assert.equal(a[0].date.getDate(), 27);
  assert.equal(a[0].date.getHours(), 9);
  assert.match(a[0].body, /1년 전 오늘의 내가/);
  assert.equal(capsuleAlerts(new Date(2026, 9, 27, 10), shots).length, 0);
});

test('the camera announces a letter that opens today, before the shot', () => {
  const store: Record<string, { day: string; capsule: string }> = {
    '2025-10-25': { day: '2025-10-25', capsule: '안녕' },
    '2028-02-29': { day: '2028-02-29', capsule: '윤일' },
  };
  const get = (d: string) => store[d] ?? null;
  assert.equal(capsuleWaiting('2026-10-25', get)?.capsule, '안녕');
  assert.equal(capsuleWaiting('2026-10-26', get), null);
  assert.equal(capsuleWaiting('2029-02-28', get)?.capsule, '윤일');
});

test('export rows carry the capsule back', () => {
  const s = readShot({ day: '2026-10-20', file: '2026-10-20-1.jpg', film: 'rainy-mono', reason: '', takenAt: 1, capsule: ' 내년의 나 ' });
  assert.equal(s?.capsule, '내년의 나');
  assert.equal(readShot({ day: '2026-10-20', file: '2026-10-20-1.jpg', film: 'rainy-mono', reason: '', takenAt: 1 })?.capsule, '');
});

test('no capsule alert on a day already shot; the letter reads only after the shot that day', async () => {
  const { capsuleRevealed } = await import('../src/lib/capsule.ts');
  const shots = [{ day: '2025-10-27', capsule: '안녕' }];
  assert.equal(capsuleAlerts(new Date(2026, 9, 27, 7), shots, undefined, new Set(['2026-10-27'])).length, 0);
  assert.equal(capsuleAlerts(new Date(2026, 9, 27, 7), shots).length, 1);
  assert.equal(capsuleRevealed('2025-10-27', '2026-10-27', false), false);
  assert.equal(capsuleRevealed('2025-10-27', '2026-10-27', true), true);
  assert.equal(capsuleRevealed('2025-10-27', '2026-10-28', false), true);
  assert.equal(capsuleRevealed('2025-10-27', '2026-10-26', true), false);
});

test('two letters opening the same Feb 28: the camera shows the newest, like the notification', () => {
  const rows: Record<string, { day: string; capsule: string }> = {
    '2028-02-28': { day: '2028-02-28', capsule: '28일' },
    '2028-02-29': { day: '2028-02-29', capsule: '29일' },
  };
  const get = (d: string) => rows[d] ?? null;
  assert.equal(capsuleWaiting('2029-02-28', get)?.capsule, '29일');
  const alerts = capsuleAlerts(new Date(2029, 1, 27, 20), Object.values(rows));
  assert.equal(alerts.length, 1);
});
