/// <reference types="node" />
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { chooseFilm, filmHint, FILM_NAMES, specialDay, type FilmId } from '../src/lib/film.ts';
import { count, deviceLang, monthDay, pickLang, reasonText, setLang, tr, whyText } from '../src/lib/i18n.ts';
import { doneLines, yearRecap, yearSummary, type MonthStats } from '../src/lib/stats.ts';
import { weatherLine } from '../src/lib/sky.ts';
import { echoDays } from '../src/lib/echo.ts';
import { dailyAlerts, outlookAlert } from '../src/lib/remind.ts';
import { restoreLine } from '../src/lib/restore.ts';
import { untilNext, widgetLine } from '../src/widget/state.ts';

afterEach(() => setLang('ko'));

test('device language: Korean phones get Korean, the rest English', () => {
  assert.equal(deviceLang('ko-KR'), 'ko');
  assert.equal(deviceLang('ko'), 'ko');
  assert.equal(deviceLang('en-US'), 'en');
  assert.equal(deviceLang('ja-JP'), 'ja');
  assert.equal(deviceLang('zh-TW'), 'en');
  assert.equal(pickLang('', 'en'), 'en');
  assert.equal(pickLang('ko', 'en'), 'ko');
  assert.equal(pickLang('en', 'ko'), 'en');
  assert.equal(pickLang('fr', 'ko'), 'ko');
});

test('tr and units follow the language', () => {
  assert.equal(tr('설정', 'Settings'), '설정');
  assert.equal(count(3, '장', 'photo'), '3장');
  setLang('en');
  assert.equal(tr('설정', 'Settings'), 'Settings');
  assert.equal(count(1, '장', 'photo'), '1 photo');
  assert.equal(count(3, '장', 'photo'), '3 photos');
  assert.equal(monthDay(10, 25), 'Oct 25');
});

test('every reason chooseFilm can make reads in English', () => {
  const day = (h: number, m = 0) => new Date(2026, 0, 15, h, m);
  const rise = day(7, 40);
  const set = day(17, 30);
  const weathers = [{}, { code: 95 }, { code: 61 }, { code: 73 }, { code: 45 }, { windMs: 12 }, { cloud: 90 }, { tempC: 31 }, { tempC: 1 }, { code: 0, tempC: 15 }];
  const seen = new Set<FilmId>();
  for (let h = 0; h < 24; h++)
    for (const w of weathers)
      for (const firstSnow of [false, true])
        for (const sun of [true, false]) {
          const pick = chooseFilm({ now: day(h, 30), sunrise: sun ? rise : undefined, sunset: sun ? set : undefined, weather: w, firstSnow });
          seen.add(pick.film);
          setLang('en');
          const en = reasonText(pick.reason);
          setLang('ko');
          assert.doesNotMatch(en, /[가-힣]/, pick.reason);
          assert.ok(en.endsWith(` — '${FILM_NAMES[pick.film]}'`), en);
        }
  for (const sp of [specialDay(new Date(2026, 0, 1)), specialDay(new Date(2026, 11, 25)), specialDay(new Date(2026, 4, 3), '05-03')]) {
    const pick = chooseFilm({ now: day(12), special: sp });
    setLang('en');
    assert.doesNotMatch(reasonText(pick.reason), /[가-힣]/);
    setLang('ko');
  }
  assert.equal(seen.size, 13); // all but Party Flash, covered just above
});

test('stored reasons are shown, not rewritten', () => {
  const r = "비 오는 오후 — 'Rainy Mono'";
  assert.equal(reasonText(r), r);
  assert.equal(whyText(r), '비 오는 오후');
  setLang('en');
  assert.equal(reasonText(r), "A rainy afternoon — 'Rainy Mono'");
  assert.equal(whyText(r), 'A rainy afternoon');
  assert.equal(whyText("해 지는 무렵 — 'Golden Roll'"), 'Around sunset');
  assert.equal(whyText('올겨울 첫눈 내리는 새벽'), "The winter's first snow, this early morning");
  // a line we didn't make: no Korean leaks into the English UI
  assert.equal(reasonText("아무 말 — 'Rainy Mono'"), "'Rainy Mono'");
  assert.equal(reasonText('아무 말'), '');
  assert.equal(whyText("아무 말 — 'Rainy Mono'"), '');
  assert.equal(widgetLine({ day: '2026-01-01', film: 'rainy-mono', reason: r }), 'A rainy afternoon');
  assert.equal(widgetLine({ day: '2026-01-01', film: 'rainy-mono', reason: r, memo: '우산' }), '“우산”');
});

test('every film hint has an English line', () => {
  setLang('en');
  for (const f of Object.keys(FILM_NAMES) as FilmId[]) assert.doesNotMatch(filmHint(f), /[가-힣]/, f);
});

