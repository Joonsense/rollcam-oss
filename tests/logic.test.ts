/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMonths, dayKey, monthKey, msUntilMidnight } from '../src/lib/day.ts';
import { echoDays, findEcho } from '../src/lib/echo.ts';
import { chooseFilm, specialDay } from '../src/lib/film.ts';
import { FRAMES, monthStrip } from '../src/lib/strip.ts';
import { DEFAULT_PLACE, sunTimes } from '../src/lib/sun.ts';

const at = (h: number, m = 0) => new Date(2026, 9, 22, h, m);
const rise = at(6, 40);
const set = at(17, 50);

test('day keys use local calendar', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(monthKey(new Date(2026, 11, 31)), '2026-12');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(msUntilMidnight(new Date(2026, 0, 5, 23, 0)), 3600000);
});

test('film priority', () => {
  const base = { sunrise: rise, sunset: set };
  assert.equal(chooseFilm({ now: at(12), ...base, special: '생일' }).film, 'party-flash');
  assert.equal(chooseFilm({ now: at(17, 30), ...base, weather: { code: 95 } }).film, 'storm-push');
  assert.equal(chooseFilm({ now: at(17, 30), ...base, weather: { code: 61 } }).film, 'golden-roll');
  assert.equal(chooseFilm({ now: at(7, 10), ...base }).film, 'golden-roll');
  assert.equal(chooseFilm({ now: at(22), ...base, weather: { code: 0 } }).film, 'night-tungsten');
  assert.equal(chooseFilm({ now: at(14), ...base, weather: { code: 63 } }).film, 'rainy-mono');
  assert.equal(chooseFilm({ now: at(14), ...base, weather: { code: 73 } }).film, 'snow-pastel');
  assert.equal(chooseFilm({ now: at(14), ...base, weather: { code: 45 } }).film, 'haze-film');
  assert.equal(chooseFilm({ now: at(14), ...base, weather: { code: 1, windMs: 12 } }).film, 'motion-lofi');
  assert.equal(chooseFilm({ now: at(14), ...base, weather: { code: 3, cloud: 90 } }).film, 'grey-portra');
  assert.equal(chooseFilm({ now: at(14), ...base, weather: { code: 0, tempC: 31 } }).film, 'summer-kodak');
  assert.equal(chooseFilm({ now: at(14), ...base, weather: { code: 0, tempC: 2 } }).film, 'winter-fuji');
  assert.equal(chooseFilm({ now: at(14), ...base, weather: { code: 0, tempC: 18 } }).film, 'daily-negative');
});

test('offline: time only gives golden / night / daily', () => {
  assert.equal(chooseFilm({ now: at(14) }).film, 'daily-negative');
  assert.equal(chooseFilm({ now: at(23), sunrise: rise, sunset: set, weather: null }).film, 'night-tungsten');
});

test('reason line names the film', () => {
  const r = chooseFilm({ now: at(15), sunrise: rise, sunset: set, weather: { code: 63 } });
  assert.equal(r.reason, "비 오는 오후 — 'Rainy Mono'");
});

test('special days', () => {
  assert.equal(specialDay(new Date(2026, 0, 1)), '새해 첫날');
  assert.equal(specialDay(new Date(2026, 4, 3), '05-03'), '생일');
  assert.equal(specialDay(new Date(2026, 4, 4), '05-03'), null);
});

test('strip has 36 frames with days centered', () => {
  const s = monthStrip('2026-02', new Set(['2026-02-01', '2026-02-10']), '2026-02-11');
  assert.equal(s.length, FRAMES);
  const days = s.filter((f) => f.kind === 'day');
  assert.equal(days.length, 28);
  assert.equal(s[0].kind, 'leader');
  assert.equal(s.findIndex((f) => f.kind === 'day'), 4);
  const st = (d: string) => days.find((f) => f.kind === 'day' && f.day === d)!;
  assert.equal(st('2026-02-01').kind === 'day' && st('2026-02-01').state, 'shot');
  assert.equal(st('2026-02-05').kind === 'day' && st('2026-02-05').state, 'missed');
  assert.equal(st('2026-02-11').kind === 'day' && st('2026-02-11').state, 'today');
  assert.equal(st('2026-02-20').kind === 'day' && st('2026-02-20').state, 'future');
  assert.equal(monthStrip('2026-10', new Set(), '2026-10-22').filter((f) => f.kind === 'day').length, 31);
});

