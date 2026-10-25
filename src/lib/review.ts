// The Play in-app review card, asked for at most a few times a year and only
// right after a month's roll comes back from the lab (RollDoneCard closing):
// the moment the app has just given something, never from a button or mid-shot.
// Play itself decides whether the card shows. Pure; the call is reviewAsk.ts.

/** Photos before the first ask: a few weeks of use, not a first impression. */
export const REVIEW_MIN_SHOTS = 20;
/** Days before asking again. */
export const REVIEW_GAP_DAYS = 120;

export const reviewDue = (shots: number, askedAt: number | null, now: number) =>
  shots >= REVIEW_MIN_SHOTS && (askedAt === null || now - askedAt >= REVIEW_GAP_DAYS * 86400000);
