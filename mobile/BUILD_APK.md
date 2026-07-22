# 임시 APK 빌드 & 실기기 테스트 가이드 (Android)

새 RN 앱을 **로컬에서 APK로 빌드**해 휴대폰에 설치·테스트하는 절차. (EAS/클라우드 아님)

> 전제: 이 앱은 화면(JS)을 원격 로드하지 않고 **번들에 포함**합니다. 네이티브(업로드·오디오)까지 넣으려면
> `expo prebuild` 로 `android/` 를 생성한 뒤 Gradle로 빌드합니다. Expo Go로는 네이티브가 안 돕니다.

## 0. 사전 준비 (최초 1회)
- **JDK 17**, **Android Studio**(또는 Android SDK + platform-tools). `ANDROID_HOME` 환경변수 설정.
- 휴대폰: 개발자 옵션 → **USB 디버깅** 켜기, USB 연결(또는 무선 디버깅).
- 백엔드(ngrok)가 켜져 있어야 실제 데이터가 흐릅니다. **v2 신규 테이블 활성화를 위해 백엔드를 한 번 재시작**하세요:
  ```bash
  # (권장) 백업
  pg_dump sol_act > ~/sol_act_backup_$(date +%F).sql
  bash scripts/start.sh   # create_all이 없는 신규 테이블(게임화·인박스·교환소 등)만 생성. 기존 데이터 무변경.
  ```

## 1. 네이티브 프로젝트 생성 + 의존성
```bash
cd mobile
npm install
npx expo prebuild --platform android    # mobile/android 생성 + 로컬 네이티브 모듈(native-upload) 자동링크
```

## 2. APK 빌드 — **단독 설치 테스트는 반드시 release**
> ⚠️ `assembleDebug`(app-debug.apk)는 JS를 **Metro 개발서버에서 로드**하므로, 폰에 단독 설치하면
> 서버를 못 찾아 **첫 화면 직후 튕깁니다**. 컴퓨터 없이 폰에서 테스트하려면 **release**(JS 내장)를 쓰세요.

**release APK (JS 내장, 단독 실행 · debug 키로 서명 → 서명 준비 불필요):**
```bash
cd android && ./gradlew assembleRelease
# 결과: android/app/build/outputs/apk/release/app-release.apk  (JS 번들 assets/index.android.bundle 내장)
adb uninstall com.solact.academy 2>/dev/null   # 기존(튕기던) 앱 제거
adb install android/app/build/outputs/apk/release/app-release.apk
```
(개발 중 컴퓨터에 연결해 Metro와 함께 돌릴 때만 `npx expo run:android`(debug) 사용.)
배포용은 자체 keystore로 서명: `keytool -genkeypair ... && ./gradlew assembleRelease`.

## 3. 첫 실행 권한
- 카메라·마이크·사진·**알림**을 허용하세요(영상 촬영·연기 녹음·업로드 완료 알림·백그라운드 서비스).

## 4. 전체 테스트 체크리스트
**학생**
- [ ] 홈: 박수/커튼콜/이번 달 연습시간/D-day/다가오는 일정/오늘의 루틴 체크(→박수) — 실데이터
- [ ] 제출(FAB): **연기 영상** → 촬영/선택 → **앱 닫아도 백그라운드 업로드** → 목록에서 완료 전환·알림
- [ ] 제출: **연기 녹음**(마이크 녹음→제출), **연습 일지**(저장→선생님 알림), **식단 기록**(사진·메모)
- [ ] 연습: 타이머(+박수), **무용음악 보관함**(재생·배속·재생시간 연습 인정)
- [ ] 배움: 오늘의 퀴즈(정답 시 +박수), 읽을거리·시청각·질의응답
- [ ] MY: 받은 갈채, **내 영상**(날짜별·이번 달 요약), **체중·식단**(DietScreen), **박수 교환소**(교환→박수 차감)
- [ ] HEVC/세로/1080p 영상 → 압축본에 **소리 있음**(무음 아님)
**선생님/원장**
- [ ] 인박스 → **학생 영상 리뷰**(재생 + 피드백 작성) → 학생 홈 피드백 배너
- [ ] 수업일지: 수업 선택 + 저장(실제 journalApi)
- [ ] 원장 현황: 실 커튼콜·미처리·리드타임·작성률·예외; 일정 추가(전 학생 D-day); 학생 영상 리뷰

## 5. 알려진 미완/주의 (테스트 시 참고)
- 백그라운드 업로드·오디오 녹음·음악 재생은 **dev/APK 빌드에서만** 동작(Expo Go는 폴백).
- 네이티브 코드(업로드 모듈·Media3)는 로컬 빌드에서 처음 컴파일 → media3 버전/서명 등 **빌드 에러 시 함께 조정**.
- 아직 목/미완: 홈 "오늘의 미션" 일부 정적, 뱃지 획득 전체화면 모달 연출, 원장 콘텐츠 관리 UI(퀴즈 추가), 슬럼프 자동 배치 알림.
