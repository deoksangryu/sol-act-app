# SOL-ACT 네이티브 앱 재개발 플랜 (React Native / Expo)

> 작성일 2026-07-11 · 목표: **App Store / Play Store 정식 출시** + 네이티브 감성·성능
> 방식 확정: **React Native + Expo (EAS Update)** · 두 플랫폼 **동시** · 디자인 **동일 룩앤필 + 네이티브 관습** · **백엔드 무변경**

---

## 0. 배포 경로 분류 (CLAUDE.md 규칙)

- 🔴 **새 네이티브 트랙**: RN 앱 신규 프로젝트. iOS는 Xcode 아카이브→App Store, Android는 AAB→Play Console. 스토어 심사 필요.
- 🟢 **백엔드(FastAPI) 무변경**: 화면을 무엇으로 만들든 같은 REST + WebSocket API를 호출. 재작성 불필요.
- 🟡 **기존 Capacitor 앱**: RN 출시 전까지 그대로 유지(폴백). RN이 안정화되면 교체.
- ⭐ **로컬 빌드 전용 확정(2026-07-11)**: iOS=Xcode, Android=Gradle로 **로컬 Mac에서만 빌드**. 클라우드(EAS) 미사용 → Expo 계정 불필요. **OTA(즉시 배포)는 기본 미사용** — JS 수정도 로컬 재빌드로 배포(트레이드오프). 필요 시 자체 서버(로컬 PC)에 `expo-updates`를 self-host하는 OTA를 나중에 옵션으로 추가 가능(빌드 머신 ≠ 데이터 서버).

---

## 1. 왜 이 구조인가 (한 줄 요약)

현재 앱의 핵심 자산은 두 가지다: ① **~11,500줄 React/TS 로직 + 플랫한 "Toss" 디자인 시스템**, ② **이미 검증된 Swift/Java 영상 압축·청크 업로드 엔진**. RN/Expo는 ①을 스킬·로직째 재사용하고, ②는 엔진 로직을 그대로 두고 **브리지만 RN 네이티브 모듈로 다시 감싼다**. 백엔드 API 계약은 100% 그대로. → **가장 재사용률 높고, 두 플랫폼을 한 코드베이스로 동시 출시**하는 경로. (빌드는 로컬 전용, OTA는 기본 미사용 — §0 참고.)

---

## 2. 기술 스택 결정 (라이브러리 확정)

| 영역 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | **Expo (prebuild, 로컬 빌드)** | 커스텀 네이티브 업로드 모듈이 있어 Expo Go 불가 → `expo prebuild` 후 **Xcode/Gradle 로컬 빌드**. 클라우드(EAS)·Expo 계정 미사용. |
| 네비게이션 | **React Navigation** (`bottom-tabs` + 탭별 `native-stack`) | §5의 "탭마다 list→detail→form 스택" 구조와 1:1 매핑. |
| 서버 상태 | **TanStack Query (React Query)** | 현재 수동 `useDataRefresh` + 캐시를 대체. WS `data_changed` 이벤트로 `invalidateQueries`. |
| UI 상태 | **Context 유지 (+ 필요시 Zustand)** | `AppContext`/`UploadContext` 그대로 이식. |
| 네트워킹 | `fetch` 래퍼 (기존 `services/api.ts` 이식) | snake/camel 매핑·no-slash·Bearer·ngrok 헤더·401 처리 로직 그대로 포팅. |
| 실시간 | 기존 `WsClient` 로직 이식 (RN `WebSocket`) | ping/pong·백오프·토큰 쿼리파라미터 그대로. |
| 보안 저장소 | **expo-secure-store** | `localStorage` 토큰 → Keychain/Keystore. |
| 폰트 | **expo-font + Noto Sans KR** (300/400/500/700/800) | 디자인 계약의 기본 서체. |
| 아이콘 | **Tabler Icons** (RN용 `@tabler/icons-react-native` 또는 폰트 번들) | 현재 `ti ti-*` 이름 그대로 매핑. 주제 3종 SVG(Acting/Musical/Dance)는 `react-native-svg`로 path 정확히 재현. |
| 영상 재생 | **react-native-video** (또는 expo-video) | HTTP Range 스트리밍(iOS 필수), 멀티클립·타임스탬프 코멘트. |
| 오디오(음악) | **react-native-track-player** | 잠금화면 컨트롤·백그라운드 오디오. 서명 토큰(`?t=`) + Range. |
| 카메라/사진 | **expo-image-picker** | 식단·아바타 이미지 업로드. |
| 푸시 | **expo-notifications** (`getDevicePushTokenAsync`) | **원시 FCM/APNs 토큰**을 얻어 기존 백엔드(`firebase-admin`/직접 APNs)에 그대로 등록. Expo 푸시 서비스 불필요. |
| 업로드/압축 | **커스텀 로컬 Expo 네이티브 모듈** (`expo-modules-core`) | 기존 Swift `VideoCompressor/ChunkedUploader/BackgroundUploader`, Java `VideoCompressor/UploadForegroundService`를 **엔진째 재사용**, 브리지만 신규. |
| 차트 | `react-native-svg` 기반(또는 victory-native) | 성장/식단 미니 차트. chart.js 대체. |