test('Seoul sun times are plausible', () => {
  const t = sunTimes(new Date(2026, 5, 21, 12), DEFAULT_PLACE.lat, DEFAULT_PLACE.lon)!;
  // Seoul solstice: sunrise ~05:11, sunset ~19:57 KST (UTC+9)
  const kstMin = (d: Date) => ((d.getUTCHours() + 9) % 24) * 60 + d.getUTCMinutes();
  assert.ok(Math.abs(kstMin(t.sunrise) - (5 * 60 + 11)) < 6, `sunrise kst min ${kstMin(t.sunrise)}`);
  assert.ok(Math.abs(kstMin(t.sunset) - (19 * 60 + 57)) < 6, `sunset kst min ${kstMin(t.sunset)}`);
});

test('open-meteo parse uses the returned utc offset', async () => {
  const { parseForecast, coarse, usable } = await import('../src/lib/weather.ts');
  const c = parseForecast(
    {
      utc_offset_seconds: 32400,
      current: { temperature_2m: 7.1, weather_code: 0, cloud_cover: 0, wind_speed_10m: 1.49 },
      daily: { sunrise: ['2026-10-22T06:46'], sunset: ['2026-10-22T17:46'] },
    },
    0,
  );
  assert.equal(c.sunrise!.toISOString(), '2026-10-21T21:46:00.000Z');
  assert.equal(c.sunset!.toISOString(), '2026-10-22T08:46:00.000Z');
  assert.deepEqual(c.weather, { code: 0, cloud: 0, tempC: 7.1, windMs: 1.49 });
  assert.equal(coarse(37.5665), 37.6);
  const now = new Date(2026, 9, 22, 15);
  assert.ok(usable({ ...c, fetchedAt: new Date(2026, 9, 22, 13).getTime() }, now));
  assert.equal(usable({ ...c, fetchedAt: new Date(2026, 9, 21, 23).getTime() }, now), null);
});

test('reminders skip shot days and past times', async () => {
  const { reminderDates } = await import('../src/lib/remind.ts');
  const now = new Date(2026, 9, 22, 19, 0); // after 18:00 today
  const r = reminderDates(now, new Set(['2026-10-23']));
  assert.equal(r.length, 5); // 24..28
  assert.equal(r[0].getDate(), 24);
  assert.equal(r[0].getHours(), 18);
  const morning = reminderDates(new Date(2026, 9, 22, 9), new Set());
  assert.equal(morning[0].getDate(), 22);
  assert.equal(reminderDates(new Date(2026, 9, 22, 9), new Set(['2026-10-22']))[0].getDate(), 23);
});

test('sky colors and month history url', async () => {
  const { skyColor, monthSkyUrl, parseMonthSky, weatherLine } = await import('../src/lib/sky.ts');
  assert.equal(weatherLine(null), '');
  assert.equal(weatherLine({ code: 0, tempC: 17.6, windMs: 3.4, cloud: 10 }), '맑음 · 18° · 바람 3m/s');
  assert.equal(weatherLine({ tempC: -2.2, windMs: 0.4, cloud: 80 }), '-2° · 구름 80%');
  assert.equal(weatherLine({ code: 63 }), '비');
  assert.equal(skyColor(null), '#2B2A33');
  assert.equal(skyColor(63), '#4A5A6A');
  assert.equal(skyColor(0, 30), '#E3B04B');
  assert.equal(monthSkyUrl(37.6, 127, '2026-11', '2026-10-22'), null);
  assert.match(monthSkyUrl(37.6, 127, '2026-10', '2026-10-22')!, /start_date=2026-10-01&end_date=2026-10-22/);
  assert.match(monthSkyUrl(37.6, 127, '2026-09', '2026-10-22')!, /end_date=2026-09-30/);
  const p = parseMonthSky({ daily: { time: ['2026-10-01'], weather_code: [61], temperature_2m_max: [19.5] } });
  assert.deepEqual(p['2026-10-01'], { code: 61, tempMax: 19.5 });
});

