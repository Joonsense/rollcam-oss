// Launcher polish that has no app.json switch:
// - app icon shortcuts (long press): today's photo, my roll, film book, each a
//   rollcam:// link the app routes (App.tsx)
// - the two home screen widgets' names and descriptions in the launcher's
//   widget picker, in the phone's language (react-native-android-widget only
//   takes one fixed label)
// - the per-app language list (Android 13+ Settings > Apps > Language): the
//   phone then hands the app the picked locale, which deviceLang() reads when
//   the in-app language is on Auto
// Default resources are English; values-ko / values-ja carry the rest.
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const STRINGS = {
  values: {
    shortcut_camera: "Today's photo",
    shortcut_roll: 'My roll',
    shortcut_book: 'Film book',
    widget_todayroll_label: "Today's roll",
    widget_monthroll_label: "This month's roll",
  },
  'values-ko': {
    shortcut_camera: '오늘의 한 장',
    shortcut_roll: '내 롤',
    shortcut_book: '필름 도감',
    widget_todayroll_label: '오늘의 롤',
    widget_monthroll_label: '이번 달 롤',
    widget_todayroll_description: '오늘 한 장을 찍었는지, 어떤 필름이 감겼는지',
    widget_monthroll_description: '이번 달 찍은 날을 필름 색 점으로',
  },
  'values-ja': {
    shortcut_camera: '今日の一枚',
    shortcut_roll: 'マイロール',
    shortcut_book: 'フィルム図鑑',
    widget_todayroll_label: '今日のロール',
    widget_monthroll_label: '今月のロール',
    widget_todayroll_description: '今日の一枚を撮ったか、どのフィルムが入ったか',
    widget_monthroll_description: '今月撮った日をフィルムの色の点で',
  },
};

const SHORTCUTS = [
  ['camera', 'shortcut_camera', 'camera'],
  ['roll', 'shortcut_roll', 'roll'],
  ['book', 'shortcut_book', 'book'],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, "\\'");

function shortcutsXml(pkg) {
  const items = SHORTCUTS.map(
    ([id, label, route]) => `  <shortcut android:shortcutId="${id}" android:enabled="true" android:icon="@mipmap/ic_launcher" android:shortcutShortLabel="@string/${label}">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${pkg}" android:targetClass="${pkg}.MainActivity" android:data="rollcam://${route}" />
  </shortcut>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n${items.join('\n')}\n</shortcuts>\n`;
}

// the languages the app speaks (i18n.ts), English first as the fallback
const LOCALES = ['en', 'ko', 'ja'];
const localesXml = () => `<?xml version="1.0" encoding="utf-8"?>\n<locale-config xmlns:android="http://schemas.android.com/apk/res/android">\n${LOCALES.map((l) => `  <locale android:name="${l}" />`).join('\n')}\n</locale-config>\n`;

module.exports = function withLauncher(config) {
  const pkg = config.android.package;
  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    app.$['android:localeConfig'] = '@xml/locales_config';
    const main = app.activity.find((a) => a.$['android:name'] === '.MainActivity');
    main['meta-data'] = (main['meta-data'] ?? []).filter((m) => m.$['android:name'] !== 'android.app.shortcuts');
    main['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    for (const r of app.receiver ?? []) {
      if (r.$['android:name'] === '.widget.TodayRoll') r.$['android:label'] = '@string/widget_todayroll_label';
      if (r.$['android:name'] === '.widget.MonthRoll') r.$['android:label'] = '@string/widget_monthroll_label';
    }
    return c;
  });
  return withDangerousMod(config, [
    'android',
    (c) => {
      const res = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res');
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.writeFileSync(path.join(res, 'xml/shortcuts.xml'), shortcutsXml(pkg));
      fs.writeFileSync(path.join(res, 'xml/locales_config.xml'), localesXml());
      for (const [dir, strings] of Object.entries(STRINGS)) {
        fs.mkdirSync(path.join(res, dir), { recursive: true });
        const body = Object.entries(strings)
          .map(([k, v]) => `  <string name="${k}">${esc(v)}</string>`)
          .join('\n');
        fs.writeFileSync(path.join(res, dir, 'rollcam_launcher.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${body}\n</resources>\n`);
      }
      return c;
    },
  ]);
};
