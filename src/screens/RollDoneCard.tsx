// The first open of a new month: last month's roll is back from the lab. A
// small contact strip, a few lines about the month, and the two things to do
// with it (share the roll, look through it). Shown once per month.

import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { monthSky } from '../lib/conditions';
import { addMonths, dayKey, monthKey } from '../lib/day';
import { composeRoll, shareRoll } from '../lib/share';
import { doneLines, monthStats } from '../lib/stats';
import { allShots, getSetting, monthShots, setSetting } from '../lib/store';
import { newIn } from '../lib/filmbook';
import { FILM_NAMES } from '../lib/film';
import { thumbUri } from '../lib/thumbs';
import { C, FILM_TINT, MONO } from '../ui/theme';
import { monthLong, tr } from '../lib/i18n';
import RollPlayer from './RollPlayer';
import { askReviewIfDue } from '../lib/reviewAsk';

/** Last month, if it has photos and its card hasn't been seen yet. */
export function pendingRoll(now = new Date()): string | null {
  const prev = addMonths(monthKey(now), -1);
  if (getSetting(`rollDone:${prev}`, '') === '1') return null;
  return monthShots(prev).length > 0 ? prev : null;
}

export default function RollDoneCard({ month, onClose, onOpen }: { month: string | null; onClose: () => void; onOpen: (month: string) => void }) {
  return (
    <Modal visible={!!month} transparent animationType="fade" onRequestClose={onClose}>
      {month ? <Card key={month} month={month} onClose={onClose} onOpen={onOpen} /> : null}
    </Modal>
  );
}

function Card({ month, onClose, onOpen }: { month: string; onClose: () => void; onOpen: (month: string) => void }) {
  const today = dayKey(new Date());
  const shots = useMemo(() => monthShots(month), [month]);
  const lines = useMemo(() => doneLines(monthStats(month, shots, today)), [month, shots, today]);
  // films this month added to the film book for the first time
  const fresh = useMemo(() => newIn(month, allShots()), [month]);
  const [sharing, setSharing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [y, m] = month.split('-');
  // 6 frames a row: window - scrim padding - card padding - strip padding - gaps
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 44 - 44 - 12 - 4 * 5) / 6);

  const seen = () => setSetting(`rollDone:${month}`, '1');
  const close = () => {
    seen();
    onClose();
    // the month just came back: a good moment for Play's review card, once the modal is gone
    setTimeout(() => askReviewIfDue().catch(() => {}), 800);
  };
  const open = () => {
    seen();
    onOpen(month);
  };
  const share = async () => {
    setSharing(true);
    setNote(null);
    try {
      await shareRoll(await composeRoll(month, shots, await monthSky(month, today), today));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Pressable style={s.scrim} onPress={close}>
      <Pressable style={s.card} onPress={() => {}}>
        <Text style={s.kicker}>
          ROLL {y} · {monthLong(Number(m))}
        </Text>
        <Text style={s.title}>{tr('현상이 끝났어요', 'Your roll is developed', '現像が終わりました')}</Text>
        <View style={s.strip}>
          {shots.slice(-12).map((x) => (
            <Image key={x.day} source={{ uri: thumbUri(x.file) }} resizeMethod="resize" style={[s.thumb, { width: cell, height: Math.round(cell * 1.32) }]} />
          ))}
        </View>
        {lines.map((l) => (
          <Text key={l} style={s.line}>
            {l}
          </Text>
        ))}
        {fresh.length ? (
          <View style={s.fresh}>
            <Text style={s.freshHead}>{tr('도감에 새로 들어온 필름', 'New in your film book', '図鑑に新しく入ったフィルム')}</Text>
            <View style={s.freshRow}>
              {fresh.map((f) => (
                <View key={f} style={s.freshItem}>
                  <View style={[s.freshChip, { backgroundColor: FILM_TINT[f] }]} />
                  <Text style={s.freshName}>{FILM_NAMES[f]}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <View style={s.actions}>
          <Pressable onPress={share} disabled={sharing} style={s.primary}>
            {sharing ? <ActivityIndicator color={C.bg} /> : <Text style={s.primaryText}>{tr('롤 공유', 'Share roll', 'ロールを共有')}</Text>}
          </Pressable>
          {shots.length >= 2 ? (
            <Pressable onPress={() => setPlaying(true)} style={s.ghost} accessibilityRole="button" accessibilityLabel={tr(`${Number(m)}월 롤 재생`, `Play the ${monthLong(Number(m))} roll`, `${Number(m)}月のロールを再生`)}>
              <Text style={s.ghostText}>{tr('▶ 재생', '▶ Play', '▶ 再生')}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={open} style={s.ghost}>
            <Text style={s.ghostText}>{tr('롤 보기', 'View roll', 'ロールを見る')}</Text>
          </Pressable>
        </View>
        {note ? <Text style={s.note}>{note}</Text> : null}
        <RollPlayer month={month} shots={shots} open={playing} onClose={() => setPlaying(false)} />
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,7,6,0.88)', justifyContent: 'center', padding: 22 },
  card: { backgroundColor: C.panel, borderRadius: 14, padding: 22, borderWidth: 1, borderColor: C.edge },
  kicker: { color: C.safelight, fontFamily: MONO, fontSize: 11, letterSpacing: 3 },
  title: { color: C.text, fontSize: 26, fontWeight: '700', marginTop: 6, marginBottom: 16 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, backgroundColor: C.strip, padding: 6, borderRadius: 6, marginBottom: 14 },
  thumb: { borderRadius: 2 },
  line: { color: C.dim, fontSize: 14, lineHeight: 22 },
  fresh: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.edge },
  freshHead: { color: C.safelight, fontSize: 11.5, letterSpacing: 1 },
  freshRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 6 },
  freshItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  freshChip: { width: 8, height: 8, borderRadius: 2 },
  freshName: { color: C.text, fontFamily: MONO, fontSize: 12.5 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  primary: { flex: 1, backgroundColor: C.safelight, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  primaryText: { color: C.bg, fontWeight: '700', fontSize: 14 },
  ghost: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: C.edge },
  ghostText: { color: C.text, fontSize: 14 },
  note: { color: C.safelight, fontSize: 12, marginTop: 10, textAlign: 'center' },
});
