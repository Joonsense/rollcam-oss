import * as StoreReview from 'expo-store-review';
import { reviewDue } from './review';
import { allShots, getSetting, setSetting } from './store';

/** After the roll card has faded out; kv `reviewAt` is when it was last asked. */
export async function askReviewIfDue(): Promise<void> {
  const raw = getSetting('reviewAt', '');
  if (!reviewDue(allShots().length, raw ? Number(raw) : null, Date.now())) return;
  if (!(await StoreReview.isAvailableAsync())) return;
  setSetting('reviewAt', String(Date.now()));
  await StoreReview.requestReview();
}
