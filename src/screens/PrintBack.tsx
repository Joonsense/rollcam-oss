// The back of today's print, like lab paper: the paper maker's line repeated
// across it, and the lab's stamp with the film, the time, the sky and why
// that film loaded. Shown when the print is flipped over.

import { StyleSheet, Text, View } from 'react-native';
import type { Shot } from '../lib/store';
import { FILM_TINT, MONO } from '../ui/theme';
import { tr } from '../lib/i18n';
import { backRows } from '../lib/backRows';

const INK = '#8A5A3C';
const PAPER = '#EDE6DA';

type Props = { shot: Shot; frame: number; book: { found: number; total: number }; run?: number };

export default function PrintBack({ shot, frame, book, run = 0 }: Props) {
  const rows = backRows(shot, frame, book, run);
  return (
    <View style={s.fill}>
      {/* paper backprint, faint and diagonal */}
      <View style={s.watermark} pointerEvents="none">
        {Array.from({ length: 14 }, (_, i) => (
          <Text key={i} style={s.wm} numberOfLines={1}>
            ROLLCAM PAPER · DAYLIGHT · ROLLCAM PAPER · DAYLIGHT · ROLLCAM PAPER
          </Text>
        ))}
      </View>

      <View style={s.stamp}>
        <View style={s.head}>
          <Text style={s.lab}>ROLLCAM LAB</Text>
          <Text style={s.no}>№ {shot.day.slice(8)}</Text>
        </View>
        <View style={s.rule} />
        {rows.map(([k, v]) => (
          <View key={k} style={s.row}>
            <Text style={s.k}>{k}</Text>
            {k === 'FILM' ? <View style={[s.chip, { backgroundColor: FILM_TINT[shot.film] }]} /> : null}
            <Text style={s.v}>{v}</Text>
          </View>
        ))}
      </View>
      <Text style={s.foot}>{tr('이 사진은 이 기기에만 현상돼 있어요', 'This photo is developed on this phone only', 'この写真はこの端末でだけ現像されています')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: PAPER, borderRadius: 2, overflow: 'hidden', justifyContent: 'center', padding: 22 },
  watermark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-around', transform: [{ rotate: '-24deg' }, { scale: 1.6 }] },
  wm: { color: 'rgba(138,90,60,0.07)', fontFamily: MONO, fontSize: 11, letterSpacing: 2 },
  stamp: { borderWidth: 1.5, borderColor: INK, borderRadius: 4, padding: 14, transform: [{ rotate: '-1.5deg' }], opacity: 0.88 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  lab: { color: INK, fontFamily: MONO, fontSize: 13, fontWeight: '700', letterSpacing: 3 },
  no: { color: INK, fontFamily: MONO, fontSize: 13, fontWeight: '700' },
  rule: { height: 1, backgroundColor: INK, opacity: 0.5, marginVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 3.5 },
  k: { width: 46, color: INK, opacity: 0.7, fontFamily: MONO, fontSize: 10, letterSpacing: 1 },
  chip: { width: 8, height: 8, borderRadius: 2, marginRight: 6 },
  v: { flex: 1, color: '#3A2A20', fontSize: 13 },
  foot: { position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', color: INK, opacity: 0.55, fontSize: 10.5 },
});
