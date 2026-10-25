// The film book's detail sheet: what each film is modelled on and how it
// draws, plus a few facts from the photos shot on it. Pure.

import type { FilmId } from './film.ts';
import { tr } from './i18n.ts';

/** One or two sentences per film: the stock it leans on and what it does to a picture. */
export const FILM_STORY: Record<FilmId, string> = {
  'daily-negative': '평범한 날의 컬러 네거티브. 살짝 바랜 검정과 따뜻한 피부, 과하지 않은 초록으로 하루를 있는 그대로 남겨요.',
  'grey-portra': '흐린 날의 인물용 필름처럼 조용한 색. 피부는 부드럽게, 하늘은 옅은 청록으로 눌러요.',
  'golden-roll': '해 뜨고 질 무렵의 금빛을 더 진하게. 하이라이트가 붉게 번지고 한쪽 끝에 빛샘이 들어요.',
  'night-tungsten': '텅스텐 조명용 800 필름처럼 그림자는 청록, 불빛 둘레엔 붉은 번짐. 입자가 굵어요.',
  'rainy-mono': '노란 필터를 낀 흑백. 하늘은 어둡게, 피부는 밝게, 빗물 번짐이 살짝 흐려져요.',
  'summer-kodak': '한여름의 진한 색. 하늘은 깊은 파랑, 빨강은 선명하게, 가운데가 조금 밝아요.',
  'winter-fuji': '차갑고 맑은 날의 후지 색. 초록은 푸르게, 피부는 분홍빛, 그림자에 청색이 돌아요.',
  'haze-film': '안개 낀 날처럼 대비를 낮추고 검정을 들어 올려요. 빛이 공기에 퍼진 느낌.',
  'motion-lofi': '바람 센 날의 장난감 카메라. 흔들린 듯한 번짐과 진한 비네팅.',
  'snow-pastel': '눈 오는 날의 파스텔. 낮은 대비, 옅은 하늘, 분홍빛이 살짝 떠요.',
  'storm-push': '천둥 치는 날 두 스톱 증감한 필름처럼 대비가 세고 입자가 거칠어요.',
  'party-flash': '생일 밤의 똑딱이 플래시. 가운데가 환하고 색이 쨍해요.',
  'spring-bloom': '벚꽃 철에만 오는 필름. 분홍 꽃잎을 띄우고 피부는 그대로, 새잎 초록과 옅은 하늘.',
  'autumn-maple': '단풍 철에만 오는 필름. 빨강과 주황을 진하게, 초록은 노랑 쪽으로, 맑은 가을 하늘.',
  'moon-silver': '보름달 뜬 맑은 밤에만. 달빛처럼 은빛으로, 그림자는 푸르게 열어 두고 가로등의 노란빛은 조용히 눌러요.',
  'postcard': '평소 찍던 곳에서 멀리 떠난 날의 필름. 낯선 햇빛은 따뜻하게, 하늘은 엽서처럼 맑고 푸르게.',
  'blue-hour': '맑은 날 해가 지고 하늘이 짙은 파랑으로 남는 짧은 시간에만. 하늘과 그림자는 깊은 파랑, 막 켜진 불빛은 따뜻하게 남겨요.',
  'first-snow': '그 겨울 첫눈 오는 날 딱 한 번. 차가운 그림자에 가로등과 목도리의 따뜻한 빛이 남아요.',
};

const FILM_STORY_EN: Record<FilmId, string> = {
  'daily-negative': 'Colour negative for an ordinary day. Slightly faded blacks, warm skin and quiet greens keep the day as it was.',
  'grey-portra': 'Calm colour like a portrait stock on a grey day. Skin stays soft, the sky turns a pale teal.',
  'golden-roll': 'Deepens the gold of sunrise and sunset. Highlights bloom red and a light leak creeps in from one edge.',
  'night-tungsten': 'Like an 800 tungsten film: teal shadows, red glow around the lights, big grain.',
  'rainy-mono': 'Black and white through a yellow filter. Darker skies, brighter skin, a little rain blur.',
  'summer-kodak': 'Midsummer colour. Deep blue skies, bright reds, a slightly brighter centre.',
  'winter-fuji': 'Fuji colour for a cold clear day. Bluer greens, pinker skin, cyan in the shadows.',
  'haze-film': 'Lowers contrast and lifts the blacks, like light spread through fog.',
  'motion-lofi': 'A toy camera on a windy day. Shaky blur and a heavy vignette.',
  'snow-pastel': 'Pastel for snowfall. Low contrast, pale sky, a touch of pink.',
  'storm-push': 'Like film pushed two stops on a stormy day: hard contrast, rough grain.',
  'party-flash': 'A point-and-shoot flash on a birthday night. Bright centre, punchy colour.',
  'spring-bloom': 'Only in cherry blossom season. Lifts the pink petals, leaves skin alone, new-leaf greens and a pale sky.',
  'autumn-maple': 'Only when the leaves turn. Deep reds and oranges, greens pushed to yellow, a clear autumn sky.',
  'moon-silver': 'Only on a clear full-moon night. Silver like moonlight, cool open shadows, the yellow of street lamps kept quiet.',
  'postcard': 'The film for a day far from where you usually shoot. Warm unfamiliar sunlight and a clear postcard-blue sky.',
  'blue-hour': 'Only in the short clear twilight when the sky stays deep blue. Blue sky and shadows, with the lights just switched on kept warm.',
  'first-snow': "Just once, on the winter's first snowy day. Cold shadows, with the warm light of street lamps and scarves.",
};