test('film color: tone curve pinned, never clips, all films stay in range', async () => {
  const { LOOKS, filmColor, filmUniforms, tone } = await import('../src/lib/looks.ts');
  for (const k of [0.8, 1, 1.45]) {
    assert.equal(tone(0, k), 0);
    assert.equal(tone(0.5, k), 0.5);
    assert.equal(tone(1, k), 1);
    for (let x = 0; x < 1; x += 0.05) assert.ok(tone(x + 0.05, k) >= tone(x, k), `monotonic k=${k}`);
  }
  assert.ok(tone(0.25, 1.45) < 0.25 && tone(0.75, 1.45) > 0.75, 'contrast > 1 is an S-curve');
  for (const [id, look] of Object.entries(LOOKS)) {
    let prev = -1;
    for (let v = 0; v <= 1.0001; v += 0.1) {
      const out = filmColor(look, [v, v, v]);
      for (const ch of out) assert.ok(ch >= 0 && ch <= 1, `${id} in range`);
      const y = out[0] * 0.2126 + out[1] * 0.7152 + out[2] * 0.0722;
      assert.ok(y >= prev - 1e-9, `${id} grey ramp stays monotonic`);
      prev = y;
    }
    // highlights survive: white stays bright instead of greying out
    const w = filmColor(look, [1, 1, 1]);
    assert.ok(w[0] * 0.2126 + w[1] * 0.7152 + w[2] * 0.0722 > 0.9, `${id} white stays bright`);
    // size 2 + lutN 1 + halation 1 + grain 3 + vignette 1 + flash 1 + leak 3 = shader uniform floats
    assert.equal(filmUniforms(look, { w: 1080, h: 1440 }, 1, 12345).length, 12);
  }
  const mono = filmColor(LOOKS['rainy-mono'], [0.9, 0.2, 0.1]);
  assert.ok(Math.abs(mono[0] - mono[1]) < 0.06 && Math.abs(mono[1] - mono[2]) < 0.06, 'rainy mono is (nearly) grey');
});

