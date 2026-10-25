/// <reference types="node" />
// Scans every tr(ko, en, ja) call in the app. The Japanese was first added by
// matching English text, which put the weather's 'Clear' (晴れ) on the memo
// sheet's 'Clear' button (지우기). Two calls with the same English but
// different Korean need their Japanese checked one by one: list them here.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = new URL('..', import.meta.url).pathname;

// English text -> Korean sources already checked to share it (same meaning)
const REVIEWED: Record<string, string[]> = {
  "'On'": ["'켬'", "'켜짐'"],
  '"Share today\'s photo"': ["'오늘의 한 장 공유'", "'오늘 사진 공유'"],
  '`${run} days in a row`': ['`${run}일째 이어 찍는 중`', '`연속 ${run}일`'],
  // the camera's grid button and Settings' row: both グリッド
  "'Grid'": ["'격자'", "'구도 격자'"],
  "'Share roll'": ["'롤 공유'", "'이번 달 롤 공유'"],
  // weather (맑음 晴れ) vs the memo sheet's button (지우기 消す): different Japanese on purpose
  "'Clear'": ["'맑음'", "'지우기'"],
};

function calls(): { ko: string; en: string; ja: string | null; at: string }[] {
  const files: string[] = [join(root, 'App.tsx')];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f)) files.push(p);
    }
  };
  walk(join(root, 'src'));
  const out: { ko: string; en: string; ja: string | null; at: string }[] = [];
  for (const file of files) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n: any) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'tr' && n.arguments.length >= 2) {
        const [ko, en, ja] = n.arguments.map((a: any) => a.getText(sf));
        out.push({ ko, en, ja: ja ?? null, at: `${relative(root, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}` });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

test('every tr() call carries Japanese', () => {
  const missing = calls().filter((c) => c.ja === null).map((c) => `${c.at} ${c.en}`);
  assert.deepEqual(missing, []);
});

test('the same English over different Korean has been reviewed for Japanese', () => {
  const byEn = new Map<string, Set<string>>();
  for (const c of calls()) {
    if (!byEn.has(c.en)) byEn.set(c.en, new Set());
    byEn.get(c.en)!.add(c.ko);
  }
  const unreviewed: string[] = [];
  for (const [en, kos] of byEn) {
    if (kos.size < 2) continue;
    const ok = REVIEWED[en];
    if (!ok || [...kos].some((k) => !ok.includes(k))) unreviewed.push(`${en}: ${[...kos].join(' / ')}`);
  }
  assert.deepEqual(unreviewed, []);
});
