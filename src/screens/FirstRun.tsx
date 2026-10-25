// First launch, before camera permission: three prints on the table to show
// what a day's film looks like, then one button. Sample prints are demo photos
// developed with the app's own films (store/photos/SOURCES.md, Unsplash License).

import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { C, FILM_TINT, MONO } from '../ui/theme';
import { tr, whyText } from '../lib/i18n';

const PRINTS = [
  { src: require('../../assets/samples/snow.jpg'), film: 'snow-pastel', name: 'Snow Pastel', why: '눈 내리는 오후', rot: -9, dx: -0.27, dy: 18 },
  { src: require('../../assets/samples/haze.jpg'), film: 'haze-film', name: 'Haze Film', why: '안개 낀 아침', rot: 8, dx: 0.27, dy: 26 },
  { src: require('../../assets/samples/golden.jpg'), film: 'golden-roll', name: 'Golden Roll', why: '해 지는 무렵', rot: -1.5, dx: 0, dy: 0 },
] as const;

/** `blocked`: the camera was denied for good, so the button opens system settings instead. */
export default function FirstRun({ onOpen, blocked = false }: { onOpen: () => void; blocked?: boolean }) {
  const { width } = useWindowDimensions();
  const w = Math.min(190, width * 0.46);
  const [rise] = useState(() => PRINTS.map(() => new Animated.Value(0)));
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // prints land one by one, then breathe a little
    Animated.stagger(
      160,
      rise.map((v) => Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true })),
    ).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [rise, drift]);

  return (
    <View style={s.fill}>
      <View style={[s.table, { height: w * 1.62 + 60 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {PRINTS.map((p, i) => (
          <Animated.View
            key={p.film}
            style={[
              s.print,
              {
                width: w,
                opacity: rise[i],
                transform: [
                  { translateX: p.dx * width },
                  { translateY: Animated.add(rise[i].interpolate({ inputRange: [0, 1], outputRange: [60, p.dy] }), drift.interpolate({ inputRange: [0, 1], outputRange: [0, i === 2 ? -6 : 4] })) },
                  { rotate: `${p.rot}deg` },
                ],
              },
            ]}
          >
            <Image source={p.src} style={{ width: w - 16, height: (w - 16) * 1.33 }} resizeMode="cover" />
            <View style={s.caption}>
              <View style={[s.chip, { backgroundColor: FILM_TINT[p.film] }]} />
              <Text style={s.film}>{p.name}</Text>
            </View>
            <Text style={s.why}>{whyText(p.why)}</Text>
          </Animated.View>
        ))}
      </View>

      <Text style={s.kicker}>ROLLCAM</Text>
      <Text style={s.title}>{tr('하루 한 장.\n필름은 날씨가 고릅니다.', 'One photo a day.\nThe weather picks the film.', '一日一枚。\nフィルムは天気が選ぶ。')}</Text>
      <Text style={s.body}>
        {blocked
          ? tr('카메라가 꺼져 있어요.\n설정 > 권한에서 카메라를 허용해 주세요.', 'The camera is off.\nAllow it in Settings > Permissions.', 'カメラがオフになっています。\n設定 > 権限でカメラを許可してください。')
          : tr('오늘의 필름은 찍는 순간 정해져요.\n사진은 이 기기에만 저장돼요.', "Today's film is decided the moment you shoot.\nPhotos stay on this phone.", '今日のフィルムは撮った瞬間に決まります。\n写真はこの端末にだけ保存されます。')}
      </Text>
      <Pressable
        onPress={blocked ? () => Linking.openSettings() : onOpen}
        style={({ pressed }) => [s.cta, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
        accessibilityRole="button"
        accessibilityHint={blocked ? tr('앱 설정을 열어요', 'Opens app settings', 'アプリの設定を開きます') : tr('카메라 권한을 요청해요', 'Asks for camera access', 'カメラの権限をリクエストします')}
      >
        <Text style={s.ctaText}>{blocked ? tr('설정에서 카메라 켜기', 'Turn on the camera in Settings', '設定でカメラをオンに') : tr('첫 필름 넣기', 'Load the first film', '最初のフィルムを入れる')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  table: { width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  print: {
    position: 'absolute',
    backgroundColor: '#F4EFE6',
    padding: 8,
    paddingBottom: 10,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  chip: { width: 7, height: 7, borderRadius: 1.5 },
  film: { color: '#2A2420', fontFamily: MONO, fontSize: 10, fontWeight: '700' },
  why: { color: '#7A6E62', fontSize: 9.5, marginTop: 2 },
  kicker: { color: C.safelight, fontFamily: MONO, letterSpacing: 4, marginBottom: 12 },
  title: { color: C.text, fontSize: 26, fontWeight: '700', textAlign: 'center', lineHeight: 36 },
  body: { color: C.dim, fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  cta: { marginTop: 26, backgroundColor: C.safelight, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 999 },
  ctaText: { color: C.bg, fontWeight: '700', fontSize: 16 },
});
