// "올해의 온도" in the year view: a thin line through the temperature of each
// photo of the year (a week's average once the year is busy), a dot per photo in its film's tint, and the warmest and
// coldest day spelled out underneath (lib/tempYear.ts).

import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { monthDay, tr } from '../lib/i18n';
import { SMOOTH_FROM, tempYear } from '../lib/tempYear';
import type { Shot } from '../lib/store';
import { C, FILM_TINT, MONO } from '../ui/theme';

const H = 56;

export default function TempLine({ year, shots }: { year: number; shots: Shot[] }) {
  const [w, setW] = useState(0);
  const t = useMemo(() => (w ? tempYear(year, shots, w, H) : null), [year, shots, w]);
  const path = useMemo(() => {
    if (!t) return null;
    const b = Skia.PathBuilder.Make();
    t.line.forEach((pt, i) => (i ? b.lineTo(pt.x, pt.y) : b.moveTo(pt.x, pt.y)));
    return b.build();
  }, [t]);
  const busy = !!t && t.points.length > SMOOTH_FROM;
  const md = (day: string) => monthDay(Number(day.slice(5, 7)), Number(day.slice(8)));

  return (
    <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} style={s.box}>
      {t && path ? (
        <>
          <Text maxFontSizeMultiplier={1.3} style={s.head}>
            {tr('올해의 온도', 'The year in degrees', '今年の気温')}
          </Text>
          <Canvas style={{ width: w, height: H }}>
            {/* a busy year: small faint dots under the averaged line, which reads on top */}
            {t.points.map((pt) => (
              <Circle key={pt.day} cx={pt.x} cy={pt.y} r={busy ? 1.5 : 2.4} color={FILM_TINT[pt.film] ?? C.text} opacity={busy ? 0.55 : 1} />
            ))}
            <Path path={path} style="stroke" strokeWidth={busy ? 1.6 : 1.2} color={busy ? 'rgba(242,236,228,0.8)' : 'rgba(242,236,228,0.35)'} />
          </Canvas>
          <Text
            maxFontSizeMultiplier={1.3}
            style={s.foot}
            accessibilityLabel={tr(
              `가장 더웠던 날 ${md(t.hot.day)} ${Math.round(t.hot.temp)}도, 가장 추웠던 날 ${md(t.cold.day)} ${Math.round(t.cold.temp)}도`,
              `Warmest ${md(t.hot.day)}, ${Math.round(t.hot.temp)} degrees; coldest ${md(t.cold.day)}, ${Math.round(t.cold.temp)} degrees`,
              `いちばん暑かった日 ${md(t.hot.day)} ${Math.round(t.hot.temp)}度、いちばん寒かった日 ${md(t.cold.day)} ${Math.round(t.cold.temp)}度`,
            )}
          >
            {`▲ ${md(t.hot.day)} ${Math.round(t.hot.temp)}°   ▼ ${md(t.cold.day)} ${Math.round(t.cold.temp)}°`}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { marginHorizontal: 14, marginBottom: 10 },
  head: { color: C.dim, fontSize: 11, letterSpacing: 1.5, marginBottom: 4 },
  foot: { color: C.dim, fontFamily: MONO, fontSize: 11, marginTop: 4 },
});
