// The lucky frame's mark (✦) drawn as a path, since the share images' fonts
// don't all carry the glyph. A four-point star centred on (cx, cy).

import { Skia, type SkCanvas, type SkPaint } from '@shopify/react-native-skia';

export function drawSparkle(c: SkCanvas, cx: number, cy: number, r: number, paint: SkPaint) {
  const w = r * 0.28; // waist of the star
  c.drawPath(
    Skia.Path.Polygon(
      [
        { x: cx, y: cy - r },
        { x: cx + w, y: cy - w },
        { x: cx + r, y: cy },
        { x: cx + w, y: cy + w },
        { x: cx, y: cy + r },
        { x: cx - w, y: cy + w },
        { x: cx - r, y: cy },
        { x: cx - w, y: cy - w },
      ],
      true,
    ),
    paint,
  );
}
