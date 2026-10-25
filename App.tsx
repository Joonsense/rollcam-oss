import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { planReminders } from './src/lib/reminders';
import { refreshWidget } from './src/widget/widget';
import { syncGallery } from './src/lib/galleryCopy';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import CameraScreen from './src/screens/CameraScreen';
import RollDoneCard, { pendingRoll } from './src/screens/RollDoneCard';
import RollScreen from './src/screens/RollScreen';
import YearCard, { pendingYear } from './src/screens/YearCard';
import WhatsNew from './src/screens/WhatsNew';
import { allShots, getSetting, setSetting } from './src/lib/store';
import { WHATS_NEW_ID, whatsNewDue } from './src/lib/whatsNew';
import { C } from './src/ui/theme';
import { lang, tr, type Lang } from './src/lib/i18n';
import { applyLang } from './src/lib/lang';
import { monthKey } from './src/lib/day';
import { FILM_FOCUS, linkTarget } from './src/lib/links';

type Tab = 'camera' | 'roll';

// the launch link was already followed (a language change remounts Shell)
let launchLinkDone = false;

function Shell({ startTab, onLang }: { startTab: Tab; onLang: (l: Lang) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>(startTab);
  const [version, setVersion] = useState(0);
  // last month's roll card, once per month on the first open after it ends
  const [done, setDone] = useState<string | null>(() => pendingRoll());
  // the year-end card, once a year from Dec 15 (lib/recap.ts)
  const [yearDue, setYearDue] = useState<number | null>(() => pendingYear());
  // this release's "what's new" card, for people who already have a roll
  const [news, setNews] = useState(() => whatsNewDue(getSetting('whatsNew', ''), allShots().length));
  const closeNews = useCallback(() => {
    setSetting('whatsNew', WHATS_NEW_ID);
    setNews(false);
  }, []);
  // 'YYYY-MM' opens that month, 'YYYY' that year
  const [focus, setFocus] = useState<string | null>(null);
  const onShot = useCallback(() => {
    setVersion((v) => v + 1);
    // first shot is the moment to ask for the evening reminder
    planReminders(true);
    refreshWidget();
  }, []);

  // a restored zip changes the roll like a shot does, minus the reminder ask
  const onRestored = useCallback(() => {
    setVersion((v) => v + 1);
    refreshWidget();
  }, []);

  // app icon shortcuts and other rollcam:// links: camera, roll, book (plugins/withLauncher.js)
  useEffect(() => {
    const follow = (url: string | null | undefined) => {
      const to = linkTarget(url);
      if (!to) return;
      setTab(to === 'camera' ? 'camera' : 'roll');
      if (to === 'book') setFocus(`${FILM_FOCUS}${Date.now()}`);
      // the roll opens on this month, wherever it was left
      if (to === 'roll') setFocus(`${monthKey(new Date())}@${Date.now()}`);
    };
    if (!launchLinkDone) {
      launchLinkDone = true;
      Linking.getInitialURL().then(follow, () => {});
    }
    const sub = Linking.addEventListener('url', (e) => follow(e.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // a new install has nothing to catch up on: its first roll starts on this release
    if (allShots().length === 0) setSetting('whatsNew', WHATS_NEW_ID);
    planReminders(false);
    refreshWidget();
    // a print back from the lab ("아침에 현상") joins the album on the first open after 7
    syncGallery().catch(() => {});
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      planReminders(false);
      refreshWidget();
      syncGallery().catch(() => {});
      setDone((d) => d ?? pendingRoll());
      setYearDue((y) => y ?? pendingYear());
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={s.fill}>
      <StatusBar style="light" />
      {/* Camera stays mounted only while visible so the sensor is released on the roll tab. */}
      {tab === 'camera' ? <CameraScreen onShot={onShot} /> : <RollScreen version={version} focus={focus} onRestored={onRestored} onLang={onLang} />}
      <RollDoneCard
        month={done}
        onClose={() => setDone(null)}
        onOpen={(m) => {
          setDone(null);
          setFocus(m);
          setTab('roll');
        }}
      />
      {/* after last month's card, never on top of it */}
      <YearCard
        year={done ? null : yearDue}
        onClose={() => setYearDue(null)}
        onOpen={(y) => {
          setYearDue(null);
          setFocus(String(y));
          setTab('roll');
        }}
      />
      {/* after the month and year cards, never on top of them */}
      <WhatsNew open={news && !done && !yearDue} onClose={closeNews} />
      {/* the roll scrolls under the floating tabs: fade it out instead of cutting through buttons */}
      {tab === 'roll' ? (
        <Canvas style={[s.fade, { height: insets.bottom + FADE }]} pointerEvents="none">
          <Rect x={0} y={0} width={width} height={insets.bottom + FADE}>
            <LinearGradient start={vec(0, 0)} end={vec(0, FADE * 0.7)} colors={['rgba(14,13,12,0)', C.bg]} />
          </Rect>
        </Canvas>
      ) : null}
      <View style={[s.tabs, { bottom: insets.bottom + 10 }]} pointerEvents="box-none">
        <View style={s.pill} accessibilityRole="tablist">
          {(['camera', 'roll'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabOn]} hitSlop={6} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <Text maxFontSizeMultiplier={1.3} style={[s.tabText, tab === t && s.tabTextOn]}>{t === 'camera' ? tr('카메라', 'Camera', 'カメラ') : tr('내 롤', 'My roll', 'マイロール')}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function App() {
  // a language change from Settings redraws everything, back on the roll tab it came from
  const [ui, setUi] = useState<{ lang: Lang; tab: Tab }>(() => ({ lang: lang(), tab: 'camera' }));
  const onLang = useCallback((l: Lang) => {
    setUi({ lang: l, tab: 'roll' });
    // reminder texts and the widget are worded at plan / render time
    planReminders(false);
    refreshWidget();
  }, []);
  // the phone's per-app language (Android 13+ Settings) can change while away; on Auto, follow it
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      const l = applyLang();
      setUi((u) => (u.lang === l ? u : { lang: l, tab: 'camera' }));
    });
    return () => sub.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <Shell key={ui.lang} startTab={ui.tab} onLang={onLang} />
    </SafeAreaProvider>
  );
}

const FADE = 96;

const s = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fill: { flex: 1, backgroundColor: C.bg },
  tabs: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', backgroundColor: 'rgba(20,18,16,0.82)', borderRadius: 999, padding: 3, borderWidth: 1, borderColor: C.edge },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  tabOn: { backgroundColor: C.text },
  tabText: { color: C.dim, fontSize: 12, fontWeight: '600' },
  tabTextOn: { color: C.bg },
});