> **Expo를 쓰되 "bare에 가까운 prebuild"** 모드: `expo prebuild`로 ios/android 네이티브 프로젝트를 생성해 커스텀 모듈·엔타이틀먼트·백그라운드 URLSession을 직접 제어. Config plugin으로 권한/entitlement 관리. **빌드는 전부 로컬(Xcode 아카이브 / Gradle AAB) — 클라우드·Expo 계정 불필요.** (Expo=프레임워크, EAS=클라우드 옵션 → 둘은 별개, 로컬만 사용.)

---

## 3. 디자인 시스템 이식 ("동일 룩앤필"의 계약)

**출처**: `services/category.tsx`(TOSS 토큰), `styles/app.css`(@theme), `components/toss/kit.tsx`, `components/toss/Calendar.tsx`. **레거시 amber/slate/shadow 레이어(`components/ui/*`)는 이식 금지** — Toss 레이어만 정본(약 95%).

### 3.1 토큰 (RN theme 객체로 1:1 이식)
- **색**: primary `#3182F6` / tint `#EAF2FF` · musical `#6D5BD0`(tint `#EEEBFA`, ink `#473A9E`) · dance `#E84F8B`(tint `#FCE7F0`) · ink `#191F28` · sub `#6B7684` · faint `#C4CCD4` · surf `#F2F4F6` · line `#EEF0F2`(0.5px) · inputLine `#E5E8EB` · success `#1B8A4B` · warn `#C2410C`(카운트 배지) · danger `#E5484D`(일요일/파괴적) · body bg `#F8FAFC` / shell `#FFFFFF`.
- **타이포**: Noto Sans KR. 기본 14/`#191F28`. 주력 굵기 500(라벨·행·칩)/600(헤더·버튼)/700(타이틀). 스케일 13·14·15·12·16·11·21·20·18·30… 타이틀 letter-spacing `-0.02em`.
- **여백**: 화면 좌우 20px, 헤더 14px. 행 세로 12px. 콘텐츠 **max-width 480 중앙정렬**.
- **라운드**: 12(입력·카드) · **13(아이콘칩=시그니처)** · 14(버튼/CTA/토스트) · 999(pill·아바타·점·배지) · 7(태그).
- **그림자: 전부 없음(플랫)**. 입체감 = 표면색 + 0.5px 헤어라인. → RN에서 `shadow*`/`elevation` **미사용**이 "동일함"의 핵심.
- **모션 시그니처**: overshoot spring `cubic-bezier(.34,1.56,.64,1)` → RN `Animated`/Reanimated spring(response≈0.35, damping≈0.6). 확인 완료 화면 scale .4→1.

### 3.2 kit 프리미티브 (RN 컴포넌트로 1:1 재현 — 최우선 산출물)
`Screen`·`Scroll`·`BigTitle/FlowTitle`·`SectionLabel`·`BackHeader`·`IconChip(44×44 r13)`·`CategoryIcon`·`Tag`·`Chevron`·`ListRow`·`DoneScreen(overshoot)`·`Cta`·`GhostButton(1.5px blue)`·`Empty/Skeleton(shimmer)`·`SearchBar`·`FilterChips(active=ink pill+white)`·`ChipSelect(active=blueBg+blue)`·`InfoBox`·`Avatar`·`MiniCalendar(7열 30×30, 선택=blue/일요일=danger)`·`TopBar(공지+bell+avatar, warn 배지)`·`MobileNav(플랫 6탭, icon22+label10)`·`Toast(다크 pill)`.

> **네이티브 관습 적용 지점**: 스크롤 바운스(iOS), 리플/시트 드래그(Android), 상태바 색(`#3182F6` 톤), safe-area 인셋(상·하) — 룩은 동일, 물성만 OS 관습.

---

