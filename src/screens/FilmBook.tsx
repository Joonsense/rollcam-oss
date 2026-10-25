// The film book: one slot per film. A loaded film shows its latest
// print, how many times it came and when it first did; one still to come shows
// only its tint and the kind of day that brings it. Tapping a print opens
// every photo shot on that film.

import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FILM_NAMES, filmHint, seasonWait, type FilmId } from '../lib/film';
import type { FilmBook as Book } from '../lib/filmbook';
import type { Shot } from '../lib/store';
import { thumbUri } from '../lib/thumbs';
import { C, FILM_TINT, MONO } from '../ui/theme';
import { count, tr } from '../lib/i18n';
import FilmSheet from './FilmSheet';
import WeekStrip from './WeekStrip';
import { useFilmSample } from '../lib/filmSample';
import { lastPlace } from '../lib/conditions';

/** A missing film's sample print, faint and soft behind its mark: what it would look like. */
function Ghost({ film }: { film: FilmId }) {
  const { uri } = useFilmSample(film);
  return uri ? <Image source={{ uri }} style={[StyleSheet.absoluteFill, { opacity: 0.22 }]} blurRadius={3} resizeMethod="resize" /> : null;
}

const COLS = 3;
const GAP = 8;
const PAD = 14;

type Props = { book: Book<Shot>; today: string; bottom: number; onOpen: (shots: Shot[]) => void };

export default function FilmBook({ book, today, bottom, onOpen }: Props) {
  const { width } = useWindowDimensions();
  const card = Math.floor((width - PAD * 2 - GAP * (COLS - 1)) / COLS);
  const cover = Math.round((card - 16) * 1.25);
  // a film's page; tapping any slot opens it
  const [detail, setDetail] = useState<FilmId | null>(null);
  // seasons follow the hemisphere of the last known city
  const [lat] = useState(() => lastPlace()?.lat ?? null);
  const total = book.entries.reduce((n, e) => n + e.shots.length, 0);
  const collected = useMemo(() => new Set(book.entries.filter((e) => e.first).map((e) => e.film)), [book]);
  const detailShots = book.entries.find((e) => e.film === detail)?.shots ?? [];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: bottom }}>
      <WeekStrip today={today} lat={lat} collected={collected} onPick={setDetail} />
      <View style={[s.grid, { gap: GAP }]}>
        {book.entries.map((e) => {
          const tint = FILM_TINT[e.film];
          const last = e.shots[e.shots.length - 1];
          if (!last) {
            // seasonal films count down to their window instead of a bare '?'
            const wait = seasonWait(e.film, today, lat);
            const mark = wait ? (wait.open ? tr('지금', 'Now', 'いま') : `D-${wait.days}`) : '?';
            const when = wait
              ? wait.open
                ? tr(`지금 시즌 · ${wait.until.replace('-', '.')}까지`, `In season · until ${wait.until.replace('-', '.')}`, `シーズン中 · ${wait.until.replace('-', '.')}まで`)
                : tr(`${wait.from.replace('-', '.')}부터 시즌`, `Season from ${wait.from.replace('-', '.')}`, `${wait.from.replace('-', '.')}からシーズン`)
              : null;
            return (
              <Pressable key={e.film} onPress={() => setDetail(e.film)} style={[s.card, { width: card }]} accessibilityRole="button" accessibilityLabel={`${FILM_NAMES[e.film]}, ${tr('아직 안 들어온 필름', 'not loaded yet', 'まだ来ていないフィルム')}, ${when ? `${when}, ` : ''}${filmHint(e.film)}`}>
                <View style={[s.cover, s.locked, { height: cover, borderColor: tint }]}>
                  <Ghost film={e.film} />
                  <Text style={[s.q, wait && s.qSeason, { color: tint }]}>{mark}</Text>
                  {when ? <Text style={[s.when, { color: tint }]}>{when}</Text> : null}
                </View>
                <View style={s.nameRow}>
                  <View style={[s.chip, { borderColor: tint }]} />
                  <Text style={[s.name, s.nameDim]} numberOfLines={1}>
                    {FILM_NAMES[e.film]}
                  </Text>
                </View>
                <Text style={s.sub} numberOfLines={2}>
                  {filmHint(e.film)}
                </Text>
              </Pressable>
            );
          }
          const fresh = e.first === today;
          return (
            <Pressable
              key={e.film}
              onPress={() => setDetail(e.film)}
              style={({ pressed }) => [s.card, { width: card }, pressed && { opacity: 0.8 }]}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${FILM_NAMES[e.film]}, ${count(e.shots.length, '장', 'photo')}${fresh ? tr(', 오늘 처음 들어온 필름', ', first loaded today', '、今日はじめて来たフィルム') : ''}`}
            >
              <View style={[s.cover, { height: cover }]}>
                <Image source={{ uri: thumbUri(last.file) }} style={s.coverImg} resizeMethod="resize" />
                {fresh ? (
                  <View style={s.new}>
                    <Text style={s.newText}>NEW</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.nameRow}>
                <View style={[s.chip, { backgroundColor: tint, borderColor: tint }]} />
                <Text style={s.name} numberOfLines={1}>
                  {FILM_NAMES[e.film]}
                </Text>
              </View>
              <Text style={s.sub} numberOfLines={2}>
                {count(e.shots.length, '장', 'photo')} · {tr('첫 장', 'first', '初回')} {e.first!.slice(2).replaceAll('-', '.')}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FilmSheet
        film={detail}
        shots={detailShots}
        total={total}
        today={today}
        lat={lat}
        onClose={() => setDetail(null)}
        onOpen={(list) => {
          setDetail(null);
          onOpen(list);
        }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { backgroundColor: C.panel, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.edge },
  cover: { backgroundColor: C.strip, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  coverImg: { width: '100%', height: '100%' },
  locked: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', opacity: 0.55 },
  q: { fontFamily: MONO, fontSize: 26, fontWeight: '700' },
  qSeason: { fontSize: 20 },
  when: { fontSize: 9.5, marginTop: 4, textAlign: 'center', paddingHorizontal: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chip: { width: 7, height: 7, borderRadius: 1.5, borderWidth: 1 },
  name: { color: C.text, fontFamily: MONO, fontSize: 10.5, fontWeight: '700', flexShrink: 1 },
  nameDim: { color: C.dim },
  sub: { color: C.dim, fontSize: 10, marginTop: 3, lineHeight: 14 },
  new: { position: 'absolute', top: 5, right: 5, backgroundColor: C.safelight, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  newText: { color: C.bg, fontFamily: MONO, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
});
