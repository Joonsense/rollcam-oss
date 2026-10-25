// One print in the photo viewer that can be looked at closely: double tap for
// 2.5x (and back), two fingers to pinch between 1x and 4x, one finger to move
// around while zoomed. The viewer stops paging while a print is zoomed
// (`onZoom`), so a drag moves the print instead of the roll.

import { useEffect, useMemo, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, View } from 'react-native';
import { clampPan, pinchScale } from '../lib/zoom';

type Props = { uri: string; width: number; onZoom: (zoomed: boolean) => void };

export default function ZoomPhoto({ uri, width, onZoom }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const [tx] = useState(() => new Animated.Value(0));
  const [ty] = useState(() => new Animated.Value(0));
  const [box, setBox] = useState({ w: width, h: 0 });

  // a print that goes away (flipped to its back, paged out) hands the roll back
  useEffect(() => () => onZoom(false), [onZoom]);
  const pan = useMemo(() => {
    // gesture state lives with the responder, outside React's render
    const g: { k: number; x: number; y: number; start: { k: number; d: number } | null; from: { x: number; y: number }; lastTap: number } = {
      k: 1,
      x: 0,
      y: 0,
      start: null,
      from: { x: 0, y: 0 },
      lastTap: 0,
    };
    const apply = (k: number, x: number, y: number, animate = false) => {
      const c = clampPan(k, x, y, box.w, box.h);
      const zoomedBefore = g.k > 1.01;
      g.k = k;
      g.x = c.x;
      g.y = c.y;
      if (animate) {
        Animated.parallel([
          Animated.spring(scale, { toValue: k, useNativeDriver: true, friction: 8 }),
          Animated.spring(tx, { toValue: c.x, useNativeDriver: true, friction: 8 }),
          Animated.spring(ty, { toValue: c.y, useNativeDriver: true, friction: 8 }),
        ]).start();
      } else {
        scale.setValue(k);
        tx.setValue(c.x);
        ty.setValue(c.y);
      }
      if (zoomedBefore !== k > 1.01) onZoom(k > 1.01);
    };
    const dist = (t: readonly { pageX: number; pageY: number }[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
    // a rebuilt responder (the box changed size) starts from 1x: put the print back with it
    scale.setValue(1);
    tx.setValue(0);
    ty.setValue(0);
    onZoom(false);
    const two = (e: { nativeEvent: { touches: readonly unknown[] } }) => e.nativeEvent.touches.length >= 2;
    const handlers = PanResponder.create({
      // claim a second finger before the roll's horizontal scroll does
      onStartShouldSetPanResponderCapture: two,
      onMoveShouldSetPanResponderCapture: two,
      onStartShouldSetPanResponder: (e) => two(e) || g.k > 1.01,
      onMoveShouldSetPanResponder: (e) => two(e) || g.k > 1.01,
      onPanResponderGrant: () => {
        g.start = null;
        g.from = { x: g.x, y: g.y };
      },
      onPanResponderMove: (e, st) => {
        const t = e.nativeEvent.touches;
        if (t.length >= 2) {
          g.start ??= { k: g.k, d: dist(t) };
          apply(pinchScale(g.start.k, g.start.d, dist(t)), g.x, g.y);
        } else if (g.k > 1.01 && !g.start) {
          apply(g.k, g.from.x + st.dx, g.from.y + st.dy);
        }
      },
      onPanResponderRelease: () => {
        g.start = null;
        if (g.k < 1.05) apply(1, 0, 0, true);
      },
      // while zoomed, the roll may not take the drag away
      onPanResponderTerminationRequest: () => g.k <= 1.01,
    }).panHandlers;
    // a quick touch that barely moved; two within 300 ms toggle 2.5x
    const touch = { at: 0, x: 0, y: 0 };
    const down = (t: number, x: number, y: number) => Object.assign(touch, { at: t, x, y });
    const up = (t: number, x: number, y: number) => {
      if (t - touch.at > 250 || Math.hypot(x - touch.x, y - touch.y) > 12) return;
      if (t - g.lastTap < 300) {
        g.lastTap = 0;
        apply(g.k > 1.01 ? 1 : 2.5, 0, 0, true);
      } else g.lastTap = t;
    };
    return { handlers, down, up };
  }, [box.w, box.h, scale, tx, ty, onZoom]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onTouchStart={(e) => e.nativeEvent.touches.length === 1 && pan.down(e.nativeEvent.timestamp, e.nativeEvent.pageX, e.nativeEvent.pageY)}
      onTouchEnd={(e) => e.nativeEvent.touches.length === 0 && pan.up(e.nativeEvent.timestamp, e.nativeEvent.pageX, e.nativeEvent.pageY)}
      {...pan.handlers}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}>
        <Image source={{ uri }} style={s.photo} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  photo: { width: '100%', height: '100%' },
});