## 4. 정보구조 & 네비게이션 (§ 그대로 이식)

**6탭 하단바 (전 역할 공통, 콘텐츠만 역할별 분기)**

| # | id | 라벨 | 아이콘 | 화면 |
|---|---|---|---|---|
| 1 | classes | 수업 | ti-school | Classes |
| 2 | plan | 계획 | ti-calendar-check | Plan |
| 3 | video | 영상 | ti-video | Video |
| 4 | practice | 제시대사 | ti-masks-theater | 학생=Practice / 교직원=Video(대본만) |
| 5 | diet | 식단 | ti-salad | Diet |
| 6 | music | 음악 | ti-headphones | Music |

- **숨은 경로**: `assignments`(과제, 알림 딥링크로만) · `profile`(헤더 아바타 탭, 하단바 숨김).
- **풀스크린 오버레이**: Notifications, Notices. **다이얼로그**: ModalOverlay.
- **부팅 게이트(전체 그래프 단축)**: ① 스플래시(자동로그인) → ② 인증 게이트(`!user`→Login) → ③ **반배정 게이트**(`STUDENT && enrolled_class_ids===[]` → "반배정 대기 중" 전면 차단, 새로고침/로그아웃만) → ④ 메인 셸.
- **RN 매핑**: 각 탭 = `native-stack`(list→detail→form), 오버레이 = 모달 스택, 게이트 = 루트 네비게이터 조건 분기. **하드웨어 백** = 각 스택이 자연 처리(현재 웹은 백 통합 없음 → 오히려 개선).

---

## 5. 화면 인벤토리 & 복잡도 (네이티브 재구현 기준)

| 화면 | 역할 | 핵심 | 네이티브 요소 | Cx |
|---|---|---|---|---|
| Login/Auth | all | 로그인·회원가입(학생)·계정찾기·비번재설정 | secure store | M |
| 반배정 게이트/스플래시 | student/all | 대기·자동로그인 | secure storage | S |
| 앱 셸/헤더/6탭 | all | 배지·safe-area·오프라인 배너 | 인셋·상태바 | M |
| **Classes(수업)** | all | 상태머신(출석/저널/코멘트), MiniCalendar, 무드체크 | 텍스트만 | L |
| Plan(계획) | all | 체크리스트·낙관적 토글·언두·스트릭·IME 리네임 | — | M |
| **Video(영상)** | all | 피드·플레이어·3상태 업로드 라이프사이클·레코드먼저 | **네이티브 bg업로드+압축**, 플레이어 | XL |
| Practice(제시대사) | student | 가챠 뽑기·1h 쿨다운·≤120s 업로드·추가요청 | bg업로드·길이측정 | M |
| PracticePrinciples | all | 다크 포스터(정적) | 정적 네이티브 뷰 | S |
| **Diet(식단)** | all | 식사+체중, 미니차트, 카메라 업로드, 리뷰 | **카메라/사진 업로드** | L |
| **Music(음악)** | all | 464곡 검색·인앱 스트리밍·다운로드 승인 | **오디오(잠금화면)·서명토큰·Range** | L→XL |
| Assignments(과제) | all | 제출(2단계)·채점·캘린더·페이지네이션 | **네이티브 bg업로드** | L |
| **Growth(성장)**★ | all | 4탭: 평가/포트폴리오(멀티영상+타임스탬프코멘트+핀치줌)/저널/이벤트 | **동시업로드·resume·크래시복구**, 멀티플레이어 | XL |
| Dashboard | all | 역할별 통계·오늘수업·D-day·원장 KPI | — | M |
| Chat | all | 실시간 메시징·읽음/미리보기 | **WebSocket 양방향** | L |
| QnA/Notices/Notifications/Users/PraiseStickers/ProfileSettings/Community/AcademyMgmt | mixed | 게시판·공지·인박스·회원·칭찬·프로필 | 일부 WS·푸시·이미지 | S~M |
| UploadIndicator/PushNudge | all | 전역 업로드 HUD·알림 유도 | **업로드/압축 진행 바인딩·푸시 권한** | M |

★ **Growth는 레거시 Tailwind 레이어라 "포팅이 아니라 Toss 언어로 재설계"**. 멀티영상 타임스탬프 코멘트 플레이어 + 핀치줌 뷰어가 유일무이한 UX 조각 → 마지막에.

---

## 6. 네이티브 모듈: 업로드/압축 엔진 재사용 (가장 큰 슬라이스)

