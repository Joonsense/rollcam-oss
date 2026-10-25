import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { dayKey, monthKey } from './day';
import { FILM_NAMES, firstSnowDue, specialDay } from './film';
import { findYearEcho } from './echo';
import { decodeOutlook, outlookSlots } from './outlook';
import { dailyAlerts, outlookAlert, pickedHour, reminderHour, rollDoneDate, seasonAlerts, withoutRepeats } from './remind';
import { capsuleAlerts } from './capsule';
import { lastPlace, sunPlace } from './conditions';
import { sunTimes } from './sun';
import { count, monthLong, tr } from './i18n';
import { allShots, getSetting, getShot, isAtLab, monthShots } from './store';
import { labDay, revealAt } from './lab';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const CHANNEL = 'daily-roll';

export const remindersOn = () => getSetting('remind', '1') === '1';
/** The day's alert moves to just before sunset (Golden Roll); off by default. */
export const goldenOn = () => getSetting('golden', '0') === '1';

/** Ask once; returns whether we may post. */
export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: tr('오늘의 롤', "Today's roll", '今日のロール'), importance: AndroidImportance.DEFAULT });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// App launch fires both the first effect and an AppState "active"; two plans
// running at once each cancel-then-schedule and leave every reminder doubled.
// Runs are chained so the last one always sees a clean slate.
let chain: Promise<void> = Promise.resolve();

/** Cancel and rebuild the rolling week of 18:00 reminders. Never throws. */
export function planReminders(ask = false): Promise<void> {
  chain = chain.then(() => plan(ask));
  return chain;
}

async function plan(ask: boolean): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = new Date();
    const all = allShots();
    // a print at the lab gets its 7 am notice even with the evening reminders off
    const lab = all.filter((x) => labDay(x.day, now) && isAtLab(x.day, now));
    if (!remindersOn() && !lab.length) return;
    if (!(ask ? await ensurePermission() : (await Notifications.getPermissionsAsync()).granted)) return;
    // a print shot with "아침에 현상" comes back at 7 (lib/lab.ts)
    for (const s of lab) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'ROLLCAM', body: tr(`어제의 한 장이 현상됐어요 · ${FILM_NAMES[s.film]}`, `Yesterday's photo is back from the lab · ${FILM_NAMES[s.film]}`, `昨日の一枚が現像されました · ${FILM_NAMES[s.film]}`) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: revealAt(s.day), channelId: CHANNEL },
      });
    }
    if (!remindersOn()) return;
    const m = monthKey(now);
    const thisMonth = monthShots(m);
    // every shot day, so a running streak counts back across months
    const shot = new Set(all.map((s) => s.day));
    // sun times from the known city or a time-zone guess; seasons only from a known city
    const sun = sunPlace(now);
    const lat = lastPlace()?.lat ?? null;
    const birthday = getSetting('birthday', '') || null;
    const alerts = dailyAlerts(now, shot, {
      golden: goldenOn(),
      sunset: (d) => sunTimes(d, sun.lat, sun.lon)?.sunset ?? null,
      special: (d) => !!specialDay(d, birthday),
      hour: pickedHour(getSetting('remindHour', ''), reminderHour(all, now)),
      lastCall: getSetting('lastCall', '0') === '1',
      echo: (d) => {
        const e = findYearEcho(d, getShot);
        return e ? { label: e.label, film: FILM_NAMES[e.shot.film] ?? e.shot.film } : null;
      },
    });
    for (const a of alerts) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'ROLLCAM', body: a.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.date, channelId: CHANNEL },
      });
    }
    // the month's roll "comes back from the lab" on the 1st (the app shows its card then)
    if (thisMonth.length > 0) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'ROLLCAM', body: tr(`${now.getMonth() + 1}월 롤 현상이 끝났어요 · ${thisMonth.length}장`, `Your ${monthLong(now.getMonth() + 1)} roll is developed · ${count(thisMonth.length, '장', 'photo')}`, `${now.getMonth() + 1}月のロールの現像が終わりました · ${thisMonth.length}枚`) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: rollDoneDate(now), channelId: CHANNEL },
      });
    }
    // a sealed line written a year ago opens this week
    for (const a of capsuleAlerts(now, all, undefined, shot)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'ROLLCAM', body: a.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.date, channelId: CHANNEL },
      });
    }
    // a film the book is missing is in the forecast (cached by the locked screen)
    const o = decodeOutlook(getSetting('outlook', ''))?.outlook;
    let alert: ReturnType<typeof outlookAlert> = null;
    if (o && o.day >= dayKey(now)) {
      const [y, mo, d] = o.day.split('-').map(Number);
      const slots = outlookSlots(o, specialDay(new Date(y, mo - 1, d, 12), getSetting('birthday', '') || null), firstSnowDue(o.day, all, lat), lat);
      alert = outlookAlert(now, o.day, slots, new Set(all.map((s) => s.film)), shot);
    }
    // a seasonal film's window opens this week and the book doesn't have it
    // yet, unless the forecast alert already names that film that day
    const season = withoutRepeats(seasonAlerts(now, new Set(all.map((s) => s.film)), undefined, shot, lat), alert);
    for (const a of alert ? [...season, alert] : season) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'ROLLCAM', body: a.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.date, channelId: CHANNEL },
      });
    }
  } catch {
    // reminders are best effort
  }
}
