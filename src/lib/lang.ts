// Sets the UI language at startup (index.ts, so the widget's background task
// gets it too) and when Settings changes it. Kept apart from i18n.ts, which
// stays free of the store so the pure modules and their tests can use it.

import { deviceLang, pickLang, setLang, type Lang } from './i18n';
import { getSetting, setSetting } from './store';

/** '' follows the phone, 'ko' / 'en' pins one. */
export const langSetting = () => getSetting('lang', '');

export function applyLang(): Lang {
  const l = pickLang(langSetting(), deviceLang());
  setLang(l);
  return l;
}

export function saveLang(v: '' | Lang): Lang {
  setSetting('lang', v);
  return applyLang();
}
