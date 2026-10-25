// Darkroom palette: film base, safelight orange, paper white.
export const C = {
  bg: '#0E0D0C',
  panel: '#1A1816',
  strip: '#121110',
  edge: '#2A2622',
  text: '#F2ECE4',
  dim: '#8C847A',
  faint: '#4A443E',
  safelight: '#FF9A3C',
  ember: '#C8541E',
  unexposed: '#2B2A33',
};

export const MONO = 'monospace';

// One swatch per film for the year view's day dots: the film's character, not its exact color.
export const FILM_TINT: Record<string, string> = {
  'daily-negative': '#C9B79C',
  'golden-roll': '#E7A94B',
  'night-tungsten': '#4FA3A5',
  'rainy-mono': '#9A9EA6',
  'snow-pastel': '#D8DDE8',
  'first-snow': '#A9C4E8',
  'moon-silver': '#B9C3D6',
  'blue-hour': '#4F6FB0',
  'postcard': '#E0A458',
  'spring-bloom': '#F2A7C3',
  'autumn-maple': '#D9622B',
  'haze-film': '#C2B8A3',
  'grey-portra': '#B7A99A',
  'summer-kodak': '#E9C24A',
  'winter-fuji': '#6FA8D6',
  'storm-push': '#5E6E8C',
  'motion-lofi': '#B98E6A',
  'party-flash': '#E06A8A',
};
