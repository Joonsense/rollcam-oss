// Every "오늘의 한 줄" across the roll, newest first by month, with a search
// field. Tapping a line opens its photo (and its month's prints to swipe).

import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FILM_NAMES } from '../lib/film';
import { monthDay, tr, yearMonth } from '../lib/i18n';
import { searchLines } from '../lib/memo';
import { exportDiary } from '../lib/exportData';
import { allShots, type Shot } from '../lib/store';
import { thumbUri } from '../lib/thumbs';
import { C, FILM_TINT, MONO } from '../ui/theme';
import PhotoViewer from './PhotoViewer';

export default function LinesScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      {open ? <Lines onClose={onClose} /> : null}
    </Modal>
  );
}

function Lines({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const shots = useMemo(() => allShots(), []);
  const total = useMemo(() => shots.filter((s) => s.memo).length, [shots]);
  const groups = useMemo(() => searchLines(shots, q), [shots, q]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const saveText = async () => {
    setSaving(true);
    setNote(null);
    try {
      await exportDiary();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  const [viewing, setViewing] = useState<{ list: Shot[]; start: number } | null>(null);
  const rows = useMemo(() => groups.flatMap((g) => [{ kind: 'month' as const, month: g.month }, ...g.items.map((s) => ({ kind: 'line' as const, shot: s, group: g.items }))]), [groups]);

  return (
    <View style={[s.fill, { paddingTop: insets.top + 8 }]}>
      <View style={s.top}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.kicker}>LINES</Text>
          <Text style={s.title} numberOfLines={1}>{tr('한 줄 모아 보기', 'All your lines', '一行をまとめて見る')}</Text>
        </View>
        <View style={s.topRight}>
          {total ? (
            <Pressable onPress={saveText} disabled={saving} hitSlop={10} style={s.txt} accessibilityRole="button" accessibilityHint={tr('모든 한 줄을 텍스트 파일로 보내요', 'Sends every line as a text file', 'すべての一行をテキストファイルで送ります')}>
              {saving ? <ActivityIndicator size="small" color={C.safelight} /> : <Text style={s.txtText}>{tr('텍스트로 ↗', 'As text ↗', 'テキストで ↗')}</Text>}
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={16} accessibilityRole="button" accessibilityLabel={tr('닫기', 'Close', '閉じる')}>
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
      <TextInput value={q} onChangeText={setQ} placeholder={tr(`${total}개의 한 줄에서 찾기`, `Search ${total} ${total === 1 ? 'line' : 'lines'}`, `${total}つの一行から探す`)} placeholderTextColor={C.faint} style={s.search} returnKeyType="search" accessibilityLabel={tr('한 줄 검색', 'Search lines', '一行を検索')} />
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === 'month' ? r.month : r.shot.day)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={s.empty}>{total ? tr('찾는 한 줄이 없어요', 'No line matches', '見つかりませんでした') : tr('아직 남긴 한 줄이 없어요. 오늘 찍은 사진 아래 ✎ 를 눌러 보세요', 'No lines yet. Tap ✎ under today\'s photo', 'まだ一行がありません。今日の写真の下の ✎ をタップしてみてください')}</Text>}
        renderItem={({ item }) =>
          item.kind === 'month' ? (
            <Text style={s.month}>{yearMonth(Number(item.month.slice(0, 4)), Number(item.month.slice(5)))}</Text>
          ) : (
            <Pressable
              onPress={() => setViewing({ list: item.group, start: item.group.indexOf(item.shot) })}
              style={s.row}
              accessibilityRole="button"
              accessibilityLabel={`${monthDay(Number(item.shot.day.slice(5, 7)), Number(item.shot.day.slice(8)))}, ${item.shot.memo}`}
            >
              <View style={s.print}>
                <Image source={{ uri: thumbUri(item.shot.file) }} style={s.thumb} resizeMethod="resize" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.meta}>
                  <Text style={s.day}>{item.shot.day.slice(5).replace('-', '.')}</Text>
                  <View style={[s.chip, { backgroundColor: FILM_TINT[item.shot.film] }]} />
                  <Text style={s.film}>{FILM_NAMES[item.shot.film]}</Text>
                </View>
                <Text style={s.text}>{item.shot.memo}</Text>
              </View>
            </Pressable>
          )
        }
      />
      <PhotoViewer shots={viewing?.list ?? []} start={viewing ? viewing.start : null} onClose={() => setViewing(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22 },
  kicker: { color: C.safelight, fontFamily: MONO, fontSize: 11, letterSpacing: 3 },
  title: { color: C.text, fontSize: 22, fontWeight: '700', marginTop: 2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  txt: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.safelight, minWidth: 84, alignItems: 'center' },
  txtText: { color: C.safelight, fontSize: 12.5, fontWeight: '700' },
  note: { color: C.safelight, fontSize: 12, textAlign: 'center', marginTop: 6 },
  close: { color: C.text, fontSize: 22 },
  search: { color: C.text, fontSize: 15, marginHorizontal: 20, marginTop: 14, marginBottom: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.edge, backgroundColor: C.panel },
  empty: { color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 40, lineHeight: 20 },
  month: { color: C.dim, fontSize: 11, letterSpacing: 2, marginTop: 20, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.edge },
  print: { backgroundColor: '#F4EFE6', padding: 2, paddingBottom: 6, borderRadius: 1 },
  thumb: { width: 36, height: 48, backgroundColor: '#000' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  day: { color: C.dim, fontFamily: MONO, fontSize: 12 },
  chip: { width: 7, height: 7, borderRadius: 1.5 },
  film: { color: C.dim, fontFamily: MONO, fontSize: 11 },
  text: { color: C.text, fontSize: 14, lineHeight: 20, marginTop: 3 },
});
