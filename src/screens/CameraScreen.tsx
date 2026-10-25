import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import type { SkImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Animated, Easing, Image, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey, msUntilMidnight } from '../lib/day';
import { develop, loadImage } from '../lib/develop';
import { isLucky } from '../lib/lucky';
import { syncGallery } from '../lib/galleryCopy';
import { findEcho } from '../lib/echo';
import { FILM_NAMES, chooseFilm, firstSnowDue, specialDay, type FilmId, type Weather } from '../lib/film';
import { LOOKS } from '../lib/looks';
import { filmLut } from '../lib/lutStore';
import { sharePhoto } from '../lib/share';
import { flashLabel, flashMode, lockedLayout, nextFlash, nextTimer, pinchZoom, printSize, readFacing, readFlash, readTimer, timerLabel, touchDistance, type Facing, type Flash, type Timer } from '../lib/camera';
import { filmBook } from '../lib/filmbook';
import { allShots, getSetting, getShot, isAtLab, monthShots, photoUri, saveShot, setMemo, setSetting, type Shot } from '../lib/store';
import { labLine, waitKey } from '../lib/lab';
import { memoEditable } from '../lib/memo';
import { capsuleDate, capsuleWaiting } from '../lib/capsule';
import { currentStreak, milestoneLine } from '../lib/streak';
import { blueNote, lightNote, moonNote } from '../lib/light';
import { readStamp } from '../lib/stampColor';
import { thumbUri } from '../lib/thumbs';
import { skyWord } from '../lib/sky';
import { quote, reasonText, tr } from '../lib/i18n';
import { filmInputs, lastPlace, notePlace, refreshConditions, tomorrowOutlook } from '../lib/conditions';
import { outlookSlots, type OutlookSlot } from '../lib/outlook';
import { planReminders } from '../lib/reminders';
import { refreshWidget } from '../widget/widget';
import { C, FILM_TINT, MONO } from '../ui/theme';
import { useReduceMotion } from '../ui/useReduceMotion';
import FirstRun from './FirstRun';
import MemoSheet from './MemoSheet';
import PhotoViewer from './PhotoViewer';
import PrintBack from './PrintBack';
import Viewfinder from './Viewfinder';

function useToday() {
  const [today, setToday] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const t = setTimeout(() => setToday(dayKey(new Date())), msUntilMidnight(new Date()) + 500);
    return () => clearTimeout(t);
  }, [today]);
  return today;
}

/** Dev builds only: develop the test photo with every film into files/looks/ for tuning. */
function devAllLooks(img: SkImage, now: Date) {
  const dir = new Directory(Paths.document, 'looks');
  if (!dir.exists) dir.create();
  for (const id of Object.keys(LOOKS) as FilmId[]) {
    const t0 = Date.now();
    filmLut(LOOKS[id]); // bake + save on first run, disk read after
    const t1 = Date.now();
    new File(dir, `${id}.jpg`).writeSync(develop(img, LOOKS[id], { date: now, stamp: true, seed: now.getTime() }));
    console.log(`[rollcam] ${id} lut ${t1 - t0}ms develop+write ${Date.now() - t1}ms`);
  }
}

