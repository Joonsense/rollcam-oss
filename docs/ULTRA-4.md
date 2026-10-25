# feat/ultra-4 (0.4.0) 요약

main(0.3.8 vc12) 과 feat/english-ui(0.3.9) 를 이미 병합해 둔 브랜치. 영어 UI 가 main 에 들어간 뒤 이 브랜치를 main 에 넣으면 충돌 없이 이어진다. 테스트·tsc·lint 통과, 실기기 확인은 아직(체크리스트 `docs/DEVICE-TEST.md` 15~32).

## 들어간 것

| 영역 | 내용 | 주요 파일 |
|---|---|---|
| 필름 | 시즌 한정 Spring Bloom(3/28~4/12)·Autumn Maple(10/28~11/12), 남반구는 6개월 뒤, 열대는 없음. 도감 D-N, 시즌 첫날 9시 알림 | `lib/film.ts` `lib/looks.ts` `lib/remind.ts` |
| 기록 | 1년 뒤의 나에게(편지 봉인, 내년 같은 날 9시 알림, 찍으면 열림), 연속 기록 마일스톤, 놓친 날 '그날 찍었다면' 필름 | `lib/capsule.ts` `lib/streak.ts` `lib/missed.ts` |
| 보기 | 롤 재생(영사기), 필름 도감 상세 시트(필름 이야기 15종), 필름 비율 막대, 한 줄 모아 보기·검색 | `screens/RollPlayer.tsx` `screens/FilmSheet.tsx` `screens/LinesScreen.tsx` |
| 촬영 | 두 손가락 줌, 해 질 녘 빛 안내(Golden Roll 이 실제로 들어올 때만), 필름 감는 진동, 동작 줄이기 존중 | `screens/CameraScreen.tsx` `lib/light.ts` |
| 공유 | 필름 컷(35mm 한 칸, 4:5), 필름 도감 공유(9:16), 롤 GIF(직접 짠 인코더) | `lib/cut.ts` `lib/bookShare.ts` `lib/rollGif.ts` `lib/gif.ts` |
| 표지 | 사진 보기에서 '이 달 표지로', 한 해 보기·올해의 롤에 반영, 내보내기·가져오기에 포함 | `lib/covers.ts` |
| 위젯 | 작은 2x2 '이번 달 롤', 오늘의 롤에 연속 N일 | `widget/MonthRoll.tsx` `app.json` |
| 알림 | 저녁 알림 시각 자동(평소 찍는 시각 +1h, 17~21시), 연속 기록이 걸리면 문구에 표시, 같은 날 중복 알림 정리, 이미 찍은 날엔 편지·시즌 알림 안 보냄 | `lib/remind.ts` `lib/reminders.ts` |
| 성능 | 360px 썸네일 캐시(롤·한 해·도감·카드) | `lib/thumbs.ts` |
| 안전 | 설정에 '마지막 내보내기 뒤 이 기기에만 N장', expo-file-system 58 비동기 쓰기 대응, 위치를 모르면 서울 날씨 대신 시간·해로만 | `lib/backup.ts` `lib/conditions.ts` `lib/sun.ts` |
| 안내 | 업데이트 뒤 '새로 생긴 것' 카드 한 번(기존 사용자만) | `lib/whatsNew.ts` `screens/WhatsNew.tsx` |

## DB·설정 변화

- `shots.capsule` 열 추가(앱 시작 때 ALTER, 기존 행은 null). 내보내기 JSON·가져오기에 포함.
- kv: `exportedAt`, `whatsNew`, `cover:YYYY-MM`, `golden`(기존). 줌은 저장 안 함.
- app.json: 위젯 `MonthRoll` 추가 → 네이티브 빌드 필요.

## main 에 따로 보낸 수정

- `fix/fs-write-async`(a148f8e): 0.3.8 에 들어감.
- `fix/place-fallback`(59cd9f7): 0.3.9 용, feat/english-ui 위 1커밋.

## 출시 때 할 일

1. app.json 버전 0.4.0, versionCode +1, `lib/whatsNew.ts` 의 `WHATS_NEW_ID` 확인.
2. 체크리스트 15~35 기기 확인, 특히 줌 오버레이가 셔터·플래시 버튼을 막지 않는지, 필름 컷·한 줄 공유 이미지, 작은 위젯 추가.
3. 출시 노트 `store/release-notes.json` 의 0.4.0(한 258자·영 424자).