**원칙**: 엔진 로직 재사용, 브리지만 신규(현재 Capacitor 브리지가 버려지는 것과 동일한 스토리).

- **영상 압축** (720p H.264 ~2Mbps faststart, `maxDim≤1280 && <50MB`면 skip):
  - Android `VideoCompressor.java`(MediaCodec HW, 오디오 pass-through) → **거의 그대로 재사용**. Galaxy S25 0프레임 이슈 감지·원본폴백 로직 포함.
  - iOS `VideoCompressor.swift`(AVAssetExportSession 720p) → **그대로 재사용**.
  - FFmpeg.wasm 웹 폴백 → **폐기**.
- **청크/재개/백그라운드 업로드** (create-record-first → 서버가 URL 패치):
  - Android `UploadForegroundService`(dataSync·wakelock·진행알림·앱 닫혀도 지속) + 5MB 청크 → **그대로 재사용**.
  - iOS `ChunkedUploader` + `BackgroundUploader`(background URLSession·앱 종료 후에도 OS 완료) + `AppDelegate` 재연결 → **거의 그대로 재사용**.
  - 청크 프로토콜(`init→chunk→status(resume)→complete`)·패치 계약 → **백엔드 계약이라 무변경**.
  - 버릴 것: `nativeUpload.ts` base64 파일복사·`saveFileForNative`(WebView OOM 우회) → 네이티브에선 직접 파일 IO.
- **RN 통합**: `expo-modules-core`로 로컬 모듈 작성 → JS에 `compressAndUpload/status/progress 이벤트` 노출 → `UploadContext`/`UploadIndicator`가 구독. WS `compression_progress`/`file_ready`와 연동.

---

## 7. 백엔드 계약 (클라이언트가 지켜야 할 것 — 서버는 무변경)

- **인증**: JWT HS256 `{sub:user_id}` 60일. 헤더 `Authorization: Bearer`. **트레일링 슬래시 금지**(307이 auth 벗김) — 단 audition·praise-sticker는 의도적으로 `/` 유지.
- **필수 헤더**: `ngrok-skip-browser-warning: true`, `Content-Type: application/json`.
- **매핑**: 서버는 raw snake_case(`access_token`, `enrolled_class_ids`) → 클라가 camel 변환(현 `toCamel`/mapper 이식).
- **WebSocket**: `/ws/stream?token=<JWT>`(쿼리파라미터). C→S `chat_send`/`ping`, S→C `new_message`/`new_notification`/`data_changed`/`compression_progress`/`file_ready`/`pong`. 실패 10회 후 포기.
- **업로드**: `POST /api/upload/chunked/{init,{id},{id}/status,{id}/complete}` + 단순 `POST /api/upload`. target_type = portfolio|portfolio_video|assignment.
- **미디어**(무인증, Range/206): `/uploads/{path}`, `/music-files/{rel}`, 서명 `GET /api/music/tracks/{id}/stream?t=`(Bearer 아님, 짧은 TTL — 목록 응답마다 갱신).
- **푸시**: `POST/DELETE /api/push/device-token {token, platform}` → expo-notifications의 원시 FCM/APNs 토큰 등록.

---

## 8. 단계별 로드맵 (계약 먼저, 미디어 마지막)

> 두 플랫폼 **동시**(단일 RN 코드베이스라 자연스러움). 상대 규모(◐=작음, ●=큼).

1. **기반(Foundation)** ●● — Expo 프로젝트+dev client, 디자인 토큰+`toss/kit` 프리미티브(§3), Noto Sans KR·Tabler, safe-area 셸·6탭 네비(§4), API 클라이언트(snake/camel·no-slash·Bearer·401), expo-secure-store, WsClient 이식. *사용자에겐 안 보이지만 전부 여기 의존.*
2. **인증+게이트** ● — Login/회원가입/찾기/재설정, 스플래시 자동로그인, **반배정 게이트**, ProfileSettings. 네트워킹+역할 E2E 검증.
3. **텍스트 CRUD 화면(빠른 성과·미디어 없음)** ●● — **Plan·Classes·Dashboard**·QnA/Notices/Notifications/PraiseStickers/Users. 상태머신 네비 + `useDataRefresh`(→React Query invalidate) 라이브 갱신을 저렴하게 검증.
4. **네이티브 업로드 모듈** ●● — §6 엔진을 RN 모듈로 래핑, UploadContext/Indicator 배선, create-record-then-patch·진행 이벤트.
5. **미디어 화면(가장 어려움·4단계 의존)** ●●● — **Video(XL)**·Practice·Assignments·**Diet(카메라)**·**Music(서명토큰 오디오+Range, react-native-track-player)**.
6. **Chat(실시간)** ● — WS 양방향(`chat_send`/`new_message`, 미읽음/미리보기 재조정). 3단계에서 WS 수동 갱신으로 검증된 뒤.
7. **Growth(XL) — 재설계로 취급** ●●● — 4영역을 Toss 어휘로 재구축, 멀티영상 타임스탬프 코멘트 플레이어 + 핀치줌 뷰어. 마지막.
8. **푸시 마무리 + 스토어** ● — device-token 등록/권한(백엔드 자격증명 이미 완비), **iOS `aps-environment`를 `production`으로**, 아이콘/스플래시/번들ID(`com.solact.academy`)/개인정보 라벨, **로컬 빌드(Xcode 아카이브 / Gradle AAB)** → TestFlight/내부테스트 → 심사.

