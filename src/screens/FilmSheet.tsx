// A film's page in the film book: what it is modelled on, the kind of day that
// brings it, and (once loaded) a few facts and its latest prints, with a way
// into every photo shot on it.

import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FILM_NAMES, filmHint, seasonWait, type FilmId } from '../lib/film';
import { count, tr } from '../lib/i18n';
import { filmFacts, filmStory, shareOfRoll } from '../lib/filmStory';
import type { Shot } from '../lib/store';
import { thumbUri } from '../lib/thumbs';
import { useFilmSample } from '../lib/filmSample';
import { C, FILM_TINT, MONO } from '../ui/theme';

type Props = { film: FilmId | null; shots: Shot[]; total: number; today: string; lat?: number | null; onClose: () => void; onOpen: (shots: Shot[]) => void };

const short = (day: string) => day.slice(2).replaceAll('-', '.');

export default function FilmSheet({ film, shots, total, today, lat, onClose, onOpen }: Props) {
  const insets = useSafeAreaInsets();
  // the film's own look on the bundled sample photo (lib/filmSample.ts)
  const sample = useFilmSample(film, true);
  if (!film) return null;
  const tint = FILM_TINT[film];
  const f = filmFacts(shots);
  const wait = seasonWait(film, today, lat);
  const facts = f.count
    ? [
        count(f.count, '장', 'photo'),
        shareOfRoll(f.count, total),
        tr(`첫 장 ${short(f.first!)}`, `first ${short(f.first!)}`, `初回 ${short(f.first!)}`),
        f.last !== f.first ? tr(`마지막 ${short(f.last!)}`, `last ${short(f.last!)}`, `最後 ${short(f.last!)}`) : '',
        f.pod ? tr(`주로 ${f.pod}`, `mostly ${f.pod}`, `主に${f.pod}`) : '',
      ].filter(Boolean)
    : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel={tr('닫기', 'Close', '閉じる')} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.grab} />
        <View style={s.head}>
          <View style={[s.chip, f.count ? { backgroundColor: tint } : { borderColor: tint, borderWidth: 1.5 }]} />
          <Text style={s.name}>{FILM_NAMES[film]}</Text>
        </View>
        <Text style={s.status}>
          {f.count
            ? facts.join(' · ')
            : wait
              ? wait.open
                ? tr(`지금 시즌 · ${wait.until.replace('-', '.')}까지`, `In season · until ${wait.until.replace('-', '.')}`, `シーズン中 · ${wait.until.replace('-', '.')}まで`)
                : tr(`시즌까지 ${wait.days}일 · ${wait.from.replace('-', '.')}부터`, `${wait.days} days to the season · from ${wait.from.replace('-', '.')}`, `シーズンまで${wait.days}日 · ${wait.from.replace('-', '.')}から`)
              : tr('아직 안 들어온 필름', 'Not loaded yet', 'まだ来ていないフィルム')}
        </Text>
        <View style={s.storyRow}>
          {sample.failed ? null : (
            <View style={s.sample} accessible accessibilityLabel={tr(`${FILM_NAMES[film]} 견본 인화`, `${FILM_NAMES[film]} sample print`, `${FILM_NAMES[film]}の見本プリント`)}>
              {sample.uri ? <Image source={{ uri: sample.uri }} style={s.sampleImg} /> : <ActivityIndicator color={C.faint} style={s.sampleImg} />}
              <Text style={s.sampleTag}>{tr('견본', 'SAMPLE', '見本')}</Text>
            </View>
          )}
          <Text style={[s.story, { flex: 1, marginTop: 0 }]}>{filmStory(film)}</Text>
        </View>
        <View style={s.when}>
          <Text style={s.whenK}>{tr('오는 날', 'Loads', '来る日')}</Text>
          <Text style={s.whenV}>{filmHint(film)}</Text>
        </View>
        {f.count ? (
          <>
            <View style={s.thumbs}>
              {shots.slice(-4).map((x) => (
                <View key={x.day} style={s.print}>
                  <Image source={{ uri: thumbUri(x.file) }} style={s.thumb} resizeMethod="resize" />
                </View>
              ))}
            </View>
            <Pressable onPress={() => onOpen(shots)} style={[s.open, { backgroundColor: tint }]} accessibilityRole="button">
              <Text style={s.openText}>{tr(`사진 ${f.count}장 보기`, `See ${count(f.count, '장', 'photo')}`, `写真${f.count}枚を見る`)}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22, paddingTop: 10, borderTopWidth: 1, borderColor: C.edge },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.faint, marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { width: 14, height: 14, borderRadius: 3 },
  name: { color: C.text, fontFamily: MONO, fontSize: 20, fontWeight: '700' },
  status: { color: C.safelight, fontSize: 12.5, marginTop: 8 },
  storyRow: { flexDirection: 'row', gap: 14, marginTop: 14, alignItems: 'flex-start' },
  sample: { backgroundColor: '#F4EFE6', padding: 4, paddingBottom: 16, borderRadius: 2, transform: [{ rotate: '-2deg' }] },
  sampleImg: { width: 84, height: 126, backgroundColor: '#1A1816' },
  sampleTag: { position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', color: '#8A5A3C', fontFamily: MONO, fontSize: 8.5, letterSpacing: 1.5 },
  story: { color: C.text, fontSize: 14, lineHeight: 21, marginTop: 14 },
  when: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.edge },
  whenK: { color: C.dim, fontSize: 12, width: 48 },
  whenV: { color: C.text, fontSize: 12.5, flex: 1 },
  thumbs: { flexDirection: 'row', gap: 10, marginTop: 18 },
  print: { backgroundColor: '#F4EFE6', padding: 3, paddingBottom: 8, borderRadius: 1 },
  thumb: { width: 54, height: 72, backgroundColor: '#000' },
  open: { marginTop: 18, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  openText: { color: C.bg, fontWeight: '700', fontSize: 14 },
});