test('English lines for stats, weather, echo, restore, widget', () => {
  setLang('en');
  const st: MonthStats = { shots: 12, days: 31, streak: 5, films: 4, topFilm: 'grey-portra', topWeather: { word: 'Overcast', count: 6 } };
  assert.deepEqual(doneLines(st), ['You shot 12 of 31 days', 'Longest run: 5 days in a row', '4 films, Grey Portra loaded most', 'Grey days came up most, 6 photos']);
  assert.equal(weatherLine({ code: 61, tempC: 12.4, windMs: 4 }), 'Rain · 12° · wind 4m/s');
  assert.equal(echoDays('2026-10-25')[0].label, 'A year ago today');
  assert.equal(echoDays('2026-10-25')[1].label, '2 years ago today');
  assert.equal(restoreLine({ kept: 1, broken: 0 }, 3), "3 photos back in your roll · kept this phone's photo on 1 day already shot");
  assert.equal(untilNext(new Date(2026, 0, 1, 20, 30)), '3h 30m');
  const shots = [
    { day: '2026-03-01', film: 'grey-portra' as FilmId, weather: { code: 3 } },
    { day: '2026-03-02', film: 'grey-portra' as FilmId, weather: { code: 3 } },
  ];
  const facts = yearRecap(yearSummary(2026, shots, '2026-12-31'), shots);
  for (const f of facts) assert.doesNotMatch(`${f.label} ${f.value}`, /[가-힣]/);
  assert.ok(facts.some((f) => f.value === 'Overcast · 2 photos'));
});

test('English reminders read for the day they arrive', () => {
  setLang('en');
  const now = new Date(2026, 9, 23, 20);
  const slots = [{ film: 'grey-portra' as FilmId, labels: ['Morning'], at: [new Date(2026, 9, 24, 9)] }];
  assert.equal(outlookAlert(now, '2026-10-24', slots, new Set(), new Set())!.body, 'A film missing from your book · Grey Portra, this morning');
  const alerts = dailyAlerts(new Date(2026, 9, 23, 9), new Set(), { golden: false, sunset: () => null, special: () => false });
  assert.doesNotMatch(alerts[0].body, /[가-힣]/);
  assert.ok(alerts[0].body.length > 10);
});

test('seasonal reasons and new lines read in English', async () => {
  const { setLang, reasonText } = await import('../src/lib/i18n.ts');
  const { milestoneLine } = await import('../src/lib/streak.ts');
  const { lightNote } = await import('../src/lib/light.ts');
  setLang('en');
  try {
    assert.equal(reasonText("단풍 드는 한낮 — 'Autumn Maple'"), "An autumn-leaves midday — 'Autumn Maple'");
    assert.equal(reasonText("벚꽃 피는 오후 — 'Spring Bloom'"), "A cherry blossom afternoon — 'Spring Bloom'");
    assert.equal(milestoneLine(30), '30 days in a row · a full month');
    const d = (h: number, m = 0) => new Date(2026, 9, 25, h, m);
    assert.equal(lightNote(d(17, 30), d(6, 50), d(17, 40)), 'Sunset light · 50 min left');
  } finally {
    setLang('ko');
  }
});

test('Japanese: every reason chooseFilm can make, hints, prompts and units', async () => {
  const { memoPrompt } = await import('../src/lib/memo.ts');
  const { filmStory } = await import('../src/lib/filmStory.ts');
  const { normalizeBirthday } = await import('../src/lib/film.ts');
  setLang('ja');
  const day = (h: number) => new Date(2026, 0, 15, h, 30);
  const weathers = [{}, { code: 95 }, { code: 61 }, { code: 73 }, { code: 45 }, { windMs: 12 }, { cloud: 90 }, { tempC: 31 }, { tempC: 1 }];
  for (let h = 0; h < 24; h++)
    for (const w of weathers)
      for (const firstSnow of [false, true]) {
        setLang('ko');
        const pick = chooseFilm({ now: day(h), sunrise: day(7), sunset: day(17), weather: w, firstSnow });
        setLang('ja');
        const ja = reasonText(pick.reason);
        assert.doesNotMatch(ja, /[가-힣]/, pick.reason);
        assert.ok(ja.endsWith(` — '${FILM_NAMES[pick.film]}'`), ja);
      }
  assert.equal(reasonText("비 오는 오후 — 'Rainy Mono'"), "雨の午後 — 'Rainy Mono'");
  assert.equal(whyText("해 지는 무렵 — 'Golden Roll'"), '日の入りのころ');
  for (const f of Object.keys(FILM_NAMES) as FilmId[]) {
    assert.doesNotMatch(filmHint(f), /[가-힣]/, f);
    assert.doesNotMatch(filmStory(f), /[가-힣]/, f);
    assert.doesNotMatch(memoPrompt(f), /[가-힣]/, f);
  }
  assert.equal(count(3, '장', 'photo'), '3枚');
  assert.equal(monthDay(10, 25), '10月25日');
  assert.equal(tr('설정', 'Settings', '設定'), '設定');
  // a line without Japanese falls back to English, never Korean
  assert.equal(tr('설정', 'Settings'), 'Settings');
  assert.equal(normalizeBirthday('5月3日'), '05-03');
});
