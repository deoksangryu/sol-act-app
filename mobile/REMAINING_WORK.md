# SOL-ACT 모바일 — 남은 작업(Remaining Work)

> React Native(Expo) 앱 `/mobile` 기준. 웹(sol-manager.com)·Capacitor 앱과 별개의 병렬 트랙입니다.
> 배포 분류: 아래 대부분은 🔴 **네이티브 트랙**(Expo prebuild + 커스텀 dev/store 빌드) 또는 순수 RN JS 작업이며, 웹의 sol-manager.com JS 배포 경로와는 무관합니다.
> ※ RN 앱은 WebView가 아니라 **네이티브 화면이 백엔드 API를 호출**합니다(원격 URL 로드 아님).

---

## 1. 한눈에

**현재 완성도**

- **화면: 실구현 8 / 스텁 2 / 미구현 10** (웹 대비, legacy Lessons 포함 20개 화면 기준)
  - 실구현(8): Classes, Plan, Video, Practice(제시대사), Notices, Notifications, Profile, Login
  - 스텁(2): Diet, Music (`screens/tabs.tsx`의 `StubScreen`)
  - 미구현(10): Assignments, Growth, Dashboard, Chat, QnA, Community, Users, AcademyManagement, PraiseStickers, Lessons(Classes에 흡수됨)
  - RN 전용 추가: SplashScreen, EnrollmentGateScreen(반배정 게이트)
- **API 클라이언트: 완전 12 / 웹 23** (`mobile/src/services/api.ts` vs 웹 1589줄)
  - 완전 패리티(3): planApi, practiceApi, badgesApi
  - 부분(9): auth, users, class, lesson, attendance, journal, notice, notification, portfolio — 대부분 **읽기 위주**, 일부 write/CRUD·AI피드백·하위리소스 누락
  - 완전 누락: assignment, diet, qna, evaluation, audition, chat, privateLesson, music, praiseSticker + (네이티브 대체) upload/push
- **인프라**
  - 업로드: **포그라운드·통짜·단일 POST**만(`upload.ts`). 압축·청크·resume·백그라운드 없음(앱 종료 시 업로드 중단). 서버가 압축/썸네일 담당.
  - 푸시: **전무**. expo-notifications 미설치.
  - 폰트: Noto Sans KR 미로드(시스템 폰트). 아이콘: MaterialCommunityIcons 근사 매핑(진짜 Tabler 아님).
  - 빌드: Expo managed, Expo Go SDK 54, 로컬 빌드 전용.
  - 백엔드: 청크 업로드·device-token·FCM/APNs 팬아웃 **준비 완료 — 변경 불필요**.

---

## 2. 남은 화면 (빌드 우선순위 순)

| 화면 | 상태 | 복잡도 | 필요한 것 |
|---|---|---|---|
| **Music** 음악 | 스텁 | L | `musicApi` 전체 신규. 오디오 재생(expo-audio/track-player)·다운로드. 음원=외장SSD `/music-files/`. |
| **Diet** 식단/체중 | 스텁 | M | `dietApi` 전체 신규(+weight CRUD). 사진 업로드·AI 분석·체중 차트. |
| **Assignments** 과제 | 미구현 | L | `assignmentApi` 전체 신규. 파일 제출(업로드 연동). Notifications `과제→assignments` 라우팅 복구. |
| **QnA** | 미구현 | M | `qnaApi` 전체 신규. AI 답변. |
| **Chat** 채팅 | 미구현 | L | `chatApi` 전체 신규. 실시간/폴링, 안읽음 배지. |
| **Growth** 성장(평가·오디션) | 미구현 | XL | `evaluationApi` + `auditionApi` 둘 다 신규. 리포트·AI요약·체크리스트. |
| **PraiseStickers** 칭찬스티커 | 미구현 | S | `praiseStickerApi` 신규. Profile 섹션과 연동. |
| **Dashboard** 홈 | 미구현 | M | 홈 탭 신규(현재 없음). 요약 집계. 탭 IA 재설계 동반. |
| **Users** 사용자관리 | 미구현 | M | usersApi.delete + 초대코드 + classApi.add/removeStudent. |
| **AcademyManagement** 학원관리 | 미구현 | M | classApi CRUD + 초대코드. 원장 전용. |
| **Community** 커뮤니티 | 미구현 | M | 대응 API 확인 필요. |
| **PracticePrinciples** 6원칙 포스터 | 미구현 | S | API 불필요, 디자인 작업(§5). Plan 진입점. |