---

## 9. 리스크 & 대응 (예산에 반영)

| 리스크 | 대응 |
|---|---|
| iOS 네이티브 `<video>/<audio>` **Range 재생** | 서버 Range/206 유지 확인, react-native-video/track-player Range 검증. |
| **음악 서명토큰**(짧은 TTL, 목록마다 회전) | 목록 응답에서 토큰 저장·재생 직전 갱신 로직 이식. |
| **레코드먼저 업로드**가 앱 종료 후에도 성립 | iOS background URLSession + Android foreground service 엔진 재사용으로 이미 해결됨 — 통합 테스트 집중. |
| **플랫(무그림자) Toss 룩** 정확 재현 | "그림자 없음 = 동일함". 리뷰 시 가장 흔한 "뭔가 어색" 실패모드 → kit 프리미티브 픽셀 대조. |
| 반배정 게이트/역할 분기 누락 | 3단계에서 학생/교사/원장 3계정 E2E. |
| 스토어 심사 | 원격 URL 로드 제거(=진짜 네이티브라 4.2 위험 해소), 권한 사용목적 문구, 개인정보 처리방침 URL. |
| **낮은 리스크(이미 존재)** | 압축·업로드 엔진, 푸시 백엔드(자격증명 완비) — 재사용이라 리스크 최저. |

---

## 10. 출시 체크리스트 (8단계 시)

### 10.0 개발자 계정 — **사업자(조직) 명의 확정** (2026-07-11 결정) · 지금 병렬 착수
> 명의는 출시 가능 여부와 무관하나, **조직 계정이 Google의 20명·14일 비공개 테스트 규칙을 면제**받고 학원명으로 노출되므로 사업자 명의로 확정. 발급 리드타임이 있어 개발과 병렬로 먼저 진행.
- [ ] **D-U-N-S 번호 신청** — Apple·Google 조직 계정 **양쪽 필수, 하나로 공용**. 무료지만 며칠~2주 소요 = **가장 긴 대기 항목, 최우선**.
- [ ] 사업자등록증 준비.
- [ ] **Apple**: Organization 등록($99/년). 개인→조직 자동전환 불가 → 조직 신규 등록(필요 시 Apple 지원).
- [ ] **Google**: Organization 개발자 계정 생성($25, 1회). 개인→조직 전환 어려움 → 보통 신규 생성.
- [ ] 개인 명의 계정으로 사전 출시 금지(사후 이전 번거로움).

### 10.1 스토어 제출물
- [ ] iOS: `aps-environment=production` entitlement, 번들ID `com.solact.academy`, App Store Connect 앱 생성, 개인정보 라벨, 스크린샷.
- [ ] Android: `google-services.json`(project `sol-act`) 확인, AAB 서명키, Play Console 데이터 안전 섹션.
- [ ] 권한 문구: 카메라·마이크·사진·알림·백그라운드.
- [ ] 로컬 빌드: iOS=Xcode 아카이브(.ipa), Android=Gradle(.aab). (클라우드/EAS 미사용, Expo 계정 불필요)
- [ ] 개인정보 처리방침·이용약관 URL.
- [ ] TestFlight / Play 내부테스트 배포 → QA(3역할) → 심사 제출.

---

### 다음 단계 제안
1단계(Foundation) 착수 = Expo 프로젝트 스캐폴딩 + 디자인 토큰/kit 프리미티브부터 시작하는 것을 추천합니다. 원하시면 별도 RN 워크스페이스를 만들어 **디자인 시스템 + 6탭 셸 + API 클라이언트** 골격을 먼저 세워드리겠습니다.
