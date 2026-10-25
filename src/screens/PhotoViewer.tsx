// A developed photo, full screen. Swipe through the month's prints, see the
// film, why it loaded and the weather it was shot in, and share one print.

import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capsuleDate, capsuleRevealed } from '../lib/capsule';
import { shareCut } from '../lib/cut';
import { dayKey } from '../lib/day';
import { FILM_NAMES } from '../lib/film';
import { reasonOnly, sharePhoto, type PrintFormat } from '../lib/share';
import { weatherLine } from '../lib/sky';
import { allShots, getShot, isAtLab, photoUri, type Shot } from '../lib/store';
import { labLine } from '../lib/lab';
import { C, FILM_TINT, MONO } from '../ui/theme';
import ZoomPhoto from './ZoomPhoto';
import PrintBack from './PrintBack';
import { backFacts } from '../lib/backFacts';
import { shareBack } from '../lib/backShare';
import { quote, tr } from '../lib/i18n';
import { isLucky } from '../lib/lucky';
import { sameDate } from '../lib/echo';

/** `isCover`/`onCover`: the month roll lets a print become its month's cover (lib/covers.ts). */
/** `back`: the day of the photo this viewer was opened over (its "같은 날" chip closes instead of stacking another). */
type Props = { shots: Shot[]; start: number | null; onClose: () => void; isCover?: (shot: Shot) => boolean; onCover?: (shot: Shot) => void; back?: string };

export default function PhotoViewer({ shots, start, onClose, isCover, onCover, back }: Props) {
  return (
    <Modal visible={start !== null} transparent animationType="fade" onRequestClose={onClose}>
      {/* keyed so every open starts fresh at the tapped photo */}
      {start !== null ? <Pager key={start} shots={shots} start={start} onClose={onClose} isCover={isCover} onCover={onCover} back={back} /> : null}
    </Modal>
  );
}

