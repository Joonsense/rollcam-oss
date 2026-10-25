// The date stamp's LED colour, picked in Settings: the classic orange, a red
// or a yellow, like the different data backs film cameras shipped with. Pure.

export type StampColor = 'orange' | 'red' | 'yellow';

export const STAMP_COLORS: Record<StampColor, { ink: string; halo: string }> = {
  orange: { ink: '#FF9A3C', halo: 'rgba(255,120,30,0.55)' },
  red: { ink: '#FF5A3C', halo: 'rgba(255,50,30,0.5)' },
  yellow: { ink: '#FFD452', halo: 'rgba(255,196,40,0.5)' },
};

export const STAMP_ORDER: StampColor[] = ['orange', 'red', 'yellow'];

export const readStamp = (v: string): StampColor => (v === 'red' || v === 'yellow' ? v : 'orange');
