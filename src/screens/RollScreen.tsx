import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addMonths, dayKey, monthKey } from '../lib/day';
import { FILM_NAMES } from '../lib/film';
import { allShots, firstShotYear, getSetting, monthShots, setSetting, yearShots, type Shot } from '../lib/store';
import { coverKey, withCovers } from '../lib/covers';
import { bookLine, filmBook } from '../lib/filmbook';
import { isLucky, luckyCount, luckyLine } from '../lib/lucky';
import { FILM_FOCUS } from '../lib/links';
import { memoLines } from '../lib/memo';
import { missedFilm } from '../lib/missed';
import { thumbUri, useThumbs } from '../lib/thumbs';
import { monthStats, statsLine, yearLine, yearRecap, yearSummary } from '../lib/stats';
import { monthStrip, type Frame } from '../lib/strip';
import { lastPlace, monthSky } from '../lib/conditions';
import { composeDiary, composeRoll, composeYear, shareRoll } from '../lib/share';
import { composeBook } from '../lib/bookShare';
import { composeYearGif, shareRollGif } from '../lib/rollGif';
import { skyColor, skyWord, type DaySky } from '../lib/sky';
import { count, monthDay, monthLong, monthShort, tr, type Lang } from '../lib/i18n';
import FilmBook from './FilmBook';
import PhotoViewer from './PhotoViewer';
import RollPlayer from './RollPlayer';
import FilmMixBar from './FilmMixBar';
import TempLine from './TempLine';
import LinesScreen from './LinesScreen';
import SettingsSheet from './SettingsSheet';
import YearView from './YearView';
import { C, FILM_TINT, MONO } from '../ui/theme';

const COLS = 6;

/** Perforation band with the edge printing real film carries: stock code and frame number. */
function Sprockets({ label, frame }: { label?: string; frame?: number }) {
  return (
    <View style={s.sprockets} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {label ? <Text style={s.edge}>{label}</Text> : null}
      {Array.from({ length: COLS * 2 - (label ? 4 : 0) - (frame ? 2 : 0) }, (_, i) => (
        <View key={i} style={s.hole} />
      ))}
      {frame ? <Text style={s.edge}>{`▸ ${frame}`}</Text> : null}
    </View>
  );
}

