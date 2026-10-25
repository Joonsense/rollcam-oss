// Text for images Skia draws (the share images). Skia's matched system font
// has no Hangul fallback, so we bundle RollcamSans: Pretendard (SIL OFL 1.1)
// cut down to the 11,172 Hangul syllables + Latin by scripts/make-font.py.
//
// Japanese has no glyphs there, and bundling kanji would cost megabytes, so in
// Japanese the text is laid out as a Skia paragraph: RollcamSans first, the
// phone's own CJK font for whatever it lacks (Skia's font fallback).

import { Skia, loadData, type SkCanvas, type SkFont, type SkPaint, type SkTypeface, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { isJa, tr } from './i18n';

const SOURCES = {
  regular: require('../../assets/fonts/RollcamSans-Regular.otf'),
  bold: require('../../assets/fonts/RollcamSans-Bold.otf'),
};

type Weight = keyof typeof SOURCES;
const faces = new Map<Weight, Promise<SkTypeface | null>>();

function typeface(w: Weight): Promise<SkTypeface | null> {
  let p = faces.get(w);
  if (!p) {
    p = loadData(SOURCES[w], (d) => Skia.Typeface.MakeFreeTypeFaceFromData(d));
    faces.set(w, p);
  }
  return p;
}

/** A font for share images: measure, check a character, draw with the baseline at y. */
export type ImgFont = {
  measureText(s: string): { width: number };
  has(ch: string): boolean;
  draw(c: SkCanvas, s: string, x: number, y: number, paint: SkPaint): void;
};

const fromSkFont = (f: SkFont): ImgFont => ({
  measureText: (s) => f.measureText(s),
  has: (ch) => f.getGlyphIDs(ch)[0] !== 0,
  draw: (c, s, x, y, paint) => c.drawText(s, x, y, paint, f),
});

const FAMILY = 'RollcamSans';
let provider: SkTypefaceFontProvider | null = null;

async function fontProvider(): Promise<SkTypefaceFontProvider> {
  if (provider) return provider;
  const p = Skia.TypefaceFontProvider.Make();
  for (const w of ['regular', 'bold'] as const) {
    const tf = await typeface(w);
    if (tf) p.registerFont(tf, FAMILY);
  }
  provider = p;
  return p;
}

// one-line paragraph: RollcamSans, then the system fonts for anything it lacks
function paragraphFont(fonts: SkTypefaceFontProvider, w: Weight, size: number): ImgFont {
  const layout = (s: string, paint?: SkPaint) => {
    const b = Skia.ParagraphBuilder.Make({ maxLines: 1 }, fonts);
    b.pushStyle({ fontFamilies: [FAMILY], fontSize: size, fontStyle: { weight: w === 'bold' ? 700 : 400 }, color: paint?.getColor() });
    b.addText(s);
    const p = b.build();
    p.layout(100000);
    return p;
  };
  return {
    measureText: (s) => ({ width: layout(s).getLongestLine() }),
    has: () => true,
    draw: (c, s, x, y, paint) => {
      const p = layout(s, paint);
      p.paint(c, x, y - (p.getLineMetrics()[0]?.baseline ?? size * 0.9));
    },
  };
}

/** A share-image font in the UI's language: Hangul-capable, and Japanese-capable in Japanese. */
export async function krFont(w: Weight, size: number): Promise<ImgFont> {
  if (isJa()) return paragraphFont(await fontProvider(), w, size);
  const tf = await typeface(w);
  if (!tf) throw new Error(tr('글꼴을 불러오지 못했어요', "Couldn't load the font", 'フォントを読み込めませんでした'));
  return fromSkFont(Skia.Font(tf, size));
}
