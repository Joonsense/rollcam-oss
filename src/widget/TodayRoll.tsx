// Home screen widget "오늘의 롤": today's print on paper with its film, or an
// empty frame (the day's frame number, dashed in safelight) inviting the shot.
// Tapping anywhere opens the app. Rendered by react-native-android-widget,
// so only its Flex/Text/Image primitives are used here.

import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';
import { FILM_NAMES, type FilmId } from '../lib/film';
import { isLucky } from '../lib/lucky';
import { monthShort, tr } from '../lib/i18n';
import { FILM_TINT } from '../ui/theme';
import { todayLabel, untilNext, widgetLine, type WidgetState } from './state';

const INK = '#F2ECE4';
const DIM = '#8C847A';
const AMBER = '#FF9A3C';
const KR = 'RollcamSans-Regular';
const KR_BOLD = 'RollcamSans-Bold';

type Props = { state: WidgetState; image: string | null; width: number; height: number; now: Date; run?: number; tomorrow?: string; echo?: { image: string; line: string } };

export function TodayRoll({ state, image, width, height, now, run = 0, tomorrow = '', echo }: Props) {
  const shot = state.today;
  // the print fills the widget's height; 3:4 like the photos
  const photoH = Math.max(48, height - 24 - 19);
  const photoW = Math.round(photoH * 0.75);
  const narrow = width < 200;
  // progress bar in dp: what's left of the row after padding, the print and the gap
  const barW = Math.max(40, width - 24 - (photoW + 10) - 14 - 4);
  const fillW = Math.max(4, Math.round((barW * state.shots) / state.days));

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={todayLabel(state, shot ? (FILM_NAMES[shot.film as FilmId] ?? shot.film) : null)}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#0E0D0C',
        borderRadius: 22,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        flexGap: 14,
      }}
    >
      {shot && image ? (
        <FlexWidget style={{ backgroundColor: '#F4EFE6', padding: 5, paddingBottom: 14, borderRadius: 3 }}>
          <ImageWidget image={image as `data:image${string}`} imageWidth={photoW} imageHeight={photoH} resizeMode="cover" radius={1} />
        </FlexWidget>
      ) : !shot && echo ? (
        // a past year's print on this date, on darker paper with today's dashed frame around it
        // borders draw on the background, outside layout: sized to the other frames' photoW+10 x photoH+19
        <FlexWidget style={{ backgroundColor: '#1C130C', padding: 5, borderRadius: 4, borderWidth: 1.5, borderColor: AMBER, borderStyle: 'dashed' }}>
          <FlexWidget style={{ backgroundColor: '#B9B2A6', padding: 4, paddingBottom: 13, borderRadius: 3 }}>
            <ImageWidget image={echo.image as `data:image${string}`} imageWidth={photoW - 8} imageHeight={photoH - 8} resizeMode="cover" radius={1} />
          </FlexWidget>
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            width: photoW + 10,
            height: photoH + 19,
            backgroundColor: '#1C130C',
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: shot ? '#3A2717' : AMBER,
            borderStyle: shot ? 'solid' : 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget text="№" style={{ fontSize: 11, color: AMBER, fontFamily: 'monospace' }} />
          <TextWidget text={String(state.frame).padStart(2, '0')} style={{ fontSize: 30, color: AMBER, fontFamily: 'monospace', fontWeight: 'bold' }} />
        </FlexWidget>
      )}

      {narrow ? null : (
        <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between', paddingVertical: 4 }}>
          <TextWidget text={`ROLLCAM · ${tr(`${state.month}월 롤`, `${monthShort(state.month).toUpperCase()} ROLL`, `${state.month}月のロール`)}`} style={{ fontSize: 10, color: AMBER, fontFamily: 'monospace', letterSpacing: 0.1 }} />
          <FlexWidget style={{ flexDirection: 'column', flexGap: 3 }}>
            {shot ? (
              <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
                <FlexWidget style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: (FILM_TINT[shot.film] ?? '#C9B79C') as `#${string}` }} />
                {/* RollcamSans has no ✦ (U+2726): the star gets the system face, where it exists */}
                {shot.takenAt !== undefined && isLucky(shot.takenAt) ? <TextWidget text="✦" style={{ fontSize: 15, color: '#FFC86B', fontFamily: 'sans-serif' }} /> : null}
                <TextWidget text={FILM_NAMES[shot.film as FilmId] ?? shot.film} style={{ fontSize: 17, color: INK, fontFamily: KR_BOLD }} maxLines={1} truncate="END" />
              </FlexWidget>
            ) : (
              <TextWidget text={tr('오늘 롤 비어 있음', "Today's roll is empty", '今日のロールは空')} style={{ fontSize: 17, color: INK, fontFamily: KR_BOLD }} maxLines={1} />
            )}
            <TextWidget
              text={shot ? widgetLine(shot) : echo ? echo.line : tr('눌러서 오늘의 한 장 · 필름은 날씨가 골라요', "Tap for today's photo · the weather picks the film", 'タップで今日の一枚 · フィルムは天気が選ぶ')}
              style={{ fontSize: 12, color: DIM, fontFamily: KR }}
              maxLines={2}
              truncate="END"
            />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: 'column', flexGap: 5, width: 'match_parent' }}>
            <FlexWidget style={{ width: barW, height: 4, borderRadius: 2, backgroundColor: '#2A2622' }}>
              <FlexWidget style={{ width: fillW, height: 4, borderRadius: 2, backgroundColor: AMBER }} />
            </FlexWidget>
            <TextWidget
              // a running streak takes the count's place (the bar above shows the month)
              text={`${run >= 2 ? tr(`연속 ${run}일`, `${run} days in a row`, `${run}日連続`) : `${state.shots} / ${tr(`${state.days}장`, String(state.days), `${state.days}枚`)}`}${shot ? (tomorrow ? ` · ${tomorrow}` : tr(` · 새 필름까지 ${untilNext(now)}`, ` · new film in ${untilNext(now)}`, ` · 新しいフィルムまで${untilNext(now)}`)) : ''}`}
              style={{ fontSize: 10, color: DIM, fontFamily: KR }}
              maxLines={1}
              truncate="END"
            />
          </FlexWidget>
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