test('film LUT: baked strip matches filmColor, hue moves are film-like', async () => {
  const { LOOKS, LUT_N, filmColor, hueMoves } = await import('../src/lib/looks.ts');
  const { bakeLut, sampleLut, toCube } = await import('../src/lib/lut.ts');
  type C = [number, number, number];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [id, look] of Object.entries(LOOKS)) {
    const lut = bakeLut(look);
    assert.equal(lut.width, LUT_N * LUT_N);
    assert.equal(lut.rgba.length, LUT_N * LUT_N * LUT_N * 4);
    assert.equal(bakeLut(look), lut, 'cached per look');
    let worst = 0;
    for (let i = 0; i < 400; i++) {
      const px: C = [rnd(), rnd(), rnd()];
      const a = filmColor(look, px);
      const b = sampleLut(lut, px);
      for (let ch = 0; ch < 3; ch++) worst = Math.max(worst, Math.abs(a[ch] - b[ch]));
    }
    assert.ok(worst < 6 / 255, `${id} LUT error ${(worst * 255).toFixed(1)}/255`);
  }
  // greys are never moved by hue entries
  for (const look of Object.values(LOOKS)) for (const v of [0, 0.3, 0.7, 1]) assert.deepEqual(hueMoves(look.hues, [v, v, v]), [v, v, v]);
  // a grass green: Gold leans yellow, Fuji leans cyan (more blue than red)
  const grass: C = [0.3, 0.55, 0.25];
  const gold = filmColor(LOOKS['golden-roll'], grass);
  const fuji = filmColor(LOOKS['winter-fuji'], grass);
  assert.ok(gold[0] / gold[1] > fuji[0] / fuji[1], 'gold greens warmer than fuji');
  assert.ok(fuji[2] / fuji[1] > gold[2] / gold[1], 'fuji greens cooler than gold');
  // mono roll: a blue sky prints darker than an orange of the same luma (yellow filter)
  const y = (c: C) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  const sky: C = [0.35, 0.55, 0.9];
  const k = y(sky) / y([0.9, 0.55, 0.3]);
  const orange: C = [0.9 * k, 0.55 * k, 0.3 * k];
  assert.ok(y(filmColor(LOOKS['rainy-mono'], sky)) < y(filmColor(LOOKS['rainy-mono'], orange)) - 0.02, 'mono darkens sky');
  const cube = toCube(LOOKS['grey-portra'], 'Grey Portra', 5).trim().split('\n');
  assert.equal(cube[1], 'LUT_3D_SIZE 5');
  assert.equal(cube.length, 4 + 125);
});

test('birthday input normalizes or rejects', async () => {
  const { normalizeBirthday } = await import('../src/lib/film.ts');
  for (const s of ['5/3', '05-03', '0503', '5.3', '5월 3일', ' 5 월 3 일 ']) assert.equal(normalizeBirthday(s), '05-03', s);
  assert.equal(normalizeBirthday('2/29'), '02-29');
  assert.equal(normalizeBirthday(''), '');
  for (const s of ['2/30', '13/1', '0/5', '4/31', 'abc', '5-', '123']) assert.equal(normalizeBirthday(s), null, s);
});

test('month stats: streak, top film, weather, roll-done date', async () => {
  const { monthStats, statsLine, doneLines } = await import('../src/lib/stats.ts');
  const { rollDoneDate } = await import('../src/lib/remind.ts');
  type F = Parameters<typeof monthStats>[1][number]['film'];
  const shot = (d: number, film: F, code?: number) => ({ day: `2026-10-${String(d).padStart(2, '0')}`, film, weather: code === undefined ? null : { code } });
  const shots = [shot(3, 'grey-portra', 3), shot(4, 'grey-portra', 3), shot(5, 'rainy-mono', 61), shot(9, 'daily-negative', 0), shot(10, 'grey-portra', 3), shot(1, 'daily-negative', 0)];
  const st = monthStats('2026-10', shots, '2026-11-02');
  assert.equal(st.days, 31, 'past month counts every day');
  assert.equal(st.shots, 6);
  assert.equal(st.streak, 3, '3,4,5');
  assert.equal(st.films, 3);
  assert.equal(st.topFilm, 'grey-portra');
  assert.deepEqual(st.topWeather, { word: '흐림', count: 3 });
  assert.equal(monthStats('2026-10', shots, '2026-10-22').days, 22, 'current month counts to today');
  assert.equal(statsLine(st), '최장 연속 3일 · 자주 나온 필름 Grey Portra');
  assert.equal(statsLine(monthStats('2026-10', [shot(1, 'golden-roll')], '2026-10-22')), '', 'nothing to say with one shot');
  assert.equal(doneLines(st)[0], '31일 중 6장을 찍었어요');
  assert.equal(doneLines(st).at(-1), '흐린 날이 3장으로 제일 많았어요');
  const { weatherSentence } = await import('../src/lib/stats.ts');
  assert.equal(weatherSentence(monthStats('2026-10', [shot(1, 'golden-roll', 0), shot(2, 'golden-roll', 61)], '2026-10-22')), '', 'no sentence when nothing repeats');
  assert.ok(doneLines(monthStats('2026-10', [shot(1, 'golden-roll'), shot(8, 'golden-roll')], '2026-11-01')).includes('한 달 내내 Golden Roll'));
  // tie goes to the most recent film
  assert.equal(monthStats('2026-10', [shot(1, 'golden-roll'), shot(2, 'winter-fuji')], '2026-10-22').topFilm, 'winter-fuji');
  const due = rollDoneDate(new Date(2026, 11, 31, 23));
  assert.deepEqual([due.getFullYear(), due.getMonth(), due.getDate(), due.getHours()], [2027, 0, 1, 10]);
});