const FILM_STORY_JA: Record<FilmId, string> = {
  'daily-negative': 'いつもの日のカラーネガ。少し褪せた黒、あたたかい肌、控えめな緑で、その日をそのまま残します。',
  'grey-portra': 'くもりの日のポートレート用フィルムのような静かな色。肌はやわらかく、空は淡い青緑に。',
  'golden-roll': '日の出と日の入りの金色をさらに濃く。ハイライトが赤くにじみ、片側から光漏れが入ります。',
  'night-tungsten': 'タングステン光用の800フィルムのように、影は青緑、灯りのまわりに赤いにじみ。粒子は粗めです。',
  'rainy-mono': '黄色フィルターをつけたモノクロ。空は暗く、肌は明るく、雨のにじみが少しぼけます。',
  'summer-kodak': '真夏の濃い色。空は深い青、赤ははっきり、中央が少し明るくなります。',
  'winter-fuji': '冷たく晴れた日のフジの色。緑は青みがかり、肌はピンクに、影にシアンが差します。',
  'haze-film': '霧の日のようにコントラストを下げ、黒を持ち上げます。光が空気に広がる感じ。',
  'motion-lofi': '風の強い日のトイカメラ。ぶれたようなにじみと濃いケラレ。',
  'snow-pastel': '雪の日のパステル。低いコントラスト、淡い空、ほんのりピンク。',
  'storm-push': '雷の日に2段増感したフィルムのように、コントラストが強く粒子が粗くなります。',
  'party-flash': '誕生日の夜のコンパクトカメラのフラッシュ。中央が明るく、色が鮮やか。',
  'spring-bloom': '桜の季節にだけ来るフィルム。ピンクの花びらを引き立て、肌はそのまま、若葉の緑と淡い空。',
  'autumn-maple': '紅葉の季節にだけ来るフィルム。赤とオレンジを濃く、緑は黄色寄りに、澄んだ秋空。',
  'moon-silver': '満月の晴れた夜だけ。月明かりのような銀色、青く開いた影、街灯の黄色は控えめに。',
  'postcard': 'いつもの場所から遠く離れた日のフィルム。見慣れない日差しはあたたかく、空は絵はがきのように青く澄んで。',
  'blue-hour': '晴れた日の、日が沈んで空が深い青に残る短い時間だけ。空と影は深い青、ともったばかりの灯りはあたたかく。',
  'first-snow': 'その冬の初雪の日に一度だけ。冷たい影に、街灯やマフラーのあたたかい光が残ります。',
};

/** A film's story in the current language. */
export const filmStory = (f: FilmId) => tr(FILM_STORY[f], FILM_STORY_EN[f], FILM_STORY_JA[f]);

type ShotLike = { day: string; takenAt: number };

const POD = ['새벽', '아침', '한낮', '오후', '저녁'] as const;
const POD_EN = ['early morning', 'morning', 'midday', 'afternoon', 'evening'] as const;
const POD_JA = ['明け方', '朝', '昼', '午後', '夕方'] as const;
const podOf = (h: number) => (h < 5 ? 0 : h < 11 ? 1 : h < 14 ? 2 : h < 18 ? 3 : 4);

export type FilmFacts = { count: number; first: string | null; last: string | null; pod: string | null };

/** Count, first and last day, and the part of the day it came most (ties: earlier part). */
export function filmFacts(shots: ShotLike[]): FilmFacts {
  if (!shots.length) return { count: 0, first: null, last: null, pod: null };
  const days = shots.map((s) => s.day).sort();
  const n = [0, 0, 0, 0, 0];
  for (const s of shots) n[podOf(new Date(s.takenAt).getHours())]++;
  const top = n.indexOf(Math.max(...n));
  return { count: shots.length, first: days[0], last: days[days.length - 1], pod: tr(POD[top], POD_EN[top], POD_JA[top]) };
}

/** Share of the whole roll, rounded: '전체의 12%'. Under 1% reads '1% 미만'. */
export function shareOfRoll(count: number, total: number): string {
  if (!total || !count) return '';
  const p = (count / total) * 100;
  return p < 1 ? tr('전체의 1% 미만', 'under 1% of the roll', '全体の1%未満') : tr(`전체의 ${Math.round(p)}%`, `${Math.round(p)}% of the roll`, `全体の${Math.round(p)}%`);
}

/** Films in a set of shots by count, most first (ties keep film book order via `order`). */
export function filmMix(shots: { film: FilmId }[], order: FilmId[]): { film: FilmId; n: number }[] {
  const n = new Map<FilmId, number>();
  for (const s of shots) n.set(s.film, (n.get(s.film) ?? 0) + 1);
  return [...n.entries()].map(([film, c]) => ({ film, n: c })).sort((a, b) => b.n - a.n || order.indexOf(a.film) - order.indexOf(b.film));
}
