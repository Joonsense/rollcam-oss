// The moon's phase, worked out on the phone (no network): days since a known
// new moon, folded by the mean synodic month. Good to a few hours, which is
// plenty for "is it a full-moon night". Pure.

const SYNODIC = 29.530588853; // days
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 18:14 UTC
const DAY = 86400000;

/** 0 = new moon, 0.5 = full moon, back to 1 = the next new moon. */
export function moonPhase(at: Date): number {
  const days = (at.getTime() - NEW_MOON) / DAY;
  const p = (days / SYNODIC) % 1;
  return p < 0 ? p + 1 : p;
}

/** Days from the nearest full moon (0 at full). */
export const daysFromFull = (at: Date) => Math.abs(moonPhase(at) - 0.5) * SYNODIC;

/** A full-moon night: within a day of full, when the moon is a full disc to the eye. */
export const isFullMoon = (at: Date) => daysFromFull(at) <= 1;