test('release-check catches store/manifest mismatches', async () => {
  const { checkManifest } = await import('../scripts/release-check.mjs');
  const app = { version: '0.3.0', android: { versionCode: 4 } };
  const ok = `<manifest android:versionCode="4" android:versionName="0.3.0" package="com.deblockx.rollcam">
<uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="com.sec.android.provider.badge.permission.READ"/>
<application android:allowBackup="false" android:label="ROLLCAM">`;
  assert.deepEqual(checkManifest(ok, app, 3).problems, []);
  const bad = ok
    .replace('android:allowBackup="false"', 'android:allowBackup="true" android:debuggable="true"')
    .replace('ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION')
    .replace('targetSdkVersion="36"', 'targetSdkVersion="34"');
  const p = checkManifest(bad, app, 4).problems.join(' | ');
  for (const want of ['allowBackup', 'debuggable', 'ACCESS_FINE_LOCATION', 'targetSdkVersion 34', "not above Play's highest"]) assert.ok(p.includes(want), want);
});

test('year summary: months, dots, cross-month streak', async () => {
  const { yearSummary, yearLine, longestStreak } = await import('../src/lib/stats.ts');
  const shot = (day: string, film: 'grey-portra' | 'golden-roll') => ({ day, film, weather: null, file: `${day}.jpg` });
  const shots = [shot('2026-09-29', 'grey-portra'), shot('2026-09-30', 'grey-portra'), shot('2026-10-01', 'golden-roll'), shot('2026-10-02', 'grey-portra'), shot('2026-10-20', 'golden-roll'), shot('2025-12-31', 'golden-roll')];
  assert.equal(longestStreak(['2026-09-30', '2026-10-01', '2026-09-29', '2026-10-01']), 3, 'crosses month end, ignores repeats');
  assert.equal(longestStreak(['2025-12-31', '2026-01-01']), 2, 'crosses year end');
  const y = yearSummary(2026, shots, '2026-10-22');
  assert.equal(y.months.length, 12);
  assert.equal(y.shots, 5, 'other years left out');
  assert.equal(y.streak, 4, '9/29..10/02');
  assert.equal(y.topFilm, 'grey-portra');
  assert.equal(y.days, 295, 'Jan 1 .. Oct 22');
  const oct = y.months[9];
  assert.equal(oct.shots, 3);
  assert.equal(oct.total, 31);
  assert.equal(oct.days, 22);
  assert.equal(oct.cover?.day, '2026-10-20', 'latest photo is the cover');
  assert.deepEqual(oct.dots.slice(0, 3).map((d) => d.state), ['shot', 'shot', 'missed']);
  assert.equal(oct.dots[21].state, 'today');
  assert.equal(oct.dots[22].state, 'future');
  assert.equal(oct.dots[0].film, 'golden-roll');
  assert.equal(y.months[1].total, 28);
  assert.equal(y.months[11].days, 0);
  assert.equal(yearLine(y), '295일 중 5장 · 최장 연속 4일 · 자주 나온 필름 Grey Portra');
  assert.equal(yearLine(yearSummary(2024, shots, '2026-10-22')), '아직 찍은 날이 없어요');
});

