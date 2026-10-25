// "새로 생긴 것": after an update, people who already have a roll get one card
// listing what changed, once. New installs skip it (the first-run screen
// introduces the app). Pure; the card is screens/WhatsNew.tsx.

import { tr } from './i18n.ts';

/** Bump with each release that has something worth a card. */
export const WHATS_NEW_ID = '0.7.1';

export type NewThing = { icon: string; title: string; body: string };

export function whatsNew(): NewThing[] {
  return [
    { icon: '◎', title: tr('새 필름 Postcard', 'New film: Postcard', '新フィルム Postcard'), body: tr('평소 찍던 도시에서 150km 넘게 떠난 날 낮에만 감겨요. 도감은 이제 18칸', 'Loads only by day when you are 150 km or more from where you usually shoot. The film book now has 18', 'いつも撮る街から150km以上離れた日の昼だけに入ります。図鑑は18マスに') },
    { icon: '◒', title: tr('아침에 현상', 'Developed by morning', '朝に現像'), body: tr('설정에서 켜면 필름 이름은 바로, 사진은 다음 날 아침 7시에 받아요', 'Turn it on in Settings: the film name right away, the photo the next morning at 7', '設定でオンにすると、フィルム名はすぐ、写真は翌朝7時に届きます') },
    { icon: '▬', title: tr('수평계', 'Level', '水平器'), body: tr('격자를 켜면 가운데 수평선, 수평이 맞으면 주황으로', 'With the grid on, a line in the middle turns orange when the phone is level', 'グリッドをオンにすると中央に水平線、水平になるとオレンジに') },
    { icon: '▦', title: tr('위젯 · 몇 해 전 오늘', 'Widget · years ago today', 'ウィジェット · 何年か前の今日'), body: tr('아직 안 찍은 날, 몇 해 전 같은 날 사진이 위젯 빈 칸에. 작은 위젯은 이번 달 롤로', 'On a day not yet shot, a print from this date in an earlier year fills the widget. The small widget opens this month', 'まだ撮っていない日、何年か前の同じ日の写真がウィジェットの空のコマに。小さなウィジェットは今月のロールへ') },
    { icon: '↺', title: tr('같은 날', 'This date in', '同じ日'), body: tr('사진 보기에서 다른 해 같은 날짜 사진으로 바로, 저녁 알림에도 1년 전 오늘', 'Jump to the same date in other years from any photo; the evening reminder mentions it too', '写真から別の年の同じ日付へすぐに、夕方のお知らせにも1年前の今日') },
  ];
}

/** Show the card when this release's card hasn't been seen and there is a roll to come back to. */
export const whatsNewDue = (seen: string, shots: number) => seen !== WHATS_NEW_ID && shots > 0;
