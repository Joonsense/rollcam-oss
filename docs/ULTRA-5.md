# feat/ultra-5 요약 (0.5.x 다음 묶음)

main(0.5.1 vc17) 을 병합해 둔 브랜치. 테스트·tsc·lint 통과, 실기기 확인은 아직(`docs/DEVICE-TEST.md` 36~42).

| 영역 | 내용 | 주요 파일 |
|---|---|---|
| 도감 | 필름 견본 인화: 번들한 북촌 사진(Unsplash) 1장을 그 필름으로 현상해 상세 시트에, 못 모은 칸 뒤엔 흐리게. 240x360 으로 줄여 현상, 상세 시트 요청이 먼저 | `lib/filmSample.ts` `assets/samples/film-sample.jpg` |
| 공유 | 12달 GIF(한 해 보기, 달 표지 0.7초씩), 롤 GIF 코드 일반화 | `lib/rollGif.ts` |
| 한 줄 | 한 줄 일기 텍스트 내보내기(.txt, 달 제목·필름·날씨) | `lib/diaryText.ts` `lib/exportData.ts` |
| 촬영 | 날짜 도장 색(주황·빨강·노랑), 구도 격자(3분할, 기본 끔) | `lib/stampColor.ts` `screens/Viewfinder.tsx` |
| 위젯 | 오늘 찍은 뒤 '내일 아침 Rainy Mono'(내일 예보 첫 필름) | `widget/widget.tsx` `widget/state.ts` |
| 예보 | 이번 주 필름 예보(도감 위 7일, Open-Meteo 일별, 6시간 캐시, 도감에 없는 필름 ✦) | `lib/weekOutlook.ts` `screens/WeekStrip.tsx` |
| 알림 | 저녁 알림 문구 다섯 가지 날짜별 순환 | `lib/remind.ts` |
| 카드 | 지난 달 롤 현상 카드에 '도감에 새로 들어온 필름' | `lib/filmbook.ts` `screens/RollDoneCard.tsx` |
| 보기 | 사진 보기 확대(두 번 탭·핀치·이동, 확대 중 넘김 잠금) | `screens/ZoomPhoto.tsx` `lib/zoom.ts` |
| 설정 | 시트 스크롤(작은 폰에서 아래가 잘리던 문제, main 용 `fix/settings-scroll` 따로 있음) | `screens/SettingsSheet.tsx` |

kv 추가: `stampColor`, `grid`, `week`(주간 예보 캐시). 에셋 추가 218KB.

출시 때: `lib/whatsNew.ts` 의 `WHATS_NEW_ID`·목록, 출시 노트, 스토어 설명(견본·도장 색·12달 GIF).
