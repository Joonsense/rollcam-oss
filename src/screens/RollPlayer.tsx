// "롤 재생": the month's prints flipped through one after another, like a
// projector running the roll. A shutter flicker between frames, the frame
// counter, and each day's film and line under the print. Tap the print to
// pause; the reel stops on the last frame.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FILM_NAMES } from '../lib/film';
import { monthDay, monthLong, quote, tr } from '../lib/i18n';
import { SPEEDS, counter, nextFrame, nextSpeed, reelSeconds, speedName } from '../lib/playback';
import { composeRollGif, shareRollGif } from '../lib/rollGif';
import { photoUri, type Shot } from '../lib/store';
import { C, FILM_TINT, MONO } from '../ui/theme';
import { useReduceMotion } from '../ui/useReduceMotion';

type Props = { month: string; shots: Shot[]; open: boolean; onClose: () => void };

export default function RollPlayer({ month, shots, open, onClose }: Props) {
  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* mounted per open so every run starts at frame 1 */}
      {open && shots.length ? <Reel month={month} shots={shots} onClose={onClose} /> : null}
    </Modal>
  );
}

function Reel({ month, shots, onClose }: Omit<Props, 'open'>) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [flicker] = useState(() => new Animated.Value(0));
  const still = useReduceMotion();
  // the GIF share: null idle, 0..1 while drawing frames
  const [gifAt, setGifAt] = useState<number | null>(null);
  const [gifNote, setGifNote] = useState<string | null>(null);
  const shareGif = async () => {
    if (gifAt !== null) return;
    setGifAt(0);
    setGifNote(null);
    try {
      await shareRollGif(await composeRollGif(month, shots, speed, setGifAt));
    } catch (e) {
      setGifNote(e instanceof Error ? e.message : String(e));
    } finally {
      setGifAt(null);
    }
  };
  const done = i === shots.length - 1;

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      const n = nextFrame(i, shots.length);
      if (n === null) return setPlaying(false);
      // the shutter closes between frames, a little longer at slow speed
      if (!still) {
        flicker.setValue(1);
        Animated.timing(flicker, { toValue: 0, duration: Math.min(160, SPEEDS[speed] / 3), easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      }
      setI(n);
    }, SPEEDS[speed]);
    return () => clearTimeout(t);
  }, [i, playing, speed, shots.length, flicker, still]);

  const toggle = () => {
    if (done && !playing) setI(0);
    setPlaying((p) => !p);
  };
  const restart = () => {
    setI(0);
    setPlaying(true);
  };

  const shot = shots[i];
  const next = shots[i + 1];
  const boxW = Math.min(width * 0.84, (height - insets.top - insets.bottom - 300) * 0.75);
  const boxH = boxW / 0.75;
  const [y, m] = month.split('-');

  return (
    <View style={[s.fill, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 18 }]}>
      <View style={s.top}>
        <View>
          <Text style={s.kicker}>ROLL {y}</Text>
          <Text style={s.title}>{tr(`${Number(m)}월 롤 재생`, `${monthLong(Number(m))} roll`, `${Number(m)}月のロール`)}</Text>
        </View>
        <View style={s.topRight}>
          <Pressable onPress={shareGif} disabled={gifAt !== null} hitSlop={10} style={s.gif} accessibilityRole="button" accessibilityHint={tr('이 달 롤을 움직이는 GIF 로 공유해요', 'Shares the roll as a looping GIF', 'この月のロールを動くGIFで共有します')}>
            {gifAt !== null ? (
              <View style={s.gifBusy}>
                <ActivityIndicator size="small" color={C.safelight} />
                <Text style={s.gifText}>{Math.round(gifAt * 100)}%</Text>
              </View>
            ) : (
              <Text style={s.gifText}>{tr('GIF 공유 ↗', 'Share GIF ↗', 'GIFを共有 ↗')}</Text>
            )}
          </Pressable>
          <Pressable onPress={onClose} hitSlop={16} accessibilityRole="button" accessibilityLabel={tr('닫기', 'Close', '閉じる')}>
            <Text style={s.close}>✕</Text>
          </Pressable>
        </View>
      </View>
      {gifNote ? <Text style={s.gifNote}>{gifNote}</Text> : null}

      <View style={s.stage}>
        <Pressable
          onPress={toggle}
          style={[s.paper, { width: boxW + 20, height: boxH + 20 }]}
          accessibilityRole="button"
          accessibilityLabel={`${monthDay(Number(shot.day.slice(5, 7)), Number(shot.day.slice(8)))}, ${FILM_NAMES[shot.film]}${shot.memo ? `, ${shot.memo}` : ''}`}
          accessibilityHint={playing ? tr('눌러서 멈춰요', 'Tap to pause', 'タップで一時停止') : tr('눌러서 이어 봐요', 'Tap to keep playing', 'タップで続きを再生')}
        >
          <Image key={shot.file} source={{ uri: photoUri(shot.file) }} style={{ width: boxW, height: boxH }} resizeMode="contain" />
          {/* the next print decodes behind this one so the swap doesn't blink */}
          {next ? <Image key={next.file} source={{ uri: photoUri(next.file) }} style={s.preload} resizeMode="contain" /> : null}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.flicker, { opacity: flicker }]} />
          {!playing ? (
            <View pointerEvents="none" style={s.pauseBadge}>
              <Text style={s.pauseText}>{done ? tr('끝 · 눌러서 처음부터', 'The end · tap to start over', 'おしまい · タップで最初から') : tr('멈춤', 'Paused', '一時停止')}</Text>
            </View>
          ) : null}
        </Pressable>
        <Text style={s.counter}>{counter(i, shots.length)}</Text>
      </View>

      <View style={s.caption}>
        <View style={s.filmRow}>
          <Text style={s.date}>{shot.day.slice(5).replace('-', '.')}</Text>
          <View style={[s.chip, { backgroundColor: FILM_TINT[shot.film] }]} />
          <Text style={s.film}>{FILM_NAMES[shot.film]}</Text>
        </View>
        <Text style={s.memo} numberOfLines={2}>
          {shot.memo ? quote(shot.memo) : ' '}
        </Text>
      </View>

      <View style={s.controls}>
        <Pressable onPress={restart} hitSlop={10} style={s.ctl} accessibilityRole="button" accessibilityLabel={tr('처음부터', 'From the start', '最初から')}>
          <Text style={s.ctlText}>{tr('⟲ 처음', '⟲ Start', '⟲ 最初')}</Text>
        </Pressable>
        <Pressable onPress={toggle} style={s.play} accessibilityRole="button" accessibilityLabel={playing ? tr('멈춤', 'Pause', '一時停止') : tr('재생', 'Play', '再生')}>
          <Text style={s.playText}>{playing ? '❚❚' : '▶'}</Text>
        </Pressable>
        <Pressable
          onPress={() => setSpeed(nextSpeed)}
          hitSlop={10}
          style={s.ctl}
          accessibilityRole="button"
          accessibilityLabel={tr(`속도 ${speedName(speed)}, 전체 약 ${reelSeconds(shots.length, speed)}초`, `Speed ${speedName(speed)}, about ${reelSeconds(shots.length, speed)} seconds in all`, `速度 ${speedName(speed)}、全体で約${reelSeconds(shots.length, speed)}秒`)}
        >
          <Text style={s.ctlText}>{speedName(speed)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#070605' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22 },
  kicker: { color: C.safelight, fontFamily: MONO, fontSize: 11, letterSpacing: 3 },
  title: { color: C.text, fontSize: 20, fontWeight: '700', marginTop: 2 },
  close: { color: C.text, fontSize: 22 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  gif: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.safelight, minWidth: 92, alignItems: 'center' },
  gifBusy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gifText: { color: C.safelight, fontSize: 12.5, fontWeight: '700' },
  gifNote: { color: C.safelight, fontSize: 12, textAlign: 'center', marginTop: 6 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  paper: { backgroundColor: '#F4EFE6', padding: 10, borderRadius: 2, overflow: 'hidden' },
  preload: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  flicker: { backgroundColor: '#000' },
  pauseBadge: { position: 'absolute', alignSelf: 'center', top: '46%', backgroundColor: 'rgba(14,13,12,0.72)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  pauseText: { color: C.text, fontSize: 13, fontWeight: '600' },
  counter: { color: C.safelight, fontFamily: MONO, fontSize: 13, letterSpacing: 2, marginTop: 14 },
  caption: { alignItems: 'center', paddingHorizontal: 28, minHeight: 66 },
  filmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { color: C.dim, fontFamily: MONO, fontSize: 13 },
  chip: { width: 9, height: 9, borderRadius: 2 },
  film: { color: C.text, fontFamily: MONO, fontSize: 15 },
  memo: { color: C.text, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20, opacity: 0.92 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 10 },
  ctl: { minWidth: 72, alignItems: 'center', paddingVertical: 8 },
  ctlText: { color: C.dim, fontSize: 13, fontWeight: '600' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' },
  playText: { color: C.bg, fontSize: 20, fontWeight: '700' },
});
