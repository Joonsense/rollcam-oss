// Year-end card: "올해의 롤이 나왔어요". Comes up once per year (lib/recap.ts),
// with the twelve month covers, the year's facts and the two things to do with
// it: share the year as one story image, or look through it.

import { File, Paths } from 'expo-file-system';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { dayKey } from '../lib/day';
import { recapYear } from '../lib/recap';
import { composeYear, shareRoll } from '../lib/share';
import { yearRecap, yearSummary } from '../lib/stats';
import { getSetting, setSetting, yearShots } from '../lib/store';
import { thumbUri } from '../lib/thumbs';
import { coverKey, withCovers } from '../lib/covers';
import { C, MONO } from '../ui/theme';
import { monthShort, tr } from '../lib/i18n';

/** The year whose card is due, or null. */
export function pendingYear(now = new Date()): number | null {
  // Dev builds only: a pushed flag file (files/recap-now) pretends it is Dec 20, to see the card
  if (__DEV__ && new File(Paths.document, 'recap-now').exists) now = new Date(now.getFullYear(), 11, 20);
  return recapYear(now, (y) => getSetting(`recap:${y}`, '') === '1', (y) => yearShots(y).length);
}

export default function YearCard({ year, onClose, onOpen }: { year: number | null; onClose: () => void; onOpen: (year: number) => void }) {
  return (
    <Modal visible={year !== null} transparent animationType="fade" onRequestClose={onClose}>
      {year !== null ? <Card key={year} year={year} onClose={onClose} onOpen={onOpen} /> : null}
    </Modal>
  );
}

function Card({ year, onClose, onOpen }: { year: number; onClose: () => void; onOpen: (year: number) => void }) {
  const today = dayKey(new Date());
  const shots = useMemo(() => yearShots(year), [year]);
  const summary = useMemo(() => withCovers(yearSummary(year, shots, today), shots, (m) => getSetting(coverKey(m), '')), [year, shots, today]);
  const facts = useMemo(() => yearRecap(summary, shots), [summary, shots]);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // 4 covers a row: window - scrim padding - card padding - card border - gaps
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 44 - 44 - 2 - 3 * 6) / 4) - 1;

  const seen = () => setSetting(`recap:${year}`, '1');
  const close = () => {
    seen();
    onClose();
  };
  const open = () => {
    seen();
    onOpen(year);
  };
  const share = async () => {
    setSharing(true);
    setNote(null);
    try {
      await shareRoll(await composeYear(summary, facts, shots));
      seen();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Pressable style={s.scrim} onPress={close}>
      <Pressable style={s.card} onPress={() => {}}>
        <Text style={s.kicker}>ROLLCAM · {year}</Text>
        <Text style={s.title}>{tr('올해의 롤이 나왔어요', 'Your year in a roll is here', '今年のロールができました')}</Text>
        <Text style={s.sub}>
          {tr(`${summary.days}일 중 ${summary.shots}장`, `${summary.shots} photos in ${summary.days} days`, `${summary.days}日中${summary.shots}枚`)}
        </Text>
        <View style={s.grid}>
          {summary.months.map((mo, i) => (
            <View key={mo.month} style={[s.cell, { width: cell, height: Math.round(cell * 0.86) }, !mo.cover && s.blank]}>
              {mo.cover ? <Image source={{ uri: thumbUri(mo.cover.file) }} style={s.cover} resizeMethod="resize" /> : null}
              <Text style={[s.month, !mo.cover && { color: 'rgba(255,154,60,0.45)' }]}>{monthShort(i + 1)}</Text>
            </View>
          ))}
        </View>
        <View style={s.facts}>
          {facts.slice(0, 4).map((f) => (
            <View key={f.label} style={s.fact}>
              <Text style={s.factLabel}>{f.label}</Text>
              <Text style={s.factValue} numberOfLines={1}>
                {f.value}
              </Text>
            </View>
          ))}
        </View>
        <View style={s.actions}>
          <Pressable onPress={share} disabled={sharing} style={s.primary} accessibilityRole="button" accessibilityHint={tr('스토리 크기 이미지 한 장으로 공유해요', 'Shares it as one story-size image', 'ストーリーサイズの画像一枚で共有します')}>
            {sharing ? <ActivityIndicator color={C.bg} /> : <Text style={s.primaryText}>{tr('올해의 롤 공유', 'Share my year', '今年のロールを共有')}</Text>}
          </Pressable>
          <Pressable onPress={open} style={s.ghost} accessibilityRole="button">
            <Text style={s.ghostText}>{tr('한 해 보기', 'See the year', '一年を見る')}</Text>
          </Pressable>
        </View>
        {note ? <Text style={s.note}>{note}</Text> : null}
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,7,6,0.9)', justifyContent: 'center', padding: 22 },
  card: { backgroundColor: C.panel, borderRadius: 14, padding: 22, borderWidth: 1, borderColor: C.edge },
  kicker: { color: C.safelight, fontFamily: MONO, fontSize: 11, letterSpacing: 3 },
  title: { color: C.text, fontSize: 26, fontWeight: '700', marginTop: 6 },
  sub: { color: C.dim, fontSize: 14, marginTop: 4, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  cell: { borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: C.strip },
  blank: { backgroundColor: '#1C130C', borderWidth: 1, borderColor: '#3A2717' },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  month: { color: C.text, fontSize: 10, fontWeight: '700', margin: 5, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  fact: { width: '50%', paddingRight: 8 },
  factLabel: { color: C.dim, fontSize: 11.5 },
  factValue: { color: C.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  primary: { flex: 1, backgroundColor: C.safelight, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  primaryText: { color: C.bg, fontWeight: '700', fontSize: 14 },
  ghost: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: C.edge },
  ghostText: { color: C.text, fontSize: 14 },
  note: { color: C.safelight, fontSize: 12, marginTop: 10, textAlign: 'center' },
});