function untilMidnight(): string {
  const m = Math.ceil(msUntilMidnight(new Date()) / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? tr(`${h}시간 ${m % 60}분`, `${h} h ${m % 60} min`, `${h}時間${m % 60}分`) : tr(`${m}분`, `${m} min`, `${m}分`);
}

/** Viewfinder readout: sky word and temperature only ('맑음 · 8°'). */
function skyNow(w: Weather | null | undefined): string {
  if (!w) return '';
  return [skyWord(w.code), w.tempC !== undefined ? `${Math.round(w.tempC)}°` : ''].filter(Boolean).join(' · ');
}

/** 'HH:MM:SS' until the next roll, ticking once a second while mounted. */
function useCountdown(active: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  const left = Math.max(0, Math.floor(msUntilMidnight(new Date(now)) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(left / 3600))}:${p(Math.floor((left % 3600) / 60))}:${p(left % 60)}`;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * The film name rolls in like a split-flap sign once the print has come up:
 * letters settle left to right. `run` changes per shot so a reopen shows it settled.
 */
function FilmName({ name, run, delay }: { name: string; run: number; delay: number }) {
  const [shown, setShown] = useState('');
  const still = useReduceMotion();
  useEffect(() => {
    if (!run || still) return;
    let tick = 0;
    let iv: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      iv = setInterval(() => {
        tick++;
        const settled = Math.floor(tick / 2);
        setShown(
          name
            .split('')
            .map((ch, i) => (i < settled || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
            .join(''),
        );
        if (settled >= name.length && iv) clearInterval(iv);
      }, 45);
    }, delay);
    return () => {
      clearTimeout(start);
      if (iv) clearInterval(iv);
    };
  }, [name, run, delay, still]);
  return <Text style={s.topFilm}>{run && !still ? shown || ' ' : name}</Text>;
}

/**
 * Location is asked after a photo, never before the first one (spec §2: first
 * photo within 10 s). Shows when the permission is still askable and the user
 * hasn't said "later".
 */
function useLocationAsk(active: boolean) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active || getSetting('locAsk', '') === 'later') return;
    let live = true;
    Location.getForegroundPermissionsAsync().then((p) => live && setShow(!p.granted && p.canAskAgain));
    return () => {
      live = false;
    };
  }, [active]);
  const allow = async () => {
    setShow(false);
    if ((await Location.requestForegroundPermissionsAsync()).granted) refreshConditions(false);
  };
  const later = () => {
    setShow(false);
    setSetting('locAsk', 'later');
  };
  return { show, allow, later };
}

export default function CameraScreen({ onShot }: { onShot: () => void }) {
  const insets = useSafeAreaInsets();
  const [perm, requestPerm, getPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const today = useToday();
  // re-read when the day rolls over or after a save
  const [saves, setSaves] = useState(0);
  const shot = useMemo<Shot | null>(() => getShot(today), [today, saves]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // lens and flash, remembered across days
  const [facing, setFacing] = useState<Facing>(() => readFacing(getSetting('facing', '')));
  const [flash, setFlash] = useState<Flash>(() => readFlash(getSetting('flash', '')));
  // self-timer and the composition grid, also remembered (the grid shares Settings' switch)
  const [timer, setTimer] = useState<Timer>(() => readTimer(getSetting('timer', '')));
  const [grid, setGrid] = useState(() => getSetting('grid', '0') === '1');
  // seconds left on a running self-timer, null when none runs
  const [count, setCount] = useState<number | null>(null);
  // pinch to zoom on the viewfinder, double tap back to wide; starts wide every day
  const [zoom, setZoom] = useState(0);
  const pinch = useMemo(() => {
    // gesture state lives with the responder, outside React's render: where
    // the pinch started, the last tap time, and the zoom last set (never read
    // back from a state updater, which may run after the release handler)
    const g0: { start: { z0: number; d0: number } | null; lastTap: number; zoom: number } = { start: null, lastTap: 0, zoom: 0 };
    const set = (z: number) => {
      g0.zoom = z;
      setZoom(z);
    };
    const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2,
      onPanResponderGrant: () => {
        g0.start = null;
      },
      onPanResponderMove: (e) => {
        const d = touchDistance(e.nativeEvent.touches);
        // a finger lifted: the next two-finger touch starts a fresh pinch from the zoom it left
        if (d === null) {
          g0.start = null;
          return;
        }
        g0.start ??= { z0: g0.zoom, d0: d };
        set(pinchZoom(g0.start.z0, g0.start.d0, d));
      },
      onPanResponderRelease: (e, g) => {
        const wasPinch = g0.start !== null;
        g0.start = null;
        if (wasPinch || Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10) return;
        const t = e.nativeEvent.timestamp;
        if (t - g0.lastTap < 300) {
          g0.lastTap = 0;
          set(0);
        } else g0.lastTap = t;
      },
    });
    return { pan, reset: () => set(0) };
  }, []);
  // a new day starts wide, even if the camera tab stayed open over midnight
  useEffect(() => pinch.reset(), [today, pinch]);
  const flip = useCallback(() => {
    Haptics.selectionAsync();
    pinch.reset(); // each lens has its own range
    setReady(false); // the new lens reports ready again
    setFacing((f) => {
      const next = f === 'back' ? 'front' : 'back';
      setSetting('facing', next);
      return next;
    });
  }, [pinch]);
  const cycleFlash = useCallback(() => {
    Haptics.selectionAsync();
    const next = nextFlash(flash, facing);
    setSetting('flash', next);
    setFlash(next);
  }, [flash, facing]);
  const cycleTimer = useCallback(() => {
    Haptics.selectionAsync();
    const next = nextTimer(timer);
    setSetting('timer', String(next));
    setTimer(next);
  }, [timer]);
  const toggleGrid = useCallback(() => {
    Haptics.selectionAsync();
    setSetting('grid', grid ? '0' : '1');
    setGrid(!grid);
  }, [grid]);
  // 1 = fully developed; a new shot resets to 0 and fades in
  const [develop$] = useState(() => new Animated.Value(1));
  const loc = useLocationAsk(!!shot);
  // a year (or a month) ago today, shown under today's print
  const echo = useMemo(() => (shot ? findEcho(today, getShot) : null), [today, shot]);
  const [echoOpen, setEchoOpen] = useState<number | null>(null);
  // a sealed line from a year ago opens with today's shot
  // capsuleWaiting also finds a Feb 29 letter on Feb 28, which the echo lookup would miss
  const echoLetter = useMemo(() => (shot ? (capsuleWaiting(today, getShot)?.capsule ?? null) : null), [shot, today]);
  const letterWaiting = useMemo(() => (shot ? null : capsuleWaiting(today, getShot)), [shot, today]);
  // a print from this date in an earlier year, waiting to sit next to today's
  const echoWaiting = useMemo(() => {
    if (shot) return null;
    const e = findEcho(today, getShot);
    // any earlier year (a Feb 29 print shows on Feb 28), not the month-ago one
    return e && e.shot.day.slice(0, 4) !== today.slice(0, 4) && e.shot.day.slice(5, 7) === today.slice(5, 7) ? e.label : null;
  }, [shot, today]);
  // today's film in the film book: a first-time film gets its own line
  const book = useMemo(() => (shot ? filmBook(allShots()) : null), [shot]);
  const freshFilm = !!shot && book?.entries.find((e) => e.film === shot.film)?.first === shot.day;
  // days in a row up to today, and a mark when today reaches 7, 30, 100 ...
  const run = useMemo(() => (shot ? currentStreak(today, (d) => !!getShot(d)) : 0), [shot, today]);
  const milestone = milestoneLine(run);
  // the print turns over to show the lab stamp on its back
  const [flip$] = useState(() => new Animated.Value(0));
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  // short phones drop the dead shutter and the year-ago card before the print shrinks
  const fit = lockedLayout(useWindowDimensions().height);
  const [ratio, setRatio] = useState(0.75);
  useEffect(() => {
    if (shot) Image.getSize(photoUri(shot.file), (w, h) => h > 0 && setRatio(w / h), () => {});
  }, [shot]);
  const [flipped, setFlipped] = useState(false);
  const print = printSize(stage, ratio);
  const [sharing, setSharing] = useState(false);
  // "오늘의 한 줄" sheet
  const [memoOpen, setMemoOpen] = useState(false);
  const saveMemo = useCallback(
    (m: string, letter: string) => {
      setMemoOpen(false);
      if (!shot) return;
      if (!memoEditable(shot.day, dayKey(new Date()))) {
        // written across midnight: the print has set, say so instead of dropping the words silently
        if (m || letter) setError(tr('자정이 지나 어제 인화가 고정됐어요. 쓰던 한 줄은 남지 않았어요', "Midnight passed and yesterday's print has set, so that line wasn't kept", '0時を過ぎて昨日のプリントは固定されました。書きかけの一行は残りませんでした'));
        return;
      }
      setMemo(shot.day, m, letter);
      setSaves((n) => n + 1);
      refreshWidget();
    },
    [shot],
  );
  const [fakeView] = useState(() => {
    if (!__DEV__) return null;
    const f = new File(Paths.document, 'viewfinder.jpg');
    return f.exists ? f.uri : null;
  });
  const shotDays = useMemo(() => new Set(monthShots(today.slice(0, 7)).map((x) => x.day)), [today, saves]); // eslint-disable-line react-hooks/exhaustive-deps
  const [wx, setWx] = useState(() => skyNow(filmInputs(new Date()).weather));
  // light note for the viewfinder (golden, blue, a new film's sky, full moon),
  // refreshed every 30 s while framing; quiet on days something outranks the light
  const [light, setLight] = useState('');
  useEffect(() => {
    if (shot) return;
    const tick = () => {
      const now = new Date();
      const env = filmInputs(now);
      const special = specialDay(now, getSetting('birthday', '') || null);
      const shots = allShots();
      const firstSnow = firstSnowDue(dayKey(now), shots, lastPlace()?.lat);
      // a film the book doesn't have would load now (after the first photo): say so, never which
      const film = chooseFilm({ ...env, now, special, firstSnow }).film;
      const fresh = shots.length > 0 && !shots.some((x) => x.film === film);
      setLight(
        lightNote(now, env.sunrise, env.sunset, (at) => chooseFilm({ ...env, now: at, special, firstSnow }).film === 'golden-roll') ||
          blueNote(now, env.sunrise, env.sunset, (at) => chooseFilm({ ...env, now: at, special, firstSnow }).film === 'blue-hour') ||
          (fresh ? tr('✦ 도감에 없는 필름의 하늘', "✦ A new film's sky", '✦ 図鑑にないフィルムの空') : '') ||
          moonNote(now, env.sunrise, env.sunset),
      );
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [shot, today]);
  const countdown = useCountdown(!!shot);
  // shot with "아침에 현상" on: the paper stays dark until 7 tomorrow (the countdown re-renders it every second)
  const atLab = !!shot && isAtLab(shot.day);
  // once today's roll is wound: which films tomorrow's sky is likely to load, and when
  const [outlook, setOutlook] = useState<OutlookSlot[] | null>(null);
  // the print area ends where the shutter stack begins, whatever that stack holds today
  const [bottomH, setBottomH] = useState(224);
  useEffect(() => {
    if (!shot) return;
    let live = true;
    tomorrowOutlook().then((o) => {
      if (!live || !o) return;
      const [y, m, d] = o.day.split('-').map(Number);
      setOutlook(outlookSlots(o, specialDay(new Date(y, m - 1, d, 12), getSetting('birthday', '') || null), firstSnowDue(o.day, allShots(), lastPlace()?.lat), lastPlace()?.lat));
      // the outlook may hold a film the book is missing: re-plan so its alert goes out
      planReminders(false);
    });
    return () => {
      live = false;
    };
  }, [shot, today]);
  const collected = useMemo(() => new Set(book?.entries.filter((e) => e.first).map((e) => e.film)), [book]);
  // shutter curtain: a black blink the moment the shutter fires
  const [blink$] = useState(() => new Animated.Value(0));
  // bumps per new shot so the film name rolls in once; 0 = show settled
  const [revealRun, setRevealRun] = useState(0);

  // Coming back from system settings with the camera allowed: re-read, the hook only checks on mount.
  useEffect(() => {
    if (perm?.granted) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') getPerm();
    });
    return () => sub.remove();
  }, [perm?.granted, getPerm]);

  // Warm the weather cache while the user frames the shot (never prompts:
  // location is asked after a photo), then bake the likely film's LUT so the
  // shutter doesn't pay for it.
  useEffect(() => {
    if (!perm?.granted || shot) return;
    let live = true;
    refreshConditions(false)
      .then(() => {
        if (!live) return;
        const now = new Date();
        setWx(skyNow(filmInputs(now).weather));
        const pick = chooseFilm({ now, ...filmInputs(now), special: specialDay(now, getSetting('birthday', '') || null), firstSnow: firstSnowDue(dayKey(now), allShots(), lastPlace()?.lat) });
        filmLut(LOOKS[pick.film]);
      })
      .catch(() => {}); // the shot bakes it then
    return () => {
      live = false;
    };
  }, [perm?.granted, shot, today]);

  const take = useCallback(async () => {
    if (!cam.current || busy || shot || !ready) return;
    setBusy(true);
    setError(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Animated.sequence([
        Animated.timing(blink$, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(blink$, { toValue: 0, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
      const t0 = Date.now();
      const pic = await cam.current.takePictureAsync({ quality: 0.92, shutterSound: true });
      const t1 = Date.now();
      const now = new Date();
      const env = filmInputs(now);
      const pick = chooseFilm({ now, ...env, special: specialDay(now, getSetting('birthday', '') || null), firstSnow: firstSnowDue(dayKey(now), allShots(), lastPlace()?.lat) });
      // Dev builds only: emulator still captures are black frames, so a pushed
      // test photo (files/debug.jpg) stands in to check the film look.
      const debug = __DEV__ ? new File(Paths.document, 'debug.jpg') : null;
      const img = await loadImage(debug?.exists ? debug.uri : pic.uri);
      if (debug?.exists && new File(Paths.document, 'looks-all').exists) devAllLooks(img, now);
      const t2 = Date.now();
      const jpeg = develop(img, LOOKS[pick.film], { date: now, stamp: getSetting('stamp', '1') === '1', seed: now.getTime(), stampColor: readStamp(getSetting('stampColor', '')), lucky: isLucky(now.getTime()) });
      const t3 = Date.now();
      saveShot({ day: dayKey(now), film: pick.film, reason: pick.reason, weather: env.weather ?? null, takenAt: now.getTime() }, jpeg);
      // "아침에 현상": the print goes to the lab until 7 tomorrow (lib/lab.ts)
      if (getSetting('lab', '0') === '1') setSetting(waitKey(dayKey(now)), '1');
      // where it was shot counts toward home, for the Travel film (lib/home.ts)
      notePlace();
      syncGallery().catch(() => {}); // the album copy, when on; a failure waits for the next one
      if (__DEV__) console.log(`[rollcam] capture ${t1 - t0}ms decode ${t2 - t1}ms develop ${t3 - t2}ms save ${Date.now() - t3}ms`);
      develop$.setValue(0);
      setSaves((n) => n + 1);
      setRevealRun((n) => n + 1);
      // darkroom tray: the print comes up out of safelight red over a few seconds
      Animated.timing(develop$, { toValue: 1, duration: 3200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // the lever winds on to the next frame: a few ratchet clicks
      [260, 360, 460, 560].forEach((ms) => setTimeout(() => Haptics.selectionAsync(), ms));
      onShot();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, shot, ready, develop$, blink$, onShot]);

  // the self-timer counts down once a second with a tick, then fires the
  // shutter; the shutter pressed again, leaving the app or the day ending stops it
  const takeRef = useRef(take);
  useEffect(() => {
    takeRef.current = take;
  }, [take]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopCount = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setCount(null);
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st !== 'active' && stopCount());
    return () => {
      sub.remove();
      stopCount();
    };
  }, [stopCount]);
  useEffect(() => stopCount, [today, stopCount]);
  const press = useCallback(() => {
    if (countdownRef.current) {
      Haptics.selectionAsync();
      stopCount();
      return;
    }
    if (!timer) {
      take();
      return;
    }
    if (!cam.current || busy || shot || !ready) return;
    let left: number = timer;
    setCount(left);
    Haptics.selectionAsync();
    countdownRef.current = setInterval(() => {
      left -= 1;
      if (left > 0) {
        setCount(left);
        Haptics.selectionAsync();
        return;
      }
      stopCount();
      takeRef.current();
    }, 1000);
  }, [timer, take, busy, shot, ready, stopCount]);
  const counting = count !== null;

  const turn = useCallback(() => {
    Haptics.selectionAsync();
    setFlipped((f) => {
      Animated.spring(flip$, { toValue: f ? 0 : 1, friction: 7, tension: 36, useNativeDriver: true }).start();
      return !f;
    });
  }, [flip$]);

  const share = useCallback(async () => {
    if (!shot || sharing) return;
    setSharing(true);
    setError(null);
    try {
      await sharePhoto(shot);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  }, [shot, sharing]);

  if (!perm) return <View style={s.fill} />;

  if (!perm.granted) return <FirstRun onOpen={requestPerm} blocked={!perm.canAskAgain} />;

  return (
    <View style={s.fill}>
      {shot ? (
        <View style={[s.fill, s.center, { paddingTop: insets.top + 56, paddingBottom: bottomH + 16 }]}>
          {/* the print is sized to the photo's own aspect, so the paper border is all there is around it */}
          <View style={s.stage} onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <Animated.View
            style={[
              { width: print.width, height: print.height },
              {
                opacity: develop$.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.3, 1, 1] }),
                transform: [{ translateY: develop$.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
              },
            ]}
          >
            <Animated.View
              pointerEvents={flipped ? 'none' : 'auto'}
              style={[
                s.print,
                s.face,
                {
                  opacity: flip$.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [1, 1, 0, 0] }),
                  transform: [{ perspective: 1200 }, { rotateY: flip$.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
                },
              ]}
            >
              <Pressable onPress={turn} style={[s.printImg, { width: print.photo, alignSelf: 'center' }]} accessibilityRole="button" accessibilityLabel={tr(`오늘의 사진, ${FILM_NAMES[shot.film]}`, `Today's photo, ${FILM_NAMES[shot.film]}`, `今日の写真、${FILM_NAMES[shot.film]}`)} accessibilityHint={tr('눌러서 인화지 뒷면을 봐요', 'Tap to turn the print over', 'タップでプリントの裏を見る')}>
                <Image source={{ uri: photoUri(shot.file) }} style={s.photo} resizeMode="cover" />
                {atLab ? (
                  <View style={s.labOver} pointerEvents="none">
                    <Text style={s.labHead} numberOfLines={1} adjustsFontSizeToFit>
                      {tr('현상소에 맡겼어요', 'At the lab', '現像所に預けました')}
                    </Text>
                    <Text style={s.labWhen}>{labLine(shot.day, new Date())}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Animated.View pointerEvents="none" style={[s.tray, { left: (print.width - print.photo) / 2, right: (print.width - print.photo) / 2, opacity: develop$.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0.96, 0.08, 0] }) }]} />
              <View style={s.margin}>
                <Text style={s.marginDate}>{shot.day.replaceAll('-', '.')}</Text>
                <Pressable onPress={turn} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('인화지 뒷면 보기', 'Turn the print over', 'プリントの裏を見る')}>
                  <Text style={s.marginShare}>{tr('뒷면 ↻', 'Flip ↻', '裏 ↻')}</Text>
                </Pressable>
                {atLab ? null : (
                  <Pressable onPress={share} disabled={sharing} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('오늘 사진 공유', "Share today's photo", '今日の一枚を共有')}>
                    {sharing ? <ActivityIndicator size="small" color="#7A6E62" /> : <Text style={s.marginShare}>{tr('공유 ↗', 'Share ↗', '共有 ↗')}</Text>}
                  </Pressable>
                )}
              </View>
            </Animated.View>
            <Animated.View
              pointerEvents={flipped ? 'auto' : 'none'}
              style={[
                s.face,
                {
                  opacity: flip$.interpolate({ inputRange: [0, 0.499, 0.5, 1], outputRange: [0, 0, 1, 1] }),
                  transform: [{ perspective: 1200 }, { rotateY: flip$.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }],
                },
              ]}
            >
              <Pressable onPress={turn} style={s.fill} accessibilityRole="button" accessibilityLabel={tr('인화지 뒷면, 눌러서 사진으로 돌아가기', 'Back of the print, tap to turn it back', 'プリントの裏、タップで写真に戻る')}>
                <PrintBack shot={shot} frame={[...shotDays].filter((d) => d <= shot.day).length} book={{ found: book?.found ?? 0, total: book?.entries.length ?? 12 }} run={run} />
              </Pressable>
            </Animated.View>
          </Animated.View>
          </View>
          <Animated.Text style={[s.reason, { opacity: develop$.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] }) }]}>{reasonText(shot.reason)}</Animated.Text>
          <Animated.View style={{ opacity: develop$.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1] }) }}>
            {memoEditable(shot.day, today) ? (
              <Pressable onPress={() => setMemoOpen(true)} hitSlop={10} style={s.memoBtn} accessibilityRole="button" accessibilityLabel={shot.memo ? tr(`오늘의 한 줄, ${shot.memo}, 눌러서 고치기`, `Today's line, ${shot.memo}, tap to edit`, `今日の一行、${shot.memo}、タップで編集`) : tr('오늘의 한 줄 남기기', 'Write a line for today', '今日の一行を残す')}>
                {shot.memo ? <Text style={s.memo} numberOfLines={2}>{quote(shot.memo)}</Text> : <Text style={s.memoAdd}>{tr('✎ 오늘의 한 줄', '✎ A line for today', '✎ 今日の一行')}</Text>}
              </Pressable>
            ) : shot.memo ? (
              <Text style={[s.memo, s.memoBtn]} numberOfLines={2}>{quote(shot.memo)}</Text>
            ) : null}
            {shot.capsule ? <Text style={s.sealed}>{tr(`✉ ${capsuleDate(shot.day)} 아침에 열리는 편지를 봉인했어요`, `✉ Letter sealed until the morning of ${capsuleDate(shot.day)}`, `✉ ${capsuleDate(shot.day)}の朝に開く手紙を封じました`)}</Text> : null}
          </Animated.View>
          {freshFilm && book ? (
            <Animated.View
              style={[
                s.newFilm,
                {
                  opacity: develop$.interpolate({ inputRange: [0, 0.88, 1], outputRange: [0, 0, 1] }),
                  transform: [{ scale: develop$.interpolate({ inputRange: [0, 0.88, 0.95, 1], outputRange: [0.6, 0.6, 1.12, 1] }) }],
                },
              ]}
              accessible
              accessibilityLabel={tr(`처음 들어온 필름, 필름 도감 ${book.entries.length}종 중 ${book.found}종`, `A new film, ${book.found} of ${book.entries.length} in your film book`, `はじめて来たフィルム、図鑑${book.entries.length}種中${book.found}種`)}
            >
              <View style={[s.newDot, { backgroundColor: FILM_TINT[shot.film] }]} />
              <Text style={s.newText}>{tr('새 필름 · 도감', 'New film · Film book', '新しいフィルム · 図鑑')} {book.found} / {book.entries.length}</Text>
            </Animated.View>
          ) : null}
          {isLucky(shot.takenAt) ? (
            <Animated.View
              style={[
                s.newFilm,
                s.lucky,
                {
                  opacity: develop$.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0, 0, 1] }),
                  transform: [{ rotate: '-2deg' }, { scale: develop$.interpolate({ inputRange: [0, 0.9, 0.96, 1], outputRange: [0.6, 0.6, 1.15, 1] }) }],
                },
              ]}
              accessible
              accessibilityLabel={tr('럭키 컷, 빛이 새어 들어온 드문 한 장', 'Lucky frame, a rare one with light leaking in', 'ラッキーカット、光が漏れ込んだめずらしい一枚')}
            >
              <Text style={[s.newText, s.luckyText]}>{tr('✦ 럭키 컷 · 빛이 새어 들어왔어요', '✦ Lucky frame · light leaked in', '✦ ラッキーカット · 光が漏れ込みました')}</Text>
            </Animated.View>
          ) : null}
          {milestone ? (
            <Animated.View
              style={[s.newFilm, { opacity: develop$.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0, 0, 1] }) }]}
              accessible
              accessibilityLabel={milestone}
            >
              <Text style={s.newText}>✶ {milestone}</Text>
            </Animated.View>
          ) : null}
          {echoLetter ? (
            <Animated.View style={[s.letterCard, { opacity: develop$.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 0, 1] }) }]} accessible accessibilityLabel={`${tr('1년 전 오늘의 내가 남긴 편지', 'A letter from you a year ago today', '1年前の今日の自分からの手紙')}, ${echoLetter}`}>
              <Text style={s.letterHead}>{tr('✉ 1년 전 오늘의 내가 남긴 편지', '✉ A letter from you a year ago today', '✉ 1年前の今日の自分からの手紙')}</Text>
              <Text style={s.letterBody}>{echoLetter}</Text>
            </Animated.View>
          ) : null}
          {loc.show ? (
            <Animated.View style={[s.locCard, { opacity: develop$.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 0, 1] }) }]}>
              <Text style={s.locTitle}>{tr('내일부터는 지금 있는 곳 날씨로 필름을 골라요', 'From tomorrow, the weather where you are picks the film', '明日からは、いる場所の天気でフィルムを選びます')}</Text>
              <Text style={s.locNote}>{tr('대략적인 위치(약 10km)만 써요. 없으면 시간과 해로만 골라요.', 'Only an approximate location (about 10 km). Without it, the time of day and the sun decide.', 'おおよその位置(約10km)だけ使います。なければ時刻と太陽だけで選びます。')}</Text>
              <View style={s.locRow}>
                <Pressable onPress={loc.later} hitSlop={8} accessibilityRole="button">
                  <Text style={s.locLater}>{tr('괜찮아요', 'Not now', 'あとで')}</Text>
                </Pressable>
                <Pressable onPress={loc.allow} style={s.locAllow} accessibilityRole="button">
                  <Text style={s.locAllowText}>{tr('위치 허용', 'Allow location', '位置情報を許可')}</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : echo && fit.echo ? (
            <Animated.View style={{ opacity: develop$.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 0, 1] }) }}>
              <Pressable onPress={() => setEchoOpen(0)} style={s.echo} accessibilityRole="button" accessibilityLabel={tr(`${echo.label} 사진 보기, ${FILM_NAMES[echo.shot.film]}`, `See the photo from ${echo.label.toLowerCase()}, ${FILM_NAMES[echo.shot.film]}`, `${echo.label}の写真を見る、${FILM_NAMES[echo.shot.film]}`)}>
                <View style={s.echoPrint}>
                  <Image source={{ uri: thumbUri(echo.shot.file) }} style={s.echoImg} resizeMode="cover" resizeMethod="resize" />
                </View>
                <View>
                  <Text style={s.echoLabel}>{echo.label}</Text>
                  <View style={s.filmRow}>
                    <View style={[s.echoChip, { backgroundColor: FILM_TINT[echo.shot.film] }]} />
                    <Text style={s.echoFilm}>{FILM_NAMES[echo.shot.film]}</Text>
                  </View>
                  {echo.shot.memo ? (
                    <Text style={s.echoMemo} numberOfLines={1}>
                      {quote(echo.shot.memo)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </Animated.View>
          ) : null}
          <MemoSheet visible={memoOpen} day={shot.day} film={shot.film} memo={shot.memo} capsule={shot.capsule} onSave={saveMemo} onClose={() => setMemoOpen(false)} />
          {echo ? <PhotoViewer shots={[echo.shot]} start={echoOpen} onClose={() => setEchoOpen(null)} /> : null}
        </View>
      ) : (
        <>
          <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} flash={flashMode(flash, facing)} zoom={zoom} onCameraReady={() => setReady(true)} />
          {/* Dev builds only: the emulator camera shows a test room, so a pushed photo (files/viewfinder.jpg) stands in for store screenshots. */}
          {fakeView ? <Image source={{ uri: fakeView }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <Viewfinder today={today} shotDays={shotDays} weather={wx} light={light} grid={grid} top={insets.top} bottom={insets.bottom} />
          {letterWaiting ? (
            <View pointerEvents="none" style={[s.letter, { top: insets.top + 104 }]}>
              <Text style={s.letterText}>{tr('✉ 1년 전 오늘의 내가 남긴 편지 · 오늘 한 장을 찍으면 열려요', "✉ A letter from a year ago today · it opens with today's photo", '✉ 1年前の今日の自分からの手紙 · 今日の一枚を撮ると開きます')}</Text>
            </View>
          ) : echoWaiting ? (
            <View pointerEvents="none" style={[s.letter, { top: insets.top + 104 }]}>
              <Text style={[s.letterText, { color: C.text }]}>
                {tr(`${echoWaiting}의 사진이 있어요 · 오늘 찍으면 나란히 보여요`, `${echoWaiting}: a photo is waiting · shoot today's to see them side by side`, `${echoWaiting}の写真があります · 今日撮ると並んで見られます`)}
              </Text>
            </View>
          ) : null}
          <View style={StyleSheet.absoluteFill} {...pinch.pan.panHandlers} accessibilityHint={tr('두 손가락으로 벌려 확대, 두 번 탭하면 원래대로', 'Spread two fingers to zoom, double tap to reset', '2本指で広げて拡大、ダブルタップで元どおり')} />
          {zoom > 0 ? (
            <View pointerEvents="none" style={[s.zoom, { bottom: insets.bottom + 200 }]} accessible accessibilityLabel={tr(`확대 ${Math.round(zoom * 100)}퍼센트`, `Zoom ${Math.round(zoom * 100)} percent`, `ズーム${Math.round(zoom * 100)}パーセント`)}>
              <View style={s.zoomTrack}>
                <View style={[s.zoomFill, { width: `${Math.round(zoom * 100)}%` }]} />
              </View>
              <Text style={s.zoomText}>{tr('두 번 탭하면 원래대로', 'Double tap to reset', 'ダブルタップで元どおり')}</Text>
            </View>
          ) : null}
          {counting ? (
            <View pointerEvents="none" style={s.timerOverlay} accessible accessibilityLiveRegion="assertive" accessibilityLabel={tr(`${count}초`, `${count} seconds`, `${count}秒`)}>
              <Text maxFontSizeMultiplier={1.3} style={s.timerBig}>{count}</Text>
              <Text maxFontSizeMultiplier={1.3} style={s.timerHint}>{tr('셔터를 다시 누르면 멈춰요', 'Press the shutter again to stop', 'もう一度シャッターで止まります')}</Text>
            </View>
          ) : null}
        </>
      )}

      <View style={[s.top, { paddingTop: insets.top + (shot ? 12 : 48) }]}>
        <Text style={s.topLabel}>{tr('오늘의 필름', "Today's film", '今日のフィルム')}</Text>
        {shot ? (
          <View style={s.filmRow}>
            <View style={[s.filmChip, { backgroundColor: FILM_TINT[shot.film] }]} />
            <FilmName name={FILM_NAMES[shot.film]} run={revealRun} delay={2300} />
          </View>
        ) : (
          <Text style={[s.topFilm, { letterSpacing: 6 }]}>???</Text>
        )}
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 64 }]} onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}>
        {error ? <Text style={s.error}>{error}</Text> : null}
        {busy ? <Text style={s.developing}>{tr('현상 중 · 필름을 고르는 중', 'Developing · picking the film', '現像中 · フィルムを選んでいます')}</Text> : null}
        {shot ? (
          <View style={s.center}>
            {fit.shutter ? (
              <View style={[s.shutter, s.shutterLocked]} accessible accessibilityLabel={tr(`셔터 잠김, ${untilMidnight()} 뒤 새 필름`, `Shutter locked, new film in ${untilMidnight()}`, `シャッターはロック中、${untilMidnight()}後に新しいフィルム`)}>
                <View style={s.lockBar} />
              </View>
            ) : null}
            <Text style={s.countdown} accessibilityLabel={tr(`${untilMidnight()} 뒤 새 필름`, `New film in ${untilMidnight()}`, `${untilMidnight()}後に新しいフィルム`)}>{tr('새 필름까지', 'New film in', '新しいフィルムまで')} {countdown}</Text>
            {outlook?.length ? (
              <View style={s.outlook} accessible accessibilityLabel={`${tr('내일의 필름 예보', "Tomorrow's film forecast", '明日のフィルム予報')}, ${outlook.map((o) => `${o.labels.join(' ')} ${FILM_NAMES[o.film]}${collected.has(o.film) ? '' : tr(', 도감에 없는 필름', ', not in your book yet', '、図鑑にないフィルム')}`).join(', ')}`}>
                <Text style={s.outlookHead}>{tr('내일의 필름 예보', "Tomorrow's film forecast", '明日のフィルム予報')}</Text>
                <View style={s.outlookRow}>
                  {outlook.map((o) => (
                    <View key={o.labels[0]} style={s.outlookItem}>
                      <View style={[s.outlookChip, { backgroundColor: FILM_TINT[o.film] }]} />
                      <Text style={s.outlookWhen}>{outlook.length === 1 ? tr('하루 종일', 'All day', '一日中') : o.labels.join('·')}</Text>
                      <Text style={[s.outlookFilm, !collected.has(o.film) && { color: C.safelight }]}>
                        {collected.has(o.film) ? '' : '✦ '}
                        {FILM_NAMES[o.film]}
                      </Text>
                    </View>
                  ))}
                </View>
                {outlook.some((o) => !collected.has(o.film)) ? <Text style={s.outlookNote}>{tr('✦ 아직 도감에 없는 필름이에요', '✦ Not in your film book yet', '✦ まだ図鑑にないフィルムです')}</Text> : null}
              </View>
            ) : (
              <Text style={s.lockText}>{tr('오늘 롤은 감겼어요', "Today's roll is wound", '今日のロールは巻き上げました')}</Text>
            )}
          </View>
        ) : (
          <View style={s.shutterRow}>
            <Pressable onPress={cycleTimer} disabled={busy || counting} style={s.side} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${tr('셀프 타이머', 'Self-timer', 'セルフタイマー')} ${timerLabel(timer)}`} accessibilityHint={tr('눌러서 끔, 3초, 10초', 'Tap for off, 3 or 10 seconds', 'タップでオフ、3秒、10秒')}>
              <Text style={[s.sideIcon, timer > 0 && { color: C.safelight }]}>◔</Text>
              <Text style={[s.sideText, timer > 0 && { color: C.safelight }]}>{timerLabel(timer)}</Text>
            </Pressable>
            <Pressable onPress={cycleFlash} disabled={busy || counting} style={s.side} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${tr('플래시', 'Flash', 'フラッシュ')} ${flashLabel(flash, facing)}`} accessibilityHint={tr('눌러서 플래시를 바꿔요', 'Tap to change the flash', 'タップでフラッシュを切り替え')}>
              <Text style={[s.sideIcon, flashMode(flash, facing) !== 'off' && { color: C.safelight }]}>ϟ</Text>
              <Text style={[s.sideText, flashMode(flash, facing) !== 'off' && { color: C.safelight }]}>{flashLabel(flash, facing)}</Text>
            </Pressable>
            <Pressable
              onPress={press}
              disabled={busy || !ready}
              style={({ pressed }) => [s.shutter, pressed && { transform: [{ scale: 0.94 }] }]}
              accessibilityRole="button"
              accessibilityLabel={counting ? tr('타이머 멈추기', 'Stop the timer', 'タイマーを止める') : timer ? tr(`${timer}초 뒤 오늘의 한 장 찍기`, `Take today's photo in ${timer} seconds`, `${timer}秒後に今日の一枚を撮る`) : tr('오늘의 한 장 찍기', "Take today's photo", '今日の一枚を撮る')}
              accessibilityHint={tr('필름은 지금 날씨와 빛으로 정해져요', "The film is set by the weather and light right now", 'フィルムはいまの天気と光で決まります')}
              accessibilityState={{ disabled: busy || !ready, busy }}
            >
              {busy ? <ActivityIndicator color={C.safelight} /> : <View style={[s.shutterCore, counting && s.shutterCounting]} />}
            </Pressable>
            <Pressable onPress={flip} disabled={busy || counting} style={s.side} hitSlop={8} accessibilityRole="button" accessibilityLabel={facing === 'front' ? tr('셀카 렌즈, 눌러서 뒤 렌즈로', 'Selfie lens, tap for the rear lens', 'インカメラ、タップでアウトカメラへ') : tr('뒤 렌즈, 눌러서 셀카로', 'Rear lens, tap for selfie', 'アウトカメラ、タップでセルフィーへ')}>
              <Text style={s.sideIcon}>⇄</Text>
              <Text style={s.sideText}>{facing === 'front' ? tr('셀카', 'Selfie', 'セルフィー') : tr('뒤', 'Rear', 'アウト')}</Text>
            </Pressable>
            <Pressable onPress={toggleGrid} style={s.side} hitSlop={6} accessibilityRole="switch" accessibilityState={{ checked: grid }} accessibilityLabel={tr('구도 격자', 'Composition grid', '構図グリッド')}>
              <Text style={[s.sideIcon, grid && { color: C.safelight }]}>#</Text>
              <Text style={[s.sideText, grid && { color: C.safelight }]}>{tr('격자', 'Grid', 'グリッド')}</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: blink$ }]} />
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  topLabel: { color: C.text, opacity: 0.75, fontSize: 11, letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  topFilm: { color: C.text, fontFamily: MONO, fontSize: 15, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  zoom: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  zoomTrack: { width: 96, height: 3, borderRadius: 2, backgroundColor: 'rgba(242,236,228,0.25)', overflow: 'hidden' },
  zoomFill: { height: 3, backgroundColor: C.safelight },
  zoomText: { color: C.text, opacity: 0.8, fontSize: 10.5, marginTop: 6, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  // timer · flash · shutter · lens · grid fit a 320dp phone
  shutterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  side: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,13,12,0.55)', borderWidth: 1, borderColor: 'rgba(242,236,228,0.18)' },
  sideIcon: { color: C.text, fontSize: 16, lineHeight: 18 },
  sideText: { color: C.text, fontSize: 9.5, marginTop: 1, opacity: 0.85 },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: C.text, alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 66, height: 66, borderRadius: 33, backgroundColor: C.text },
  labOver: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: 10 },
  labHead: { width: '100%', color: C.safelight, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  labWhen: { width: '100%', color: C.text, opacity: 0.8, fontSize: 11.5, lineHeight: 16, marginTop: 8, textAlign: 'center' },
  shutterCounting: { width: 30, height: 30, borderRadius: 6, backgroundColor: C.safelight },
  timerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  timerBig: { color: C.text, fontFamily: MONO, fontSize: 96, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 12 },
  timerHint: { color: C.text, opacity: 0.85, fontSize: 12, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  shutterLocked: { borderColor: C.faint, backgroundColor: C.panel },
  lockBar: { width: 30, height: 4, borderRadius: 2, backgroundColor: C.faint },
  lockText: { color: C.dim, fontSize: 13, marginTop: 14 },
  developing: { color: C.safelight, fontFamily: MONO, fontSize: 12, letterSpacing: 1, marginBottom: 14, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 6 },
  countdown: { color: C.safelight, fontFamily: MONO, fontSize: 13, marginTop: 12, letterSpacing: 1 },
  outlook: { alignItems: 'center', marginTop: 10, paddingHorizontal: 16 },
  outlookHead: { color: C.dim, fontSize: 10.5, letterSpacing: 2, marginBottom: 5 },
  outlookRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 4 },
  outlookItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  outlookChip: { width: 7, height: 7, borderRadius: 1.5 },
  outlookWhen: { color: C.dim, fontSize: 11.5 },
  outlookFilm: { color: C.text, fontFamily: MONO, fontSize: 11.5 },
  outlookNote: { color: C.safelight, fontSize: 10.5, marginTop: 5, opacity: 0.85 },
  filmRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  filmChip: { width: 9, height: 9, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(242,236,228,0.5)' },
  stage: { width: '86%', flex: 1, alignItems: 'center', justifyContent: 'center' },
  face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' },
  print: { backgroundColor: '#F4EFE6', padding: 10, paddingBottom: 34, borderRadius: 2 },
  printImg: { flex: 1 },
  photo: { width: '100%', height: '100%' },
  lucky: { borderColor: '#FFC86B', backgroundColor: 'rgba(255,200,107,0.12)' },
  luckyText: { color: '#FFC86B' },
  newFilm: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: C.safelight },
  newDot: { width: 7, height: 7, borderRadius: 2 },
  newText: { color: C.safelight, fontFamily: MONO, fontSize: 12, letterSpacing: 0.5 },
  margin: { position: 'absolute', left: 12, right: 12, bottom: 8, height: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  marginDate: { color: '#9A8E80', fontFamily: MONO, fontSize: 11 },
  marginShare: { color: '#5A4E42', fontSize: 12, fontWeight: '700' },
  echo: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderRadius: 12, paddingVertical: 8, paddingLeft: 8, paddingRight: 16, borderWidth: 1, borderColor: C.edge },
  echoPrint: { backgroundColor: '#F4EFE6', padding: 3, paddingBottom: 7, borderRadius: 1, transform: [{ rotate: '-3deg' }] },
  echoImg: { width: 38, height: 50, backgroundColor: '#000' },
  echoLabel: { color: C.dim, fontSize: 11, letterSpacing: 1 },
  echoChip: { width: 7, height: 7, borderRadius: 1.5 },
  echoFilm: { color: C.text, fontFamily: MONO, fontSize: 13 },
  echoMemo: { color: C.dim, fontSize: 12, marginTop: 3, maxWidth: 220 },
  tray: { position: 'absolute', left: 10, right: 10, top: 10, bottom: 34, backgroundColor: '#3A0E06' },
  reason: { color: C.text, fontSize: 15, marginTop: 18, fontFamily: MONO },
  sealed: { color: C.dim, fontSize: 11.5, textAlign: 'center', marginTop: 6 },
  letterCard: { marginTop: 12, width: '86%', backgroundColor: C.panel, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.safelight },
  letterHead: { color: C.safelight, fontSize: 11.5, letterSpacing: 1 },
  letterBody: { color: C.text, fontSize: 14, lineHeight: 20, marginTop: 4 },
  letter: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  letterText: { color: C.safelight, fontSize: 12.5, textAlign: 'center', backgroundColor: 'rgba(14,13,12,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  memoBtn: { marginTop: 8, paddingHorizontal: 24 },
  memo: { color: C.text, fontSize: 14, textAlign: 'center', lineHeight: 20, opacity: 0.92 },
  memoAdd: { color: C.dim, fontSize: 13, textAlign: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: C.edge, overflow: 'hidden' },
  error: { color: C.safelight, marginBottom: 12, fontSize: 13 },
  locCard: { marginTop: 14, width: '86%', backgroundColor: C.panel, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.edge },
  locTitle: { color: C.text, fontSize: 14, fontWeight: '600' },
  locNote: { color: C.dim, fontSize: 12, marginTop: 4, lineHeight: 17 },
  locRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 10 },
  locLater: { color: C.dim, fontSize: 13 },
  locAllow: { backgroundColor: C.safelight, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  locAllowText: { color: C.bg, fontWeight: '700', fontSize: 13 },
});