/** `focus` jumps the roll to a month or a year (from the roll-developed and year-end cards), or the film book (FILM_FOCUS, a launcher shortcut). */
export default function RollScreen({ version, focus, onRestored, onLang }: { version: number; focus?: string | null; onRestored: () => void; onLang: (l: Lang) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const thisMonth = monthKey(new Date());
  // '@<time>' after a month makes a repeat tap (the month widget) a new focus
  const target = focus?.split('@')[0] ?? null;
  const focusYear = target?.length === 4;
  const focusFilm = !!target?.startsWith(FILM_FOCUS);
  const [month, setMonth] = useState(target && !focusYear && !focusFilm ? target : thisMonth);
  const [mode, setMode] = useState<'month' | 'year' | 'film'>(focusFilm ? 'film' : focusYear ? 'year' : 'month');
  const thisYear = Number(thisMonth.slice(0, 4));
  const [year, setYear] = useState(focusYear ? Number(target) : thisYear);
  const [focused, setFocused] = useState(focus);
  if (focus && target && focus !== focused) {
    // adjust state during render when a card asks for another month ('YYYY-MM') or year ('YYYY')
    setFocused(focus);
    if (target.startsWith(FILM_FOCUS)) setMode('film');
    else if (target.length === 4) {
      setYear(Number(target));
      setMode('year');
    } else {
      setMonth(target);
      setMode('month');
    }
  }
  const [open, setOpen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [allLines, setAllLines] = useState(false);
  // the film book opens one film's photos, across months
  const [filmShots, setFilmShots] = useState<Shot[] | null>(null);
  const [sky, setSky] = useState<Record<string, DaySky>>({});
  const [missed, setMissed] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const today = dayKey(new Date());

  // Swipe the strip sideways to wind to the next/previous month; it slides in from that side.
  const [slide] = useState(() => new Animated.Value(0));
  const go = useCallback(
    (n: number) => {
      const next = addMonths(month, n);
      if (next > thisMonth) return;
      setMonth(next);
      slide.setValue(n * 60);
      Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    },
    [month, thisMonth, slide],
  );
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => {
          if (g.dx < -60) go(1);
          else if (g.dx > 60) go(-1);
        },
      }),
    [go],
  );

  useEffect(() => {
    let live = true;
    monthSky(month, today).then((d) => live && setSky(d));
    return () => {
      live = false;
    };
  }, [month, today]);

  // `version` bumps after a new shot so the roll re-reads storage
  const shots = useMemo(() => monthShots(month), [month, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const byDay = useMemo(() => new Map(shots.map((x) => [x.day, x])), [shots]);
  const frames = useMemo(() => monthStrip(month, new Set(byDay.keys()), today), [month, byDay, today]);
  const line = useMemo(() => statsLine(monthStats(month, shots, today)), [month, shots, today]);
  const lines = useMemo(() => memoLines(shots), [shots]);
  useThumbs(useMemo(() => shots.map((x) => x.file), [shots]));
  // a picked month cover (photo viewer '이 달 표지로'); bumps re-read the picks
  const [coverRun, setCoverRun] = useState(0);
  const coverPick = useMemo(() => getSetting(coverKey(month), ''), [month, coverRun, version]); // eslint-disable-line react-hooks/exhaustive-deps
  // the year's photos for the temperature line, read once per year/version
  const yearShotsList = useMemo(() => (mode === 'year' ? yearShots(year) : []), [mode, year, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const yearData = useMemo(() => {
    if (mode !== 'year') return null;
    const ys = yearShotsList;
    return withCovers(yearSummary(year, ys, today), ys, (m) => getSetting(coverKey(m), ''));
  }, [mode, year, today, yearShotsList, coverRun]); // eslint-disable-line react-hooks/exhaustive-deps

  const book = useMemo(() => (mode === 'film' ? filmBook(allShots()) : null), [mode, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const luckyN = useMemo(() => (mode === 'film' ? luckyCount(allShots()) : 0), [mode, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstYear = useMemo(() => firstShotYear() ?? thisYear, [thisYear, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const toYear = () => {
    setYear(Number(month.slice(0, 4)));
    setMode('year');
  };
  const pickMonth = (mo: string) => {
    setMonth(mo);
    setMode('month');
  };
  const modes = (
    <View style={s.seg} accessibilityRole="tablist">
      {(['month', 'year', 'film'] as const).map((k) => (
        <Pressable key={k} onPress={() => (k === 'year' ? toYear() : setMode(k))} style={[s.segItem, mode === k && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === k }}>
          <Text style={[s.segText, mode === k && s.segTextOn]}>{k === 'month' ? tr('달', 'Month', '月') : k === 'year' ? tr('한 해', 'Year', '年') : tr('필름', 'Films', 'フィルム')}</Text>
        </Pressable>
      ))}
    </View>
  );

  const shareYear = async () => {
    if (!yearData) return;
    setSharing(true);
    setNote(null);
    try {
      await shareRoll(await composeYear(yearData, yearRecap(yearData, yearShotsList), yearShotsList));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  // the year's month covers as a looping GIF; 0..1 while drawing
  const [yearGif, setYearGif] = useState<number | null>(null);
  const shareYearGif = async () => {
    if (!yearData || yearGif !== null) return;
    setYearGif(0);
    setNote(null);
    try {
      await shareRollGif(await composeYearGif(year, yearData.months, setYearGif));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setYearGif(null);
    }
  };

  const shareBook = async () => {
    if (!book) return;
    setSharing(true);
    setNote(null);
    try {
      await shareRoll(await composeBook(book, today, lastPlace()?.lat));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const shareDiary = async () => {
    setSharing(true);
    setNote(null);
    try {
      await shareRoll(await composeDiary(month, shots));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const doShare = async () => {
    setSharing(true);
    setNote(null);
    try {
      await shareRoll(await composeRoll(month, shots, sky, today));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const gap = 6;
  const pad = 14;
  // strip has 6px side padding + 1px border on each side
  const cell = Math.floor((width - pad * 2 - 14 - gap * (COLS - 1)) / COLS);
  const rows = Array.from({ length: frames.length / COLS }, (_, r) => frames.slice(r * COLS, r * COLS + COLS));
  const [y, m] = month.split('-');

  const renderFrame = (f: Frame) => {
    const box = { width: cell, height: cell * 1.32 };
    if (f.kind === 'leader') return <View key={f.index} style={[s.frame, box, s.leader]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
    const d = Number(f.day.slice(8));
    const shot = byDay.get(f.day);
    if (shot) {
      return (
        <Pressable key={f.index} style={[s.frame, box]} onPress={() => setOpen(shots.indexOf(shot))} accessibilityRole="imagebutton" accessibilityLabel={`${monthDay(Number(m), d)}, ${FILM_NAMES[shot.film]}${isLucky(shot.takenAt) ? tr(', 럭키 컷', ', lucky frame', '、ラッキーカット') : ''}${shot.memo ? `, ${shot.memo}` : ''}`}>
          <Image source={{ uri: thumbUri(shot.file) }} style={s.thumb} resizeMethod="resize" />
          {shot.memo ? <View style={s.memoMark} /> : null}
          {isLucky(shot.takenAt) ? <Text style={s.luckyMark}>✦</Text> : null}
        </Pressable>
      );
    }
    if (f.state === 'missed') {
      const k = sky[f.day];
      return (
        <Pressable key={f.index} onPress={() => setMissed(f.day)} style={[s.frame, box, { backgroundColor: skyColor(k?.code, k?.tempMax) }]} accessibilityRole="button" accessibilityLabel={`${monthDay(Number(m), d)}, ${tr('찍지 않은 날', 'not shot', '撮らなかった日')}${k ? `, ${skyWord(k.code)}` : ''}`}>
          <Text maxFontSizeMultiplier={1.3} style={[s.num, s.numOnSky]}>{d}</Text>
        </Pressable>
      );
    }
    return (
      <View key={f.index} style={[s.frame, box, f.state === 'today' && s.todayFrame]} accessible accessibilityLabel={`${monthDay(Number(m), d)}${f.state === 'today' ? tr(', 오늘, 아직 안 찍음', ', today, not shot yet', '、今日、まだ撮っていない') : ''}`}>
        <Text maxFontSizeMultiplier={1.3} style={[s.num, f.state === 'today' && { color: C.safelight }]}>{d}</Text>
      </View>
    );
  };

  return (
    <View style={[s.fill, { paddingTop: insets.top + 8 }]}>
      {mode === 'film' ? (
        <>
          <View style={s.header}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.kicker}>FILM BOOK</Text>
              <Text style={s.month}>{tr('필름 도감', 'Film book', 'フィルム図鑑')}</Text>
            </View>
          </View>
          <Text style={s.stats}>{book ? [bookLine(book), luckyLine(luckyN)].filter(Boolean).join(' · ') : ''}</Text>
          <View style={s.actions}>
            {modes}
            <Pressable
              onPress={shareBook}
              disabled={sharing || !book?.found}
              style={[s.action, !book?.found && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityHint={tr('도감을 스토리 크기 이미지 한 장으로 공유해요', 'Shares your film book as one story-size image', '図鑑をストーリーサイズの画像一枚で共有します')}
              accessibilityState={{ disabled: sharing || !book?.found, busy: sharing }}
            >
              {sharing ? <ActivityIndicator color={C.bg} /> : <Text style={s.actionText}>{tr('도감 공유', 'Share book', '図鑑を共有')}</Text>}
            </Pressable>
          </View>
          {note ? <Text style={s.note}>{note}</Text> : null}
          {book ? <FilmBook book={book} today={today} bottom={insets.bottom + 100} onOpen={setFilmShots} /> : null}
        </>
      ) : mode === 'year' ? (
        <>
          <View style={s.header}>
            <Pressable hitSlop={16} disabled={year <= firstYear} onPress={() => setYear(year - 1)} accessibilityRole="button" accessibilityLabel={tr('지난 해', 'Previous year', '前の年')} accessibilityState={{ disabled: year <= firstYear }}>
              <Text style={[s.arrow, year <= firstYear && { color: C.faint }]}>‹</Text>
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.kicker}>ROLLS</Text>
              <Text style={s.month}>{tr(`${year}년`, String(year), `${year}年`)}</Text>
            </View>
            <Pressable hitSlop={16} disabled={year >= thisYear} onPress={() => setYear(year + 1)} accessibilityRole="button" accessibilityLabel={tr('다음 해', 'Next year', '次の年')} accessibilityState={{ disabled: year >= thisYear }}>
              <Text style={[s.arrow, year >= thisYear && { color: C.faint }]}>›</Text>
            </Pressable>
          </View>
          <Text style={s.stats}>{yearData ? yearLine(yearData) : ''}</Text>
          {yearData?.shots ? (
            <Pressable onPress={shareYearGif} disabled={yearGif !== null} hitSlop={8} style={s.yearGif} accessibilityRole="button" accessibilityHint={tr('12달 표지를 움직이는 GIF 로 공유해요', 'Shares the month covers as a looping GIF', '12か月の表紙を動くGIFで共有します')}>
              <Text style={s.yearGifText}>{yearGif !== null ? `GIF ${Math.round(yearGif * 100)}%` : tr('12달 GIF 공유 ↗', 'Share 12-month GIF ↗', '12か月GIFを共有 ↗')}</Text>
            </Pressable>
          ) : null}
          <FilmMixBar shots={yearData ? yearData.months.flatMap((mo) => mo.dots.flatMap((d) => (d.film ? [{ film: d.film }] : []))) : []} />
          {yearData?.shots ? <TempLine year={year} shots={yearShotsList} /> : null}
          <View style={s.actions}>
            {modes}
            <Pressable
              onPress={shareYear}
              disabled={sharing || !yearData?.shots}
              style={[s.action, !yearData?.shots && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityHint={tr('한 해를 스토리 크기 이미지 한 장으로 공유해요', 'Shares the year as one story-size image', '一年をストーリーサイズの画像一枚で共有します')}
              accessibilityState={{ disabled: sharing || !yearData?.shots, busy: sharing }}
            >
              {sharing ? <ActivityIndicator color={C.bg} /> : <Text style={s.actionText}>{year === thisYear ? tr('올해의 롤 공유', 'Share year', '今年を共有') : tr(`${year} 롤 공유`, `Share ${year}`, `${year}年を共有`)}</Text>}
            </Pressable>
          </View>
          {note ? <Text style={s.note}>{note}</Text> : null}
          {yearData ? <YearView data={yearData} bottom={insets.bottom + 100} onPick={pickMonth} /> : null}
        </>
      ) : (
        <>
          <View style={s.header}>
            <Pressable hitSlop={16} onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel={tr('지난 달', 'Previous month', '前の月')}>
              <Text style={s.arrow}>‹</Text>
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.kicker}>ROLL {y}</Text>
              <Text style={s.month}>{monthLong(Number(m))}</Text>
            </View>
            <Pressable hitSlop={16} disabled={month >= thisMonth} onPress={() => go(1)} accessibilityRole="button" accessibilityLabel={tr('다음 달', 'Next month', '次の月')} accessibilityState={{ disabled: month >= thisMonth }}>
              <Text style={[s.arrow, month >= thisMonth && { color: C.faint }]}>›</Text>
            </Pressable>
          </View>
          <Text style={s.count}>
            {shots.length} / {frames.filter((f) => f.kind === 'day').length}{tr(' 장', '', ' 枚')}
          </Text>
          {/* always one line tall so the strip doesn't jump between months */}
          <Text style={s.stats}>{line || (month < thisMonth && shots.length === 0 ? tr('찍은 날이 없는 달 · 하늘 색으로만 남았어요', 'No photos this month · only the sky colors remain', '撮った日のない月 · 空の色だけが残りました') : ' ')}</Text>
          <FilmMixBar shots={shots} />
          <View style={s.actions}>
            {modes}
            <Pressable onPress={doShare} disabled={sharing || shots.length === 0} style={[s.action, shots.length === 0 && { opacity: 0.4 }]} accessibilityRole="button" accessibilityState={{ disabled: sharing || shots.length === 0, busy: sharing }}>
              {sharing ? <ActivityIndicator color={C.bg} /> : <Text style={s.actionText}>{month === thisMonth ? tr('이번 달 롤 공유', 'Share roll', 'ロールを共有') : tr(`${Number(m)}월 롤 공유`, `Share ${monthShort(Number(m))}`, `${Number(m)}月を共有`)}</Text>}
            </Pressable>
            <Pressable onPress={() => setSettings(true)} style={s.actionGhost} hitSlop={8} accessibilityRole="button">
              <Text style={s.actionGhostText}>{tr('설정', 'Settings', '設定')}</Text>
            </Pressable>
          </View>
          {note ? <Text style={s.note}>{note}</Text> : null}

          <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 100 }} {...swipe.panHandlers}>
            <Animated.View style={[s.strip, { opacity: slide.interpolate({ inputRange: [-60, 0, 60], outputRange: [0.2, 1, 0.2] }), transform: [{ translateX: slide }] }]}>
              {rows.map((row, i) => (
                <View key={i}>
                  <Sprockets label={i % 2 === 0 ? 'ROLLCAM 400' : undefined} frame={i * COLS + 1} />
                  <View style={[s.row, { gap }]}>{row.map(renderFrame)}</View>
                </View>
              ))}
              <Sprockets />
            </Animated.View>
            {shots.length >= 2 ? (
              <Pressable onPress={() => setPlaying(true)} style={s.play} accessibilityRole="button" accessibilityLabel={tr(`${Number(m)}월 롤 재생, ${shots.length}장`, `Play the ${monthLong(Number(m))} roll, ${count(shots.length, '장', 'photo')}`, `${Number(m)}月のロールを再生、${shots.length}枚`)}>
                <Text style={s.playText}>{tr(`▶ 롤 재생 · ${shots.length}장`, `▶ Play roll · ${count(shots.length, '장', 'photo')}`, `▶ ロール再生 · ${shots.length}枚`)}</Text>
              </Pressable>
            ) : null}
            {lines.length ? (
              <View style={s.lines}>
                <View style={s.linesTop}>
                  <Text style={s.linesHead}>{tr('이 달의 한 줄', "This month's lines", '今月の一行')}</Text>
                  <Pressable onPress={() => setAllLines(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('모든 한 줄 모아 보기', 'See all your lines', 'すべての一行をまとめて見る')}>
                    <Text style={s.linesAll}>{tr('모아 보기', 'All lines', 'まとめて見る')}</Text>
                  </Pressable>
                  <Pressable onPress={shareDiary} disabled={sharing} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('이 달의 한 줄 공유', "Share this month's lines", '今月の一行を共有')} accessibilityHint={tr('한 줄들을 스토리 크기 이미지 한 장으로 공유해요', 'Shares the lines as one story-size image', '一行をストーリーサイズの画像一枚で共有します')}>
                    <Text style={s.linesShare}>{tr('한 줄 공유 ↗', 'Share lines ↗', '一行を共有 ↗')}</Text>
                  </Pressable>
                </View>
                {lines.map((l) => (
                  <Pressable key={l.day} onPress={() => setOpen(l.index)} style={s.lineRow} accessibilityRole="button" accessibilityLabel={`${monthDay(Number(m), Number(l.day.slice(8)))}, ${l.memo}`}>
                    <Text style={s.lineDay}>{l.day.slice(5).replace('-', '.')}</Text>
                    <View style={[s.lineChip, { backgroundColor: FILM_TINT[shots[l.index].film] }]} />
                    <Text style={s.lineText}>{l.memo}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </>
      )}

      <PhotoViewer
        shots={shots}
        start={open}
        onClose={() => setOpen(null)}
        isCover={(x) => x.day === (shots.some((y) => y.day === coverPick) ? coverPick : shots[shots.length - 1]?.day)}
        onCover={(x) => {
          setSetting(coverKey(month), x.day);
          setCoverRun((n) => n + 1);
        }}
      />
      <RollPlayer month={month} shots={shots} open={playing} onClose={() => setPlaying(false)} />
      <LinesScreen open={allLines} onClose={() => setAllLines(false)} />
      <PhotoViewer shots={filmShots ?? []} start={filmShots ? filmShots.length - 1 : null} onClose={() => setFilmShots(null)} />

      <Modal visible={!!missed} transparent animationType="fade" onRequestClose={() => setMissed(null)}>
        <Pressable style={s.modal} onPress={() => setMissed(null)}>
          {missed ? (
            <View style={[s.missedCard, { backgroundColor: skyColor(sky[missed]?.code, sky[missed]?.tempMax) }]}>
              <Text style={s.missedDate}>{missed.replaceAll('-', '.')}</Text>
              <Text style={s.missedWord}>{skyWord(sky[missed]?.code) || tr('기록 없는 날', 'No record', '記録のない日')}</Text>
              {(() => {
                const f = missedFilm(missed, sky[missed]?.code, sky[missed]?.tempMax, getSetting('birthday', '') || null, lastPlace()?.lat);
                return f ? (
                  <View style={s.missedFilm}>
                    <View style={[s.missedChip, { backgroundColor: FILM_TINT[f] }]} />
                    <Text style={s.missedFilmText}>{tr(`그날 한낮에 찍었다면 ${FILM_NAMES[f]}`, `At midday it would have been ${FILM_NAMES[f]}`, `その日の昼に撮っていたら ${FILM_NAMES[f]}`)}</Text>
                  </View>
                ) : null;
              })()}
              <Text style={s.missedNote}>{tr('찍지 않은 날은 그날 하늘 색으로 남아요', 'A day without a photo keeps the color of its sky', '撮らなかった日は、その日の空の色で残ります')}</Text>
            </View>
          ) : null}
        </Pressable>
      </Modal>

      <SettingsSheet visible={settings} onClose={() => setSettings(false)} onRestored={onRestored} onLang={onLang} />
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 8 },
  arrow: { color: C.text, fontSize: 34, lineHeight: 36 },
  kicker: { color: C.safelight, fontFamily: MONO, fontSize: 11, letterSpacing: 3 },
  month: { color: C.text, fontSize: 26, fontWeight: '700' },
  count: { color: C.dim, textAlign: 'center', fontFamily: MONO, fontSize: 12, marginBottom: 12 },
  stats: { color: C.dim, textAlign: 'center', fontSize: 12, marginTop: -6, marginBottom: 12, opacity: 0.85 },
  strip: { backgroundColor: '#1C130C', borderRadius: 6, paddingHorizontal: 6, borderWidth: 1, borderColor: '#3A2717' },
  sprockets: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 5 },
  hole: { width: 9, height: 6, borderRadius: 1.5, backgroundColor: C.bg, borderWidth: 0.5, borderColor: '#4A3220' },
  edge: { color: 'rgba(255,154,60,0.7)', fontFamily: MONO, fontSize: 7.5, letterSpacing: 1 },
  row: { flexDirection: 'row' },
  frame: { backgroundColor: C.panel, borderRadius: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  leader: { backgroundColor: '#2E1C10', opacity: 0.7 },
  todayFrame: { borderWidth: 1.5, borderColor: C.safelight, borderStyle: 'dashed' },
  num: { color: C.faint, fontFamily: MONO, fontSize: 12 },
  numOnSky: { color: 'rgba(14,13,12,0.55)' },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 12 },
  action: { backgroundColor: C.safelight, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, minWidth: 120, alignItems: 'center' },
  seg: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: C.edge, padding: 2 },
  segItem: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  segOn: { backgroundColor: C.text },
  segText: { color: C.dim, fontSize: 12, fontWeight: '600' },
  segTextOn: { color: C.bg },
  actionText: { color: C.bg, fontWeight: '700', fontSize: 13 },
  actionGhost: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.edge },
  actionGhostText: { color: C.text, fontSize: 13 },
  note: { color: C.safelight, textAlign: 'center', fontSize: 12, marginBottom: 8 },
  missedCard: { width: '78%', aspectRatio: 0.76, borderRadius: 6, padding: 22, justifyContent: 'flex-end' },
  missedDate: { color: 'rgba(14,13,12,0.6)', fontFamily: MONO, fontSize: 13 },
  missedWord: { color: '#0E0D0C', fontSize: 30, fontWeight: '700', marginTop: 4 },
  missedFilm: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(14,13,12,0.72)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  missedChip: { width: 8, height: 8, borderRadius: 2 },
  missedFilmText: { color: '#F2ECE4', fontSize: 12 },
  missedNote: { color: 'rgba(14,13,12,0.6)', fontSize: 12, marginTop: 10 },
  thumb: { width: '100%', height: '100%' },
  play: { alignSelf: 'center', marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.safelight },
  playText: { color: C.safelight, fontSize: 13, fontWeight: '700' },
  luckyMark: { position: 'absolute', left: 4, top: 1, color: '#FFC86B', fontSize: 11, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3 },
  memoMark: { position: 'absolute', right: 3, bottom: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: C.safelight, borderWidth: 1, borderColor: 'rgba(14,13,12,0.6)' },
  lines: { marginTop: 18, paddingHorizontal: 4 },
  linesTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  linesHead: { color: C.dim, fontSize: 11, letterSpacing: 2 },
  yearGif: { alignSelf: 'center', marginTop: -6, marginBottom: 10 },
  yearGifText: { color: C.safelight, fontSize: 12, fontWeight: '700' },
  linesAll: { color: C.dim, fontSize: 12, marginLeft: 'auto', marginRight: 14 },
  linesShare: { color: C.safelight, fontSize: 12, fontWeight: '700' },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.edge },
  lineDay: { color: C.dim, fontFamily: MONO, fontSize: 12, width: 40, lineHeight: 19 },
  lineChip: { width: 7, height: 7, borderRadius: 1.5, marginTop: 6 },
  lineText: { flex: 1, color: C.text, fontSize: 14, lineHeight: 19 },
  modal: { flex: 1, backgroundColor: 'rgba(8,7,6,0.96)', alignItems: 'center', justifyContent: 'center', padding: 20 },
});