---

## 3. 기존 완성 화면의 남은 디테일

**ProfileScreen** (우선순위 높음)
- 이름/이메일/키 **편집·저장 없음**(현재 read-only) → usersApi write.
- **비밀번호 규칙 불일치**: 모바일 4자만, 웹은 8자+영문+숫자+특수+확인필드+체크리스트. **백엔드 강규칙 시 서버 에러** → 규칙 이식 필요.
- 받은 칭찬스티커 섹션 미이식 → PraiseStickers 연동.
- 푸시 알림 섹션 없음 → §4 이후.

**PracticeScreen**
- "내 연기영상" 상세에 **실제 영상 재생 없음**(썸네일 placeholder) → `expo-video VideoView` 삽입(Video 탭엔 이미 있음).
- 마이너: 빈 상태 힌트·업로드 진행률 문구.

**PlanScreen**: BigTitle 서브텍스트, StaffPlanDetail 작성일 라벨 누락(마이너).
**VideoScreen / ClassesScreen / NoticesScreen**: 사실상 완전 이식.
**NotificationsScreen**: `과제→assignments` 라우팅은 Assignments 구현 시 복구.

---

## 4. 🔴 네이티브 4b — 업로드 압축·진짜 백그라운드 + 푸시

> `expo prebuild` + 커스텀 dev/prod 빌드 필수. **Expo Go 동작 불가.** 백엔드 무변경.

### (a) 네이티브 업로드 모듈 (`mobile/modules/native-upload`, Expo Modules API)
JS 노출: `isAvailable()`, `backgroundUpload({fileUri, apiUrl, token, subfolder, targetType, targetId, displayName})`, `uploadProgress` 이벤트. `upload.ts`가 영상은 이 모듈, 이미지/소용량은 기존 포그라운드 폴백.

**거의 그대로 재사용**(엔진이 플랫폼 네이티브, Capacitor 비의존)
- iOS: `VideoCompressor.swift`·`ChunkedUploader.swift`·`BackgroundUploader.swift`(background URLSession).
- Android: `VideoCompressor.java`(MediaCodec)·`UploadForegroundService.java`·`FileUtil.java`.
- 백엔드 청크 계약 이미 일치.