test('on this day: years back first, then a month back', () => {
  const days = echoDays('2026-10-23');
  assert.deepEqual(days[0], { day: '2025-10-23', label: '1년 전 오늘' });
  assert.equal(days[1].day, '2024-10-23');
  assert.deepEqual(days.at(-1), { day: '2026-09-23', label: '한 달 전 오늘' });
  // Feb 29 -> Feb 28 in common years, kept in leap years
  assert.equal(echoDays('2028-02-29')[0].day, '2027-02-28');
  assert.equal(echoDays('2028-02-29')[3].day, '2024-02-29');
  // January looks back to last December; Mar 31 has no Feb 31
  assert.equal(echoDays('2026-01-15').at(-1)?.day, '2025-12-15');
  assert.ok(!echoDays('2026-03-31').some((e) => e.label === '한 달 전 오늘'));
  const have = new Set(['2024-10-23', '2026-09-23']);
  assert.deepEqual(findEcho('2026-10-23', (d) => (have.has(d) ? d : null)), { label: '2년 전 오늘', shot: '2024-10-23' });
  assert.equal(findEcho('2026-10-23', () => null), null);
});

test('golden alerts move the day alert before sunset, else 18:00', async () => {
  const { dailyAlerts } = await import('../src/lib/remind.ts');
  const sunset = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, 40);
  const none = () => false;
  // off: plain 18:00 for the unshot days
  const off = dailyAlerts(new Date(2026, 9, 22, 9), new Set(['2026-10-23']), { golden: false, sunset, special: none });
  assert.equal(off[0].date.getHours(), 18);
  assert.equal(off.length, 6);
  assert.ok(off.every((a) => !a.golden));
  // on: 100 min before sunset (40 golden + 60 Android lateness) = 16:00
  const on = dailyAlerts(new Date(2026, 9, 22, 9), new Set(), { golden: true, sunset, special: none });
  assert.equal(on.length, 7);
  assert.equal(on[0].date.getHours(), 16);
  assert.equal(on[0].date.getMinutes(), 0);
  assert.match(on[0].body, /17:40/);
  // today's golden moment already past: today falls back to 18:00
  const late = dailyAlerts(new Date(2026, 9, 22, 16, 30), new Set(), { golden: true, sunset, special: none });
  assert.equal(late[0].golden, false);
  assert.equal(late[0].date.getHours(), 18);
  assert.equal(late[1].golden, true);
  // after 18:00 nothing more today
  assert.equal(dailyAlerts(new Date(2026, 9, 22, 19), new Set(), { golden: true, sunset, special: none })[0].date.getDate(), 23);
  // special day (Party Flash) and unknown sun: 18:00
  const sp = dailyAlerts(new Date(2026, 9, 22, 9), new Set(), { golden: true, sunset, special: (d) => d.getDate() === 22 });
  assert.equal(sp[0].golden, false);
  const polar = dailyAlerts(new Date(2026, 9, 22, 9), new Set(), { golden: true, sunset: () => null, special: none });
  assert.ok(polar.every((a) => !a.golden && a.date.getHours() === 18));
});

test('season alerts: 09:00 on the opening day, only while the book lacks the film', async () => {
  const { seasonAlerts } = await import('../src/lib/remind.ts');
  const a = seasonAlerts(new Date(2026, 9, 25, 20), new Set());
  assert.equal(a.length, 1);
  assert.equal(a[0].date.getDate(), 28);
  assert.equal(a[0].date.getHours(), 9);
  assert.match(a[0].body, /Autumn Maple/);
  assert.match(a[0].body, /11월 12일까지/);
  assert.equal(seasonAlerts(new Date(2026, 9, 25), new Set(['autumn-maple'])).length, 0);
  // the opening morning already past
  assert.equal(seasonAlerts(new Date(2026, 9, 28, 10), new Set()).length, 0);
  // too far off for the planning week
  assert.equal(seasonAlerts(new Date(2026, 9, 1), new Set()).length, 0);
  assert.match(seasonAlerts(new Date(2027, 2, 25), new Set())[0].body, /Spring Bloom/);
});

