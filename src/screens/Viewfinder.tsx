// Film-camera chrome over the live preview: frame lines, the frame number
// (= day of the month), the weather the film will be picked from (never the
// film itself, that stays a surprise), the golden-hour light when it is near,
// and a counter window showing this month's roll as dots.

import { useEffect, useState } from 'react';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { monthStrip } from '../lib/strip';
import { C, MONO } from '../ui/theme';
import { monthShort, tr } from '../lib/i18n';
import Level from './Level';

type Props = { today: string; shotDays: Set<string>; weather: string; light?: string; grid?: boolean; top: number; bottom: number };

function Corner({ style }: { style: object }) {
  return <View style={[s.corner, style]} />;
}

export default function Viewfinder({ today, shotDays, weather, light, grid, top, bottom }: Props) {
  const month = today.slice(0, 7);
  const frame = Number(today.slice(8));
  const days = monthStrip(month, shotDays, today).filter((f) => f.kind === 'day');
  const shots = days.filter((f) => f.kind === 'day' && f.state === 'shot').length;
  const { width, height } = useWindowDimensions();
  const topH = top + 170;
  const botH = bottom + 300;

  // today's dot breathes like a ready lamp
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* soft scrims so the readouts stay legible over a bright sky or a white wall */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={topH}>
          <LinearGradient start={vec(0, 0)} end={vec(0, topH)} colors={['rgba(8,7,6,0.62)', 'rgba(8,7,6,0)']} />
        </Rect>
        <Rect x={0} y={height - botH} width={width} height={botH}>
          <LinearGradient start={vec(0, height - botH)} end={vec(0, height)} colors={['rgba(8,7,6,0)', 'rgba(8,7,6,0.55)']} />
        </Rect>
      </Canvas>
      <View style={[s.frame, { top: top + 96, bottom: bottom + 206 }]}>
        {/* rule-of-thirds lines and the level, when the grid is on */}
        {grid ? (
          <>
            <Level />
            <View style={[s.gridV, { left: '33.33%' }]} />
            <View style={[s.gridV, { left: '66.66%' }]} />
            <View style={[s.gridH, { top: '33.33%' }]} />
            <View style={[s.gridH, { top: '66.66%' }]} />
          </>
        ) : null}
        <Corner style={{ top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }} />
        <Corner style={{ top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }} />
        <Corner style={{ bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }} />
        <Corner style={{ bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }} />
        <View style={s.cross}>
          <View style={s.crossH} />
          <View style={s.crossV} />
        </View>
      </View>

      <View style={[s.side, { top: top + 10, left: 18 }]}>
        <Text maxFontSizeMultiplier={1.3} style={s.no}>№ {String(frame).padStart(2, '0')}</Text>
        <Text maxFontSizeMultiplier={1.3} style={s.small}>{tr(`${Number(month.slice(5))}월 롤 · ${shots}장`, `${monthShort(Number(month.slice(5))).toUpperCase()} ROLL · ${shots}`, `${Number(month.slice(5))}月のロール · ${shots}枚`)}</Text>
      </View>
      <View style={[s.side, { top: top + 10, right: 18, alignItems: 'flex-end' }]}>
        <Text maxFontSizeMultiplier={1.3} style={s.wx}>{weather || tr('하늘 읽는 중', 'Reading the sky', '空を読んでいます')}</Text>
        <Text maxFontSizeMultiplier={1.3} style={s.small}>{tr('지금 하늘', 'Sky now', 'いまの空')}</Text>
        {/* kept clear of the centred 'Today's film' label: wraps instead of running into it */}
        {light ? <Text maxFontSizeMultiplier={1.3} style={[s.light, { maxWidth: width * 0.38 }]}>{light}</Text> : null}
      </View>

      <View style={[s.counter, { bottom: bottom + 168 }]} accessible accessibilityLabel={tr(`이번 달 ${days.length}칸 중 ${shots}장`, `${shots} of ${days.length} frames this month`, `今月${days.length}コマ中${shots}枚`)}>
        {days.map((f) =>
          f.kind === 'day' && f.state === 'today' ? (
            <Animated.View key={f.day} style={[s.dot, s.dotToday, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }]} />
          ) : (
            <View key={f.index} style={[s.dot, f.kind === 'day' && f.state === 'shot' ? s.dotShot : f.kind === 'day' && f.state === 'missed' ? s.dotMissed : s.dotFuture]} />
          ),
        )}
      </View>
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 6 };

const s = StyleSheet.create({
  frame: { position: 'absolute', left: 22, right: 22 },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(242,236,228,0.35)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(242,236,228,0.35)' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: 'rgba(242,236,228,0.85)' },
  cross: { position: 'absolute', top: '50%', left: '50%', width: 18, height: 18, marginLeft: -9, marginTop: -9, alignItems: 'center', justifyContent: 'center' },
  crossH: { position: 'absolute', width: 18, height: 1, backgroundColor: 'rgba(242,236,228,0.6)' },
  crossV: { position: 'absolute', width: 1, height: 18, backgroundColor: 'rgba(242,236,228,0.6)' },
  side: { position: 'absolute' },
  no: { color: C.safelight, fontFamily: MONO, fontSize: 18, fontWeight: '700', letterSpacing: 1, ...shadow },
  wx: { color: C.text, fontSize: 14, fontWeight: '600', ...shadow },
  light: { color: C.safelight, fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'right', ...shadow },
  small: { color: C.text, opacity: 0.7, fontSize: 10.5, marginTop: 2, ...shadow },
  counter: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(14,13,12,0.55)' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotShot: { backgroundColor: C.text },
  dotMissed: { backgroundColor: 'rgba(242,236,228,0.22)' },
  dotFuture: { backgroundColor: 'rgba(242,236,228,0.08)', borderWidth: 0.5, borderColor: 'rgba(242,236,228,0.25)' },
  dotToday: { backgroundColor: C.safelight, width: 7, height: 7, borderRadius: 4, marginTop: -1 },
});
