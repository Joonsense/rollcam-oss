// The film shader source, shared by the app (develop.ts, Skia on device) and
// scripts/develop-node.ts (CanvasKit on a Mac) so both develop identically.
// Color comes from the film's LUT (lut.ts bakes looks.ts filmColor), so the
// shader only holds the optical effects and never drifts from the tested color.
export const FILM_SKSL = `
uniform shader image;
uniform shader glow;
uniform shader lut;
uniform float2 size;
uniform float lutN;
uniform float halation;
uniform float grain;
uniform float grainSize;
uniform float seed;
uniform float vignette;
uniform float flash;
uniform float leak;
uniform float2 leakDir;

// strip layout: blue picks the slice, red runs across it, green down it
float3 grade(float3 c) {
  float m = lutN - 1.0;
  c = clamp(c, 0.0, 1.0) * m;
  float b0 = floor(c.b);
  float b1 = min(b0 + 1.0, m);
  float2 q = float2(c.r + 0.5, c.g + 0.5);
  float3 lo = float3(lut.eval(q + float2(b0 * lutN, 0.0)).rgb);
  float3 hi = float3(lut.eval(q + float2(b1 * lutN, 0.0)).rgb);
  return mix(lo, hi, c.b - b0);
}

float hash(float2 q) {
  return fract(sin(dot(q, float2(12.9898, 78.233))) * 43758.5453);
}

half4 main(float2 p) {
  float3 L = float3(0.2126, 0.7152, 0.0722);
  float3 c = float3(image.eval(p).rgb);

  // halation: highlights bleed a red-orange glow into their surroundings
  if (halation > 0.0) {
    float b = clamp((dot(float3(glow.eval(p).rgb), L) - 0.62) / 0.38, 0.0, 1.0);
    c += halation * b * b * float3(0.55, 0.16, 0.05);
  }

  c = grade(c);

  float2 uv = p / size;
  float d = distance(p, size * 0.5) / (0.5 * length(size));

  if (flash > 0.0) {
    float f = flash * clamp(1.0 - d / 0.75, 0.0, 1.0);
    c = 1.0 - (1.0 - c) * (1.0 - f * float3(1.0, 0.98, 0.94));
  }

  // light leak from one edge, screen-blended; above 1 (lucky frames) the band
  // also reaches further into the frame
  if (leak > 0.0) {
    float t = dot(uv - 0.5, leakDir) + 0.5;
    float reach = 0.55 - 0.3 * max(leak - 1.0, 0.0);
    float k = min(leak, 1.0) * smoothstep(reach, 1.1, t) * (0.75 + 0.25 * sin(uv.x * 7.0 + uv.y * 5.0 + seed));
    c = 1.0 - (1.0 - c) * (1.0 - k * float3(1.0, 0.5, 0.18));
  }

  // grain lives in the midtones, a little colored
  if (grain > 0.0) {
    float2 q = floor(p / grainSize) + seed;
    float n = hash(q) - 0.5;
    float3 nc = float3(n, hash(q + 17.0) - 0.5, hash(q + 41.0) - 0.5);
    float y = dot(c, L);
    c += mix(float3(n), nc, 0.25) * grain * 0.45 * (0.3 + 2.8 * y * (1.0 - y));
  }

  c *= 1.0 - vignette * smoothstep(0.55, 1.0, d);
  return half4(half3(clamp(c, 0.0, 1.0)), 1.0);
}`;