test('a season opening the forecast already announces is not repeated', async () => {
  const { seasonAlerts, withoutRepeats } = await import('../src/lib/remind.ts');
  const season = seasonAlerts(new Date(2026, 9, 25, 20), new Set());
  assert.equal(season.length, 1);
  const forecast = { date: new Date(2026, 9, 28, 8), body: 'x', film: 'autumn-maple' as const };
  assert.equal(withoutRepeats(season, forecast).length, 0);
  assert.equal(withoutRepeats(season, { ...forecast, film: 'rainy-mono' as const }).length, 1);
  assert.equal(withoutRepeats(season, { ...forecast, date: new Date(2026, 9, 29, 8) }).length, 1);
  assert.equal(withoutRepeats(season, null).length, 1);
});

test('no season-opening alert on a day already shot', async () => {
  const { seasonAlerts } = await import('../src/lib/remind.ts');
  assert.equal(seasonAlerts(new Date(2026, 9, 28, 7), new Set(), undefined, new Set(['2026-10-28'])).length, 0);
  assert.equal(seasonAlerts(new Date(2026, 9, 28, 7), new Set()).length, 1);
});

test('reminders put a running streak at stake from 3 days', async () => {
  const { dailyAlerts, emptyLine, runBefore } = await import('../src/lib/remind.ts');
  const days = new Set(['2026-10-22', '2026-10-23', '2026-10-24']);
  assert.equal(runBefore('2026-10-25', days), 3);
  assert.equal(runBefore('2026-10-26', days), 0);
  const opts = { golden: false, sunset: () => null, special: () => false };
  const a = dailyAlerts(new Date(2026, 9, 25, 9), days, opts);
  assert.equal(a[0].body, `${emptyLine('2026-10-25')} · 찍으면 연속 4일째`);
  assert.equal(a[1].body, emptyLine('2026-10-26'));
  const two = dailyAlerts(new Date(2026, 9, 25, 9), new Set(['2026-10-23', '2026-10-24']), opts);
  assert.equal(two[0].body, emptyLine('2026-10-25'));
});

test('the evening line changes by day and stays put for a day', async () => {
  const { emptyLine } = await import('../src/lib/remind.ts');
  const week = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'].map(emptyLine);
  assert.equal(new Set(week).size, 5);
  assert.equal(emptyLine('2026-10-20'), emptyLine('2026-10-20'));
});

test('evening reminder follows the usual shooting hour', async () => {
  const { reminderHour, dailyAlerts } = await import('../src/lib/remind.ts');
  const now = new Date(2026, 9, 25, 9);
  const at = (d: number, h: number) => ({ day: `2026-10-${String(d).padStart(2, '0')}`, takenAt: new Date(2026, 9, d, h, 10).getTime() });
  assert.equal(reminderHour([at(1, 19), at(2, 19)], now), 18);
  const evenings = [1, 2, 3, 4, 5, 6, 7].map((d) => at(d, 19));
  assert.equal(reminderHour(evenings, now), 20);
  assert.equal(reminderHour([1, 2, 3, 4, 5, 6, 7].map((d) => at(d, 8)), now), 17);
  assert.equal(reminderHour([1, 2, 3, 4, 5, 6, 7].map((d) => at(d, 23)), now), 21);
  // old photos don't count
  const old = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day: `2026-07-${String(d).padStart(2, '0')}`, takenAt: new Date(2026, 6, d, 22).getTime() }));
  assert.equal(reminderHour(old, now), 18);
  const a = dailyAlerts(now, new Set(), { golden: false, sunset: () => null, special: () => false, hour: 20 });
  assert.equal(a[0].date.getHours(), 20);
});