**재작성(Capacitor 글루 교체)**
- 플러그인 껍데기: `CAPPlugin`/`@CapacitorPlugin` → Expo `ModuleDefinition`/`AsyncFunction`/`Events`.
- iOS AppDelegate 훅(`handleEventsForBackgroundURLSession`) → AppDelegateSubscriber / config plugin.
- Android manifest 주입(포그라운드 `<service>` + FOREGROUND_SERVICE·POST_NOTIFICATIONS·WAKE_LOCK) → config plugin.
- expo-image-picker URI(file://·ph://·content) 해석 검증.
- 알림 채널/아이콘 자산.

### (b) 푸시
- expo-notifications 설치 + app.json 등록.
- 로그인 후 `requestPermissionsAsync()` → **`getDevicePushTokenAsync()`**(raw FCM/APNs 토큰) → `POST /api/push/device-token {token, platform}`. 로그아웃 시 DELETE.
- Android: `google-services.json`(빌드). iOS: `aps-environment`(테스트 development / 스토어 **production**), APNs `.p8`는 백엔드.
- 포그라운드 표시 + 탭→네비게이션은 JS-only.

### (c) Expo Go 경계
- **Go 불가**: 커스텀 업로드 모듈, 원격 푸시, iOS aps-environment, Android 포그라운드 서비스.
- **Go 유지**: 현재 포그라운드 업로드, image-picker, expo-video, 나머지 UI.
- ⚠️ 커스텀 네이티브 모듈을 하나라도 추가하면 `/mobile`은 **Expo Go 워크플로 영구 이탈** → 이후 모든 테스트는 dev 빌드.

---

## 5. 디자인 정합

- [ ] **Noto Sans KR 번들(expo-font)** — `mobile/assets/fonts/`에 weight별 `.ttf`, `App.tsx` `useFonts`, `tokens.ts` `text` 프리셋에 fontFamily. ⚠️ **RN Android는 weight 합성 불가 → 400/500/600/700/800 각각 별도 패밀리 로드.**
- [ ] **진짜 Tabler 아이콘** — `@tabler/icons-react-native`(SVG)로 `Icon.tsx` 재작성, MCI 근사 매핑 제거. 실사용 ~40개 글리프 검증.
- [ ] **PracticePrinciples 포스터** — 풀스크린 네이티브(expo-linear-gradient, GOLD `#c9a24b`/`#e7c46a`·BONE `#f2ede0`), Plan 진입점, 열릴 때 StatusBar light.
- [ ] **미이식 kit** — ConfirmDialog + ModalOverlay(네이티브 Modal/scrim), Badge, 재사용 FormInput.
- [ ] **픽셀 QA**(폰트 적용 후) — 자간(em→px)·lineHeight 웹과 나란히 재점검.

---

## 6. 🔴 출시 준비

- [ ] **개발자 계정(사업자)** — Apple 조직 등록 → **D-U-N-S 필요**, Google Play 조직 검증. ⚠️ **D-U-N-S 발급 수일~수주 → 가장 먼저.**
- [ ] **아이콘 + 스플래시** — 플레이스홀더를 실제 SOL-ACT 브랜드로 교체, `expo-splash-screen` config.
- [ ] **권한 문자열** — `app.json ios.infoPlist`에 Camera/Microphone/PhotoLibrary(+bg업로드 시 UIBackgroundModes).
- [ ] **iOS 푸시 entitlement** — `aps-environment` 릴리스=production.
- [ ] **개인정보 처리방침 + 이용약관 URL** — Apple App Privacy 설문 + Google Data safety.
- [ ] **`expo prebuild --clean`** — 네이티브 ios/android 생성.
- [ ] **로컬 빌드** — iOS: Xcode Archive→`.ipa`. Android: `./gradlew bundleRelease`→`.aab`(키스토어 gitignore).
- [ ] **테스터 배포** — TestFlight / Play 내부테스트, **실기기에서 네이티브 앱(로그인·업로드) 동작 확인** 후 심사.
- [ ] **리스팅 + 심사** — 스크린샷·설명, ⚠️ **리뷰어용 데모 계정(로그인+반배정 우회) 필수.**

---

## 7. 추천 진행 순서

> Expo Go에서 테스트 가능한 작업을 먼저 몰아서 → dev-build 필수(네이티브/스토어)로. 커스텀 네이티브 모듈 추가 순간 Go 이탈이 영구화되므로 Go 가능 작업 최대 소진 후 전환.

**A. Expo Go 가능 — 순수 RN/JS (먼저)**
1. **API 클라이언트 백필** — 누락/부분 API 메서드 추가. *거의 모든 미구현 화면의 공통 선행조건.*
2. **완성 화면 디테일 마감**(§3) — Profile 편집·비번 강규칙(서버 에러 유발 갭), Practice 상세 영상 재생, Plan 서브텍스트.
3. **디자인 정합 — 폰트·아이콘**(§5) — Noto Sans KR + 진짜 Tabler. *전 화면 시각 품질 기반.*
4. **PracticePrinciples 포스터** — 순수 디자인.
5. **스텁→실구현: Music, Diet** — 1번 위에서.
6. **미구현 라운드1**: Assignments, PraiseStickers(S), QnA(M).
7. **미구현 라운드2**: Chat, Growth(XL), Users/AcademyManagement, Dashboard(홈 IA), Community.
8. **Notifications 라우팅 복구**(Assignments 완성 시).

**B. dev-build 전환 — Expo Go 영구 이탈**
9. **`expo prebuild` + 출시 자산 선행** + **D-U-N-S/계정 즉시 착수**(리드타임).
10. **네이티브 업로드 모듈**(§4a) — 앱 닫아도 업로드(핵심 UX, 최대 리스크).
11. **푸시**(§4b) — expo-notifications + device-token + entitlement.
12. **개인정보 처리방침/약관 + App Privacy/Data safety**(§6).
13. **로컬 빌드 → 스토어**(§6) — .ipa→TestFlight, .aab→Play 내부테스트, 실기기 동작 확인, 데모 계정 준비 후 심사.