function Pager({ shots, start, onClose, isCover, onCover, back }: Omit<Props, 'start'> & { start: number }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  // a zoomed print holds the roll still (ZoomPhoto)
  const [zoomed, setZoomed] = useState(false);
  const [sharing, setSharing] = useState<PrintFormat | 'cut' | 'back' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // the print turned over to its lab stamp, as of its own day (lib/backFacts.ts)
  const [backDay, setBackDay] = useState<string | null>(null);
  const roll = useMemo(() => allShots(), []);

  const shot = shots[index];
  // the same date in other years, opened over this one
  const others = useMemo(() => (shot ? sameDate(shot.day, roll) : []), [shot, roll]);
  const [other, setOther] = useState<Shot | null>(null);
  const share = async (format: PrintFormat | 'cut' | 'back') => {
    if (!shot || sharing) return;
    setSharing(format);
    setNote(null);
    try {
      await (format === 'back' ? shareBack(shot, backFacts(shot, roll)) : format === 'cut' ? shareCut(shot) : sharePhoto(shot, format));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(null);
    }
  };

  return (
    <View style={[s.fill, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.top}>
        <Text style={s.counter}>
          {index + 1} / {shots.length}
        </Text>
        {shot && onCover ? (
          isCover?.(shot) ? (
            <Text style={s.cover}>{tr('★ 이 달 표지', '★ Month cover', '★ この月の表紙')}</Text>
          ) : (
            <Pressable onPress={() => onCover(shot)} hitSlop={10} accessibilityRole="button" accessibilityHint={tr('한 해 보기와 올해의 롤에서 이 달 표지가 돼요', 'Becomes the month cover in the year view and your year card', '年の一覧と今年のロールで、この月の表紙になります')}>
              <Text style={s.coverAsk}>{tr('☆ 이 달 표지로', '☆ Make month cover', '☆ この月の表紙に')}</Text>
            </Pressable>
          )
        ) : null}
        <Pressable onPress={onClose} hitSlop={16} accessibilityLabel={tr('닫기', 'Close', '閉じる')}>
          <Text style={s.close}>✕</Text>
        </Pressable>
      </View>

      <FlatList
        data={shots}
        keyExtractor={(x) => x.day}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={start}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          setBackDay(null);
        }}
        extraData={backDay}
        renderItem={({ item }) => (
          <View style={[s.page, { width }]}>
            {backDay === item.day ? (
              <Pressable onPress={() => setBackDay(null)} style={[s.back, { height: Math.min((width - 32) * 1.3, 520) }]} accessibilityRole="button" accessibilityLabel={tr('인화지 뒷면, 눌러서 사진으로', 'Back of the print, tap for the photo', 'プリントの裏、タップで写真へ')}>
                <PrintBack shot={item} {...backFacts(item, roll)} />
              </Pressable>
            ) : (
              <View style={s.fillBox}>
                <ZoomPhoto uri={photoUri(item.file)} width={width - 32} onZoom={setZoomed} />
              </View>
            )}
          </View>
        )}
      />

      {shot ? (
        <View style={s.caption}>
          <View style={s.filmRow}>
            <View style={[s.chip, { backgroundColor: FILM_TINT[shot.film] }]} />
            <Text style={s.film}>{FILM_NAMES[shot.film]}</Text>
            <Pressable onPress={() => setBackDay(backDay === shot.day ? null : shot.day)} hitSlop={10} style={s.flip} accessibilityRole="button" accessibilityLabel={backDay === shot.day ? tr('사진 보기', 'Show the photo', '写真を見る') : tr('인화지 뒷면 보기', 'Turn the print over', 'プリントの裏を見る')}>
              <Text style={s.flipText}>{backDay === shot.day ? tr('사진 ↻', 'Photo ↻', '写真 ↻') : tr('뒷면 ↻', 'Back ↻', '裏 ↻')}</Text>
            </Pressable>
          </View>
          <Text style={s.reason}>
            {shot.day.replaceAll('-', '.')} · {reasonOnly(shot.reason)}
          </Text>
          {others.length ? (
            <View style={s.years} accessibilityRole="none">
              <Text style={s.yearsLabel}>{tr('같은 날', 'This date in', '同じ日')}</Text>
              {others.slice(0, 4).map((o) => (
                <Pressable key={o.day} onPress={() => (o.day === back ? onClose() : setOther(o))} hitSlop={6} style={s.yearChip} accessibilityRole="button" accessibilityLabel={tr(`${o.day.slice(0, 4)}년 같은 날 사진`, `The same date in ${o.day.slice(0, 4)}`, `${o.day.slice(0, 4)}年の同じ日の写真`)}>
                  <View style={[s.chip, { backgroundColor: FILM_TINT[o.film] }]} />
                  <Text style={s.yearText}>{o.day.slice(0, 4)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {weatherLine(shot.weather) ? <Text style={s.weather}>{weatherLine(shot.weather)}</Text> : null}
          {isLucky(shot.takenAt) ? <Text style={[s.weather, { color: '#FFC86B' }]}>{tr('✦ 럭키 컷', '✦ Lucky frame', '✦ ラッキーカット')}</Text> : null}
          {shot.memo ? <Text style={s.memo}>{quote(shot.memo)}</Text> : null}
          {shot.capsule ? (
            <Text style={s.letter}>{capsuleRevealed(shot.day, dayKey(new Date()), !!getShot(dayKey(new Date()))) ? `${tr('✉ 1년 뒤의 나에게', '✉ To next year', '✉ 1年後の自分へ')} · ${shot.capsule}` : tr(`✉ ${capsuleDate(shot.day)}에 열리는 편지`, `✉ A letter that opens ${capsuleDate(shot.day)}`, `✉ ${capsuleDate(shot.day)}に開く手紙`)}</Text>
          ) : null}
          <View style={s.shareRow}>
            {backDay === shot.day ? (
              <Pressable onPress={() => share('back')} disabled={!!sharing} style={s.share} accessibilityRole="button" accessibilityHint={tr('현상소 도장이 찍힌 뒷면을 이미지로 공유해요', 'Shares the stamped back as an image', '現像所のスタンプが押された裏を画像で共有します')}>
                {sharing === 'back' ? <ActivityIndicator color={C.bg} /> : <Text style={s.shareText}>{tr('뒷면 공유', 'Share the back', '裏を共有')}</Text>}
              </Pressable>
            ) : null}
            {isAtLab(shot.day) ? (
              <Text style={s.weather}>{labLine(shot.day, new Date())}</Text>
            ) : (
              <>
                <Pressable onPress={() => share('feed')} disabled={!!sharing} style={s.share} accessibilityRole="button" accessibilityHint={tr('인화지 한 장(4:5)으로 공유해요', 'Shares it as a print (4:5)', 'プリント一枚(4:5)で共有します')}>
                  {sharing === 'feed' ? <ActivityIndicator color={C.bg} /> : <Text style={s.shareText}>{tr('이 사진 공유', 'Share this photo', 'この写真を共有')}</Text>}
                </Pressable>
                <Pressable onPress={() => share('story')} disabled={!!sharing} style={s.story} accessibilityRole="button" accessibilityHint={tr('스토리 크기(9:16)로 공유해요', 'Shares it in story size (9:16)', 'ストーリーサイズ(9:16)で共有します')}>
                  {sharing === 'story' ? <ActivityIndicator color={C.text} /> : <Text style={s.storyText}>{tr('스토리로', 'As a story', 'ストーリーで')}</Text>}
                </Pressable>
                <Pressable onPress={() => share('cut')} disabled={!!sharing} style={s.story} accessibilityRole="button" accessibilityHint={tr('35mm 필름 한 칸처럼(4:5) 공유해요', 'Shares it as one frame of 35mm film (4:5)', '35mmフィルムの一コマ(4:5)のように共有します')}>
                  {sharing === 'cut' ? <ActivityIndicator color={C.text} /> : <Text style={s.storyText}>{tr('필름 컷', 'Film frame', 'フィルムコマ')}</Text>}
                </Pressable>
              </>
            )}
          </View>
          {note ? <Text style={s.note}>{note}</Text> : null}
        </View>
      ) : null}
      <PhotoViewer shots={other ? [other] : []} start={other ? 0 : null} onClose={() => setOther(null)} back={shot?.day} />
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 8 },
  cover: { color: C.safelight, fontSize: 12.5, fontWeight: '700' },
  coverAsk: { color: C.dim, fontSize: 12.5 },
  counter: { color: C.dim, fontFamily: MONO, fontSize: 13 },
  close: { color: C.text, fontSize: 22 },
  page: { flex: 1, paddingHorizontal: 16, justifyContent: 'center' },
  fillBox: { flex: 1 },
  back: { width: '100%' },
  flip: { marginLeft: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: C.edge },
  flipText: { color: C.dim, fontSize: 11.5 },
  photo: { width: '100%', height: '100%' },
  caption: { alignItems: 'center', paddingTop: 14, paddingHorizontal: 24 },
  filmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { width: 9, height: 9, borderRadius: 2 },
  film: { color: C.text, fontFamily: MONO, fontSize: 16 },
  reason: { color: C.dim, fontSize: 13, marginTop: 6, textAlign: 'center' },
  weather: { color: C.dim, fontSize: 12, marginTop: 4, opacity: 0.8 },
  memo: { color: C.text, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  letter: { color: C.safelight, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  shareRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14 },
  story: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: C.edge, minWidth: 80, alignItems: 'center' },
  storyText: { color: C.text, fontSize: 13, fontWeight: '600' },
  share: { backgroundColor: C.safelight, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, minWidth: 116, alignItems: 'center' },
  shareText: { color: C.bg, fontWeight: '700', fontSize: 13 },
  note: { color: C.safelight, fontSize: 12, marginTop: 8 },
  years: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  yearsLabel: { color: C.dim, fontSize: 12 },
  yearChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: C.edge },
  yearText: { color: C.text, fontFamily: MONO, fontSize: 12 },
});
