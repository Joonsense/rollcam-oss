/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BACKUP_NUDGE, backupDue, backupLine, shotsSince } from '../src/lib/backup.ts';

const now = new Date(2026, 9, 25, 12);
const at = new Date(2026, 9, 3, 21).getTime();

test('photos since the last export', () => {
  const shots = [{ takenAt: at - 1000 }, { takenAt: at + 1000 }, { takenAt: at + 2000 }];
  assert.equal(shotsSince(shots, at), 2);
  assert.equal(shotsSince(shots, null), 3);
  assert.equal(backupDue(BACKUP_NUDGE - 1), false);
  assert.equal(backupDue(BACKUP_NUDGE), true);
});

test('export row note', () => {
  assert.equal(backupLine(null, 0, now), '모든 사진과 기록을 zip 하나로');
  assert.equal(backupLine(null, 41, now), '아직 내보낸 적 없어요 · 이 기기에만 41장');
  assert.equal(backupLine(at, 22, now), '마지막 10월 3일 · 그 뒤 22장은 이 기기에만');
  assert.equal(backupLine(at, 0, now), '마지막 10월 3일 · 모두 내보냈어요');
  assert.equal(backupLine(new Date(2025, 11, 30).getTime(), 5, now), '마지막 2025년 12월 30일 · 그 뒤 5장은 이 기기에만');
});

test('roll size label', async () => {
  const { sizeLabel } = await import('../src/lib/backup.ts');
  assert.equal(sizeLabel(500), '1KB');
  assert.equal(sizeLabel(940 * 1024), '940KB');
  assert.equal(sizeLabel(186 * 1024 * 1024), '186MB');
  assert.equal(sizeLabel(1.25 * 1024 ** 3), '1.3GB');
});
