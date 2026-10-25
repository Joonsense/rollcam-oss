// "이번 주 필름 예보" over the film book: seven days, each with the film its
// midday forecast would load (lib/weekOutlook.ts). A film missing from the
// book is marked ✦; tapping a day opens that film's page.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { weekOutlook } from '../lib/conditions';
import { FILM_NAMES, firstSnowDue, type FilmId } from '../lib/film';
import { tr } from '../lib/i18n';
import { allShots, getSetting } from '../lib/store';
import { weekFilms, type WeekFilm } from '../lib/weekOutlook';
import { C, FILM_TINT, MONO } from '../ui/theme';

const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];

const weekday = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  const i = new Date(y, m - 1, d).getDay();
  return tr(WEEK_KO[i], WEEK_EN[i], WEEK_JA[i]);
};

type Props = { today: string; lat: number | null; collected: Set<FilmId>; onPick: (film: FilmId) => void };

export default function WeekStrip({ today, lat, collected, onPick }: Props) {
  const [films, setFilms] = useState<WeekFilm[] | null>(null);
  useEffect(() => {
    let live = true;
    weekOutlook().then((week) => {
      if (!live || !week) return;
      setFilms(weekFilms(week, { birthday: getSetting('birthday', '') || null, lat, firstSnow: firstSnowDue(today, allShots(), lat) }));
    });
    return () => {
      live = false;
    };
  }, [today, lat]);
  if (!films?.length) return null;
  const fresh = films.some((f) => !collected.has(f.film));

  return (
    <View style={s.box}>
      <Text maxFontSizeMultiplier={1.3} style={s.head}>{tr('이번 주 필름 예보', "This week's films", '今週のフィルム予報')}</Text>
      <View style={s.row}>
        {films.map((f) => {
          const isNew = !collected.has(f.film);
          return (
            <Pressable
              key={f.day}
              onPress={() => onPick(f.film)}
              style={s.day}
              accessibilityRole="button"
              accessibilityLabel={`${weekday(f.day)} ${f.day.slice(5).replace('-', '.')}, ${FILM_NAMES[f.film]}${isNew ? tr(', 도감에 없는 필름', ', missing from your book', '、図鑑にないフィルム') : ''}`}
            >
              <Text maxFontSizeMultiplier={1.3} style={[s.wd, isNew && { color: C.safelight }]}>{weekday(f.day)}</Text>
              <View style={[s.dot, { backgroundColor: FILM_TINT[f.film] }, isNew && s.dotNew]} />
              <Text maxFontSizeMultiplier={1.3} style={[s.mark, { color: C.safelight, opacity: isNew ? 1 : 0 }]}>✦</Text>
            </Pressable>
          );
        })}
      </View>
      {fresh ? <Text maxFontSizeMultiplier={1.3} style={s.note}>{tr('✦ 도감에 없는 필름 · 누르면 어떤 필름인지', '✦ missing from your book · tap to see the film', '✦ 図鑑にないフィルム · タップで詳しく')}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: C.panel, borderRadius: 10, borderWidth: 1, borderColor: C.edge, paddingVertical: 10, paddingHorizontal: 10, marginBottom: 10 },
  head: { color: C.dim, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, marginLeft: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: 5 },
  wd: { color: C.dim, fontSize: 11, fontFamily: MONO },
  dot: { width: 16, height: 16, borderRadius: 4 },
  dotNew: { borderWidth: 1.5, borderColor: C.safelight },
  mark: { fontSize: 9, lineHeight: 10 },
  note: { color: C.safelight, fontSize: 10.5, marginTop: 6, marginLeft: 2 },
});
