# feat/ultra-9 요약 (0.7.0 vc24)

main(0.6.6 vc23) 위에 다른 세션의 Blue Hour(8d3506a)·셀프 타이머(5751965)를 병합한 묶음.

| 영역 | 내용 | 주요 파일 |
|---|---|---|
| 갤러리 | 설정 '갤러리에도 저장'(기본 끔, Android 10+): 사진을 Pictures/ROLLCAM 에 MediaStore 로 복사, 권한 없음(사진 권한 정책 심사 대상 아님). 켜면 지금까지 롤을 오래된 순으로 'N/M 넣는 중', 이후 촬영·롤 가져오기도 자동. 날짜별 표시(kv `gallery:<day>`)라 복원한 옛 날짜도 들어가고 같은 날이 두 번 안 들어감. 실패한 장은 다음 실행에서 다시 | `modules/rollcam-gallery` `lib/gallery.ts` `lib/galleryCopy.ts` |
| 리뷰 | Play 인앱 리뷰: 사진 20장 이상, 1일 롤 현상 카드를 닫은 뒤 0.8초, 120일에 한 번(kv `reviewAt`) | `lib/review.ts` `lib/reviewAsk.ts` |
| 언어 | Android 13+ 시스템 설정의 앱 언어 목록(en·ko·ja, locales_config), 앱 언어 '자동'이면 돌아올 때 따라감 | `plugins/withLauncher.js` `App.tsx` |
| 내보내기 | zip 을 사진 한 장씩 파일에 바로 씀(예전엔 모든 사진 + zip 사본을 메모리에, 2년치면 약 900MB). 가져오기도 zip 끝 목차만 읽고 한 장씩 꺼냄(2GB 넘는 zip 도), 예전 fflate zip(무압축·압축) 그대로 읽음 | `lib/zipStream.ts` `lib/exportData.ts` |
| 카드 | 새로 생긴 것 0.7.0 (0.4.0 뒤 처음): Blue Hour·Moon Silver, 럭키 컷, 갤러리, 셀프 타이머, 뒷면·온도·주간 예보 | `lib/whatsNew.ts` |

개인정보처리방침(store/privacy.html, deblockx-corp public/apps/rollcam/privacy.html): 갤러리 사본 문단, 개정일 2026-10-25.
kv 추가: `gallery`, `gallery:<day>`, `reviewAt`. 네이티브 의존성 추가: expo-store-review, 로컬 모듈 rollcam-gallery.
