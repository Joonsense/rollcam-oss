// The undeveloped print that stands in for a photo still at the lab (lab.ts):
// dark safelight-red paper, drawn once with Skia and kept in the documents dir.

import { ImageFormat, Skia, TileMode } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

const W = 600;
const H = 800;

/** file:// uri of the paper (3:4, like a print), made on first use. */
export function labPaperUri(): string {
  const f = new File(Paths.document, 'lab-paper-1.jpg');
  if (f.exists) return f.uri;
  const surface = Skia.Surface.MakeOffscreen(W, H);
  if (!surface) return f.uri;
  const c = surface.getCanvas();
  const p = Skia.Paint();
  p.setShader(Skia.Shader.MakeRadialGradient({ x: W / 2, y: H * 0.45 }, H * 0.7, [Skia.Color('#4A1A14'), Skia.Color('#26100C'), Skia.Color('#120806')], [0, 0.55, 1], TileMode.Clamp));
  c.drawRect(Skia.XYWHRect(0, 0, W, H), p);
  surface.flush();
  f.create({ overwrite: true });
  f.writeSync(surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 88));
  return f.uri;
}
