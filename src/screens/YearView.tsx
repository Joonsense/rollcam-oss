// A year of rolls on one screen: twelve month cards, each with its latest
// print as the cover and a calendar of day dots (the film's tint on shot days,
// faint on missed days). Tapping a month opens it in the month view.

import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Dot, YearSummary } from '../lib/stats';
import type { Shot } from '../lib/store';
import { thumbUri, useThumbs } from '../lib/thumbs';
import { C, FILM_TINT, MONO } from '../ui/theme';
import { count, monthLong, monthShort, tr } from '../lib/i18n';

const COLS = 3;
const GAP = 8;
const PAD = 14;

export default function YearView({ data, bottom, onPick }: { data: YearSummary<Shot>; bottom: number; onPick: (month: string) => void }) {
  const { width } = useWindowDimensions();
  const card = Math.floor((width - PAD * 2 - GAP * (COLS - 1)) / COLS);
  const dot = Math.floor((card - 16 - 6 * 2) / 7); // 7 columns, 2px gaps, 8px card padding
  useThumbs(useMemo(() => data.months.flatMap((mo) => (mo.cover ? [mo.cover.file] : [])), [data]));

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: bottom }}>
      <View style={[s.grid, { gap: GAP }]}>
        {data.months.map((mo) => {
          const m = Number(mo.month.slice(5));
          const future = mo.days === 0;
          return (
            <Pressable
              key={mo.month}
              disabled={future}
              onPress={() => onPick(mo.month)}
              style={[s.card, { width: card }, future && { opacity: 0.35 }]}
              accessibilityRole="button"
              accessibilityLabel={`${monthLong(m)}, ${count(mo.shots, '장', 'photo')}`}
              accessibilityState={{ disabled: future }}>
              <View style={s.top}>
                <Text maxFontSizeMultiplier={1.3} style={s.month}>{monthShort(m)}</Text>
                <Text maxFontSizeMultiplier={1.3} style={s.count}>{future ? '' : `${mo.shots}/${mo.days}`}</Text>
              </View>
              <View style={[s.cover, { height: Math.round((card - 16) * 0.75) }]}>
                {mo.cover ? (
                  <Image source={{ uri: thumbUri(mo.cover.file) }} style={s.coverImg} resizeMethod="resize" />
                ) : future ? null : (
                  // a past month with no frames: bare film base, like an unexposed roll
                  <View style={s.blank}>
                    <Text maxFontSizeMultiplier={1.3} style={s.blankText}>{tr('빈 롤', 'Unexposed', '未露光')}</Text>
                  </View>
                )}
              </View>
              <Calendar month={mo.month} dots={mo.dots} size={dot} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** Day dots in week rows, Sunday first, so a month reads like a calendar. */
function Calendar({ month, dots, size }: { month: string; dots: Dot[]; size: number }) {
  const lead = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).getDay();
  }, [month]);
  return (
    <View style={s.cal}>
      {Array.from({ length: lead }, (_, i) => (
        <View key={`b${i}`} style={{ width: size, height: size }} />
      ))}
      {dots.map((d) => (
        <View
          key={d.day}
          style={[
            { width: size, height: size, borderRadius: size / 2 },
            d.state === 'shot' && { backgroundColor: d.film ? FILM_TINT[d.film] : C.safelight },
            d.state === 'missed' && { backgroundColor: C.faint, opacity: 0.55 },
            d.state === 'today' && { borderWidth: 1.5, borderColor: C.safelight },
            d.state === 'future' && { backgroundColor: C.edge, opacity: 0.5 },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { backgroundColor: C.panel, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.edge },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  month: { color: C.text, fontSize: 15, fontWeight: '700' },
  count: { color: C.dim, fontFamily: MONO, fontSize: 10 },
  cover: { backgroundColor: C.strip, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  coverImg: { width: '100%', height: '100%' },
  blank: { flex: 1, backgroundColor: '#1C130C', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3A2717', borderRadius: 3 },
  blankText: { color: 'rgba(255,154,60,0.45)', fontFamily: MONO, fontSize: 10, letterSpacing: 2 },
  cal: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
});