test('no fix: Seoul only on a Korean clock; sun guessed from the time zone', async () => {
  const { fallbackPlace, sunGuess } = await import('../src/lib/sun.ts');
  assert.deepEqual(fallbackPlace(-540), { lat: 37.5665, lon: 126.978 });
  assert.equal(fallbackPlace(0), null);
  // Tokyo shares UTC+9 with Seoul: the zone name decides when there is one
  assert.deepEqual(fallbackPlace(-540, 'Asia/Seoul'), { lat: 37.5665, lon: 126.978 });
  assert.equal(fallbackPlace(-540, 'Asia/Tokyo'), null);
  assert.deepEqual(sunGuess(-540, 'Asia/Tokyo'), { lat: 40, lon: 135 });
  assert.deepEqual(sunGuess(0), { lat: 40, lon: 0 });
  assert.deepEqual(sunGuess(300), { lat: 40, lon: -75 });
  assert.equal(sunGuess(-540).lon, 126.978);
});

test("only today's sun times from the forecast are used", async () => {
  const { todaysSun } = await import('../src/lib/weather.ts');
  const now = new Date(2026, 9, 26, 16, 55);
  const today = { sunrise: new Date(2026, 9, 26, 6, 50), sunset: new Date(2026, 9, 26, 17, 42) };
  assert.deepEqual(todaysSun(today, now), today);
  // yesterday's sunset would make the whole afternoon 'after dark'
  assert.equal(todaysSun({ sunrise: new Date(2026, 9, 25, 6, 49), sunset: new Date(2026, 9, 25, 17, 43) }, now), null);
  assert.equal(todaysSun({ sunrise: null, sunset: null }, now), null);
  assert.equal(todaysSun(null, now), null);
});

test('a fixed reminder hour from Settings wins over the automatic one', async () => {
  const { pickedHour } = await import('../src/lib/remind.ts');
  assert.equal(pickedHour('', 19), 19);
  assert.equal(pickedHour('21', 19), 21);
  assert.equal(pickedHour('22', 19), 19);
  assert.equal(pickedHour('3', 19), 19);
  assert.equal(pickedHour('x', 19), 19);
});

test('the optional last call comes at 22:00 on unshot days, not after a late evening alert', async () => {
  const { dailyAlerts } = await import('../src/lib/remind.ts');
  const opts = { golden: false, sunset: () => null, special: () => false, lastCall: true };
  const a = dailyAlerts(new Date(2026, 9, 25, 19), new Set(['2026-10-26']), opts);
  // today: the 18:00 one has passed, the 23:00 one is still ahead; tomorrow is shot
  assert.equal(a[0].date.getHours(), 22);
  assert.equal(a[0].date.getDate(), 25);
  assert.ok(a.every((x) => x.date.getDate() !== 26));
  assert.equal(dailyAlerts(new Date(2026, 9, 25, 19), new Set(), { ...opts, lastCall: false }).filter((x) => x.date.getHours() === 22).length, 0);
  // an evening alert at 21:00 already sits next to it
  assert.equal(dailyAlerts(new Date(2026, 9, 25, 9), new Set(), { ...opts, hour: 21 }).filter((x) => x.date.getHours() === 22).length, 0);
});

test("the evening reminder names an earlier year's print on the same date", async () => {
  const { dailyAlerts } = await import('../src/lib/remind.ts');
  const echo = (d: string) => (d === '2026-10-24' ? { label: '1년 전 오늘', film: 'Golden Roll' } : null);
  const alerts = dailyAlerts(new Date(2026, 9, 23, 9), new Set(), { golden: false, sunset: () => null, special: () => false, echo });
  const by = (d: string) => alerts.find((a) => a.date.getDate() === Number(d.slice(8)))!.body;
  assert.equal(by('2026-10-24'), '1년 전 오늘엔 Golden Roll · 오늘 칸은 아직 비어 있어요');
  assert.doesNotMatch(by('2026-10-23'), /1년 전/);
});
