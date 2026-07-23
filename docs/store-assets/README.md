# 스토어 등록 에셋

## screenshots-android/ (Google Play용)
에뮬레이터(1080×2400)에서 촬영한 **학생 화면** 스크린샷. 반배정된 테스트 학생 계정 로그인 상태라 실제 학생 개인정보 없음.

| 파일 | 화면 | 보여주는 것 |
|---|---|---|
| 01-home.png | 홈 | 오늘 연습 시작 유도, 학원 공지, 오늘의 루틴 |
| 02-practice.png | 연습 | 연습 타이머 링, 무용음악, 오늘의 대사 한 줄 |
| 03-learn-quiz.png | 배움 | 연기술 상식 퀴즈, 작품 읽을거리 |
| 04-badges.png | MY | 받은 갈채(뱃지) 그리드, 내 활동 |
| 05-exchange.png | 박수 교환소 | 박수로 교환하는 보상(현금성/핵심기능 유료화 없음) |
| 06-videos.png | 영상 | 연습 영상 모음·카테고리 필터 (현재 빈 상태) |

**Google Play 업로드**: 위 파일 중 2~8장을 그대로 업로드. 01~05 추천(06은 빈 상태라 선택).
Google은 320~3840px·PNG를 허용하므로 1080×2400 그대로 OK.

## ⚠️ Apple App Store는 별도 촬영 필요
Apple은 **아이폰 정확한 해상도**(예: 6.7" = 1290×2796)만 받습니다. 위 안드로이드 스크린샷(1080×2400)은
App Store Connect에서 거부됩니다. iOS 빌드(`eas build -p ios`) 후 **iOS 시뮬레이터**에서 동일 화면을
다시 촬영하세요(시뮬레이터 실행 중 `⌘S` 또는 `xcrun simctl io booted screenshot`).
→ iOS 빌드가 준비되면 도와드릴 수 있습니다.

## 촬영 재현 방법 (Android)
```bash
A=~/Library/Android/sdk/platform-tools/adb
# 반배정된 학생 계정으로 로그인된 에뮬레이터에서
$A -s emulator-5554 exec-out screencap -p > shot.png
# 하단 탭 좌표(1080×2400): 홈108·연습324·제출540·배움756·MY972, y≈2290
```
