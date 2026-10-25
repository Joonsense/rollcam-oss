// Wiring for the "오늘의 롤" home screen widget (Android only).
// The app refreshes it after a shot and on every open; the widget's own
// background task re-renders it every 30 minutes and when it is added, which
// is what turns it back to an empty frame after midnight.

import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler, requestPinWidget, requestWidgetUpdate, type WidgetInfo } from 'react-native-android-widget';
import { loadImage } from '../lib/develop';
import { dayKey, monthKey } from '../lib/day';
import { allShots, getSetting, getShot, monthShots, photoUri, setSetting, type Shot } from '../lib/store';
import { echoLine, tomorrowLine, widgetState } from './state';
import { findYearEcho } from '../lib/echo';
import { decodeOutlook, outlookSlots } from '../lib/outlook';
import { lastPlace } from '../lib/conditions';
import { FILM_NAMES, firstSnowDue, specialDay } from '../lib/film';
import { currentStreak } from '../lib/streak';
import { MonthRoll } from './MonthRoll';
import { TodayRoll } from './TodayRoll';

export const WIDGET = 'TodayRoll';
export const MONTH_WIDGET = 'MonthRoll';
const THUMB_W = 300;
const THUMB_H = 400;
const thumbFile = () => new File(Paths.document, 'widget-thumb.jpg');

// named by both days: a restore that brings a nearer year's print makes a new file, never a stale one
const echoFile = (day: string, from: string) => new File(Paths.document, `widget-echo-${day}-${from}.jpg`);

/** A print, small enough for a widget bitmap (~300x400). Done in the app, where Skia runs. */
async function writeThumb(shot: Shot, f: File): Promise<void> {
  const img = await loadImage(photoUri(shot.file));
  const surface = Skia.Surface.MakeOffscreen(THUMB_W, THUMB_H);
  if (!surface) return;
  const k = Math.max(THUMB_W / img.width(), THUMB_H / img.height());
  const sw = THUMB_W / k;
  const sh = THUMB_H / k;
  surface.getCanvas().drawImageRect(img, Skia.XYWHRect((img.width() - sw) / 2, (img.height() - sh) / 2, sw, sh), Skia.XYWHRect(0, 0, THUMB_W, THUMB_H), Skia.Paint());
  surface.flush();
  if (f.exists) f.delete();
  f.create();
  await f.write(surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 82));
}

async function makeThumb(shot: Shot): Promise<void> {
  if (getSetting('widgetThumb', '') === shot.day && thumbFile().exists) return;
  await writeThumb(shot, thumbFile());
  setSetting('widgetThumb', shot.day);
}

/**
 * The print from this date in an earlier year, for today's empty frame, and
 * tomorrow's too: after midnight the widget redraws in the background, where
 * Skia can't make one. Older ones are cleared.
 */
async function makeEchoThumbs(now: Date): Promise<void> {
  const keep = new Set<string>();
  for (const n of [0, 1]) {
    const day = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));
    const echo = findYearEcho(day, getShot);
    if (!echo) continue;
    const f = echoFile(day, echo.shot.day);
    keep.add(f.name);
    if (!f.exists) await writeThumb(echo.shot, f);
  }
  for (const f of new Directory(Paths.document).list()) {
    if (f instanceof File && f.name.startsWith('widget-echo-') && !keep.has(f.name)) f.delete();
  }
}

/** Tomorrow's first forecast film, from the outlook the camera cached; '' without one. */
function tomorrowFilm(now: Date): string {
  try {
    const o = decodeOutlook(getSetting('outlook', ''))?.outlook;
    const day = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    if (!o || o.day !== day) return '';
    const all = allShots();
    const lat = lastPlace()?.lat ?? null;
    const [y, m, d] = day.split('-').map(Number);
    const slots = outlookSlots(o, specialDay(new Date(y, m - 1, d, 12), getSetting('birthday', '') || null), firstSnowDue(day, all, lat), lat);
    const first = slots[0];
    if (!first) return '';
    return tomorrowLine(first, FILM_NAMES[first.film], all.some((s) => s.film === first.film), slots.length === 1);
  } catch {
    return '';
  }
}

function render(info: WidgetInfo) {
  const now = new Date();
  const month = monthShots(monthKey(now));
  const state = widgetState(now, month);
  if (info.widgetName === MONTH_WIDGET) return <MonthRoll state={state} shots={month} width={info.width} height={info.height} now={now} />;
  let image: string | null = null;
  if (state.today && getSetting('widgetThumb', '') === state.day) {
    const f = thumbFile();
    if (f.exists) image = `data:image/jpeg;base64,${f.base64Sync()}`;
  }
  let echo: { image: string; line: string } | undefined;
  if (!state.today) {
    const e = findYearEcho(state.day, getShot);
    const f = e ? echoFile(state.day, e.shot.day) : null;
    if (e && f?.exists) echo = { image: `data:image/jpeg;base64,${f.base64Sync()}`, line: echoLine(e.label, FILM_NAMES[e.shot.film] ?? e.shot.film) };
  }
  const run = state.today ? currentStreak(state.day, (d) => !!getShot(d)) : 0;
  return <TodayRoll state={state} image={image} width={info.width} height={info.height} now={now} run={run} tomorrow={state.today ? tomorrowFilm(now) : ''} echo={echo} />;
}

// a cold start refreshes from the first effect and from AppState at once: one
// run at a time, so two never write the same thumbnail file together
let chain: Promise<void> = Promise.resolve();

/** Redraw every placed widget. Best effort: never throws, no-op off Android. */
export function refreshWidget(): Promise<void> {
  chain = chain.then(refresh).catch(() => {});
  return chain;
}

async function refresh(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const now = new Date();
    const shot = getShot(widgetState(now, []).day);
    if (shot) await makeThumb(shot);
    await makeEchoThumbs(now).catch(() => {});
    await requestWidgetUpdate({ widgetName: WIDGET, renderWidget: render });
    await requestWidgetUpdate({ widgetName: MONTH_WIDGET, renderWidget: render });
    // Dev builds only: a pushed flag file (files/pin-widget) asks the launcher to place the widget, for testing
    const pin = __DEV__ ? new File(Paths.document, 'pin-widget') : null;
    if (pin?.exists) {
      pin.delete();
      await requestPinWidget({ widgetName: WIDGET });
    }
  } catch {
    // the widget keeps its last frame
  }
}

export function registerWidget(): void {
  if (Platform.OS !== 'android') return;
  registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, renderWidget }) => {
    if (widgetAction === 'WIDGET_DELETED' || (widgetInfo.widgetName !== WIDGET && widgetInfo.widgetName !== MONTH_WIDGET)) return;
    renderWidget(render(widgetInfo));
  });
}
