# ROLLCAM 스토어 등록 정보

패키지 `com.deblockx.rollcam` · 카테고리 사진 · 콘텐츠 등급 전체이용가(설문 답 기준 예상) · 무료(인앱 상품은 필름 팩 출시 때 추가)
개인정보처리방침 URL (배포 후): https://deblockxlabs.com/apps/rollcam/privacy.html · 초안 `store/privacy.html`

## 한국어 (ko-KR, 기본)

**앱 이름 (30자)**: ROLLCAM - 하루 한 장 필름 카메라

**짧은 설명 (80자)**: 하루에 딱 한 장. 필름은 오늘의 날씨와 빛이 골라요. 한 달이면 36칸 롤 완성.

**자세한 설명**

하루에 딱 한 장만 찍는 카메라입니다.

필름은 고를 수 없어요. 지금 있는 곳의 날씨와 시간과 빛이 골라 줍니다. 비 오는 오후엔 Rainy Mono, 해 질 녘엔 Golden Roll, 눈 오는 날엔 Snow Pastel. 찍고 나면 왜 그 필름이었는지 한 줄로 알려 드려요.

한 달이 지나면 36칸짜리 "그 달의 롤"이 완성됩니다. 찍지 못한 날은 빈칸이 아니라 그날 하늘 색으로 채워져요. 빠뜨린 날도 기록입니다.

· 하루 한 장: 자정이 지나면 새 필름이 감깁니다
· 필름 15종: 골든 아워, 밤, 비, 눈, 안개, 흐림, 무더위, 한겨울, 뇌우, 강풍, 특별한 날, 그리고 시즌 한정 셋. 그 겨울 첫눈 날의 First Snow, 벚꽃 철의 Spring Bloom, 단풍 철의 Autumn Maple
· 필름 도감: 모은 필름과 아직 안 온 필름, 어떤 날 오는지까지
· 내일의 필름 예보: 내일 날씨로 어떤 필름이 들어올지 미리
· 홈 화면 위젯: 오늘 찍은 인화, 아직 안 찍은 날엔 빈 칸
· 오늘의 한 줄: 사진 옆에 그날을 한 줄로. 자정이 지나면 인화와 함께 고정
· 필름 입자, 비네팅, 날짜 도장 (도장은 끌 수 있어요)
· 공유: 사진은 인화지 한 장으로(피드·스토리), 이번 달 롤과 올해의 롤은 한 장의 이미지로
· 저녁에 한 번, 아직 안 찍은 날에만 알림 (평소 찍는 시간에 맞춰요)
· 계정 없음, 광고 없음, 구독 없음
· 사진은 이 기기에만 저장. 언제든 zip 으로 내보내고, 새 폰에서 그 zip 으로 롤 되돌리기

## English (en-US)

**Title (30)**: ROLLCAM - One Photo a Day

**Short (80)**: One frame a day. The weather and light pick the film. A 36-frame roll a month.

**Full**

A camera for exactly one photo a day.

You don't pick the film. The weather, the time and the light where you are pick it: Rainy Mono on a wet afternoon, Golden Roll at sunset, Snow Pastel when it snows. After the shot, one line tells you why.

At the end of the month you have a 36-frame roll of that month. Days you missed aren't blank, they're filled with that day's sky. A missed day is still a record.

· One shot a day, a fresh roll after midnight
· 15 films: golden hour, night, rain, snow, fog, overcast, heat, deep winter, storm, wind, special days, and three seasonal ones: First Snow on the winter's first snowy day, Spring Bloom in cherry blossom season, Autumn Maple when the leaves turn
· Film book: the films you've collected, the ones still to come, and what kind of day brings them
· Tomorrow's films: see which films tomorrow's forecast is likely to load
· Home screen widget: today's print, or an empty frame waiting for today's shot
· A line for the day: one line next to the photo, set with the print at midnight
· Film grain, vignette and a date stamp (you can turn the stamp off)
· Share a photo as a print (feed or story size), or your month or your whole year as one image
· One evening reminder, only on days without a photo, timed to when you usually shoot
· No account, no ads, no subscription
· Photos stay on your device; export everything as a zip any time and restore it on a new phone

## 데이터 보안 (Data safety) 답안

| 질문 | 답 | 근거 |
|---|---|---|
| 데이터를 수집하거나 공유하나요 | 예 (수집) | 날씨 조회 때 대략 위치가 기기 밖(Open-Meteo)으로 나감 |
| 수집 항목 | 위치 > 대략적인 위치 | 0.1° 반올림 좌표 |
| 공유 | 아니요 | Open-Meteo 는 앱 대신 처리하는 서비스 제공자로 봄 (Play 정의상 공유 아님, 추정) |
| 일시적 처리 | 예 | 앱 서버 없음, 저장하지 않음 (Open-Meteo 쪽 로그는 그쪽 약관, 추정) |
| 필수 여부 | 선택 | 위치 거부해도 전 기능 사용 가능 |
| 목적 | 앱 기능 | 필름 결정 |
| 전송 중 암호화 | 예 | https |
| 삭제 요청 방법 | 해당 없음 | 서버 저장 데이터 없음, 기기 데이터는 앱 삭제로 삭제 |
| 사진·동영상 | 수집 안 함 | 기기 밖으로 나가지 않음 (공유는 사용자가 직접 고른 앱으로) |

## 스크린샷 (store/out)

`node`/에뮬레이터 캡처 1080x2400, 순서: 카메라 → 현상 결과·이유 한 줄 → 내 롤 → 공유 이미지 → 설정
