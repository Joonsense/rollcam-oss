// One thin bar split by film tint, each film as wide as its share of the
// photos: a month's or a year's weather at a glance.

import { StyleSheet, View } from 'react-native';
import { FILM_NAMES, type FilmId } from '../lib/film';
import { filmMix } from '../lib/filmStory';
import { count, tr } from '../lib/i18n';
import { BOOK_ORDER } from '../lib/filmbook';
import { FILM_TINT } from '../ui/theme';

export default function FilmMixBar({ shots }: { shots: { film: FilmId }[] }) {
  const mix = filmMix(shots, BOOK_ORDER);
  // an empty month keeps the bar's space so the strip doesn't jump
  if (!mix.length) return <View style={[s.bar, { backgroundColor: 'transparent' }]} />;
  return (
    <View style={s.bar} accessible accessibilityLabel={`${tr('필름 비율', 'Film mix', 'フィルムの割合')}, ${mix.map((m) => `${FILM_NAMES[m.film]} ${count(m.n, '장', 'photo')}`).join(', ')}`}>
      {mix.map((m) => (
        <View key={m.film} style={{ flex: m.n, backgroundColor: FILM_TINT[m.film] }} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1.5, marginHorizontal: 40, marginBottom: 12 },
});
