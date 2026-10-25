// Small home screen widget "이번 달 롤" (2x2): today's frame number, how many
// frames this month holds, and the month as a calendar of dots in each day's
// film tint (today ringed in safelight, missed days faint). Tapping opens
// this month's roll. Same primitives and fonts as TodayRoll.

import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { count, monthShort } from '../lib/i18n';
import { FILM_TINT } from '../ui/theme';
import { monthDots, monthLabel, type MonthDot, type WidgetShot, type WidgetState } from './state';

const INK = '#F2ECE4';
const DIM = '#8C847A';
const AMBER = '#FF9A3C';
const KR = 'RollcamSans-Regular';

function Dot({ d, size }: { d: MonthDot | null; size: number }) {
  if (!d) return <FlexWidget style={{ width: size, height: size }} />;
  const color = d.state === 'shot' ? (d.film ? FILM_TINT[d.film] ?? INK : INK) : d.state === 'missed' ? '#2E2A26' : '#1A1816';
  return (
    <FlexWidget
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: (d.state === 'today' ? '#0E0D0C' : color) as `#${string}`,
        // a lucky frame gets a gold ring
        borderWidth: d.state === 'today' || d.lucky ? 1.5 : d.state === 'future' ? 0.5 : 0,
        borderColor: d.state === 'today' ? AMBER : d.lucky ? '#FFC86B' : '#3A3530',
      }}
    />
  );
}

type Props = { state: WidgetState; shots: WidgetShot[]; width: number; height: number; now: Date };

export function MonthRoll({ state, shots, width, height, now }: Props) {
  const rows = monthDots(now, shots);
  // dots fill what's left under the header, 7 across
  const size = Math.max(6, Math.min(Math.floor((width - 24 - 6 * 4) / 7), Math.floor((height - 24 - 34 - (rows.length - 1) * 4) / rows.length)));
  return (
    <FlexWidget
      // opens on this month's roll, not the camera (App.tsx follows rollcam://roll)
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'rollcam://roll' }}
      accessibilityLabel={monthLabel(state)}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: '#0E0D0C', borderRadius: 22, padding: 12, flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'match_parent' }}>
        <TextWidget text={`№ ${String(state.frame).padStart(2, '0')}`} style={{ fontSize: 15, color: AMBER, fontFamily: 'monospace', fontWeight: 'bold' }} />
        <TextWidget text={`${monthShort(state.month)} · ${count(state.shots, '장', 'photo')}`} style={{ fontSize: 11, color: state.today ? INK : DIM, fontFamily: KR }} maxLines={1} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', flexGap: 4 }}>
        {rows.map((r, i) => (
          <FlexWidget key={i} style={{ flexDirection: 'row', flexGap: 4 }}>
            {r.map((d, j) => (
              <Dot key={j} d={d} size={size} />
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}
