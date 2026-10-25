// A horizon line across the viewfinder's centre that turns with the phone and
// goes amber (one light tick) when it is level. Shown with the grid.

import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { levelState, smooth, tiltDeg } from '../lib/level';
import { C } from '../ui/theme';

export default function Level() {
  const [angle] = useState(() => new Animated.Value(0));
  const [state, setState] = useState<'off' | 'tilted' | 'level'>('off');
  const last = useRef<number | null>(null);
  const shown = useRef<'off' | 'tilted' | 'level'>('off');
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let live = true;
    Accelerometer.isAvailableAsync().then((ok) => {
      if (!ok || !live) return;
      Accelerometer.setUpdateInterval(60);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const t = smooth(last.current, tiltDeg(x, y, z, Platform.OS));
        last.current = t;
        // the world turns the other way on screen
        if (t !== null) angle.setValue(-t);
        const next = levelState(t);
        if (next === shown.current) return;
        // one tick on coming level, not on every reading that stays level
        if (next === 'level' && shown.current === 'tilted') Haptics.selectionAsync();
        shown.current = next;
        setState(next);
      });
    }, () => {});
    return () => {
      live = false;
      sub?.remove();
    };
  }, [angle]);
  if (state === 'off') return null;
  const on = state === 'level';
  return (
    <View style={s.wrap} pointerEvents="none">
      <View style={[s.mark, s.left, on && s.markOn]} />
      <Animated.View style={[s.line, on && s.lineOn, { transform: [{ rotate: angle.interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] }) }] }]} />
      <View style={[s.mark, s.right, on && s.markOn]} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: '50%', left: 0, right: 0, height: 2, marginTop: -1, alignItems: 'center', justifyContent: 'center' },
  line: { width: '44%', height: 1.5, backgroundColor: 'rgba(242,236,228,0.75)' },
  lineOn: { backgroundColor: C.safelight, height: 2 },
  mark: { position: 'absolute', width: 18, height: 1.5, backgroundColor: 'rgba(242,236,228,0.5)' },
  markOn: { backgroundColor: C.safelight },
  left: { left: '18%' },
  right: { right: '18%' },
});
