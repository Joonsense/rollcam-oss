/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseManifest, photoPath, planRestore, readShot, restoreLine } from '../src/lib/restore.ts';

const row = (day: string, extra: Record<string, unknown> = {}) => ({
  day,
  file: `${day}-1761370000000.jpg`,
  film: 'rainy-mono',
  reason: "비 오는 오후 — 'Rainy Mono'",
  weather: { code: 61, tempC: 12 },
  takenAt: 1761370000000,
  ...extra,
});
const zipOf = (...rows: { file: string }[]) => new Set(['rollcam.json', ...rows.map((r) => photoPath(r.file))]);

test('rows from an export read back as shots, memo optional', () => {
  const s = readShot(row('2026-10-20', { memo: '  우산\n없이 ' }));
  assert.equal(s?.memo, '우산 없이');
  assert.equal(s?.day, '2026-10-20');
  assert.equal(s?.film, 'rainy-mono');
  assert.deepEqual(s?.weather, { code: 61, tempC: 12 });
  assert.equal(readShot(row('2026-10-20'))?.memo, '');
  assert.equal(readShot(row('2026-10-20', { weather: 'x' }))?.weather, null);
});

test('untrusted rows are refused', () => {
  assert.equal(readShot(row('2026-02-30')), null); // not a calendar day
  assert.equal(readShot(row('2026-10-20', { film: 'velvia' })), null);
  assert.equal(readShot(row('2026-10-20', { file: '../../rollcam.db' })), null);
  assert.equal(readShot(row('2026-10-20', { file: 'a/b.jpg' })), null);
  assert.equal(readShot(row('2026-10-20', { file: '.jpg' })), null);
  assert.equal(readShot(row('2026-10-20', { takenAt: 'yesterday' })), null);
  assert.equal(readShot(null), null);
});

test('the device keeps its own days; missing photos and future days are skipped', () => {
  const a = row('2026-10-01');
  const b = row('2026-10-02');
  const c = row('2026-10-03');
  const lost = row('2026-10-04');
  const future = row('2026-10-30');
  const plan = planRestore([c, a, b, lost, future, a], zipOf(a, b, c, future), (d) => d === '2026-10-02', '2026-10-25');
  assert.deepEqual(plan.add.map((s) => s.day), ['2026-10-01', '2026-10-03']);
  assert.equal(plan.kept, 1);
  assert.equal(plan.broken, 2);
});

test('manifest must be a ROLLCAM export', () => {
  assert.equal(parseManifest(JSON.stringify({ shots: [row('2026-10-01')] })).length, 1);
  assert.throws(() => parseManifest('{"photos":[]}'), /ROLLCAM/);
  assert.throws(() => parseManifest('not json'), /ROLLCAM/);
  assert.throws(() => parseManifest('null'), /ROLLCAM/);
});

test('result line', () => {
  assert.equal(restoreLine({ kept: 0, broken: 0 }, 12), '12장을 롤에 되돌렸어요');
  assert.equal(restoreLine({ kept: 3, broken: 1 }, 0), '새로 더할 사진이 없어요 · 이미 있는 날 3장은 이 기기 사진을 남겼어요 · 읽지 못한 1장은 건너뛰었어요');
});

test('picked covers come back from an export, malformed ones dropped', async () => {
  const { parseCovers } = await import('../src/lib/restore.ts');
  assert.deepEqual(parseCovers(JSON.stringify({ shots: [], covers: { '2026-10': '2026-10-03', '2026-09': '2026-10-03', bad: '2026-10-01', '2026-02': '2026-02-30' } })), { '2026-10': '2026-10-03' });
  assert.deepEqual(parseCovers(JSON.stringify({ shots: [] })), {});
  assert.deepEqual(parseCovers('nope'), {});
});
