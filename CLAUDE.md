# SOL-ACT 작업 지침

## ⛳ 표준 규칙: 모든 변경은 "배포 경로"를 먼저 분류하고 명시한다

이 프로젝트의 작업을 시작하거나 변경을 제안할 때는 **항상 먼저** "이 변경이 어디로 배포되는가 / 네이티브 재빌드가 필요한가"를 판단해서 사용자에게 한 줄로 알린다. 코드를 다 짜고 나서가 아니라 **착수 시점에** 분류한다.

판정 기준은 단 하나: **네이티브 바이너리에 컴파일돼 들어가는 것을 건드렸는가.**
(이 앱은 `capacitor.config.ts`의 `server.url: 'https://sol-manager.com'` 때문에 화면=JS는 원격 로드된다 → 대부분의 변경은 재빌드가 필요 없다.)

### 🔴 네이티브 재배포 필요 (Xcode 아카이브→TestFlight / 새 APK 빌드)
- **커스텀 네이티브 플러그인 코드 수정** — `NativeUpload`(Swift: VideoCompressor·ChunkedUploader·NativeUploadPlugin / Java: NativeUploadPlugin·FileUtil·VideoCompressor·UploadForegroundService). 영상 압축·청크업로드·resume 로직이 여기.
- **새 Capacitor 플러그인 추가** (현재: @capacitor/filesystem, @capacitor/push-notifications, core/ios/android). 새 npm 플러그인 설치 → 네이티브 등록 필요.
- **권한·기능 추가/변경** — iOS Info.plist(카메라·마이크·사진·UIBackgroundModes)·entitlements(aps-environment dev↔prod) / Android Manifest permission.
- **아이콘·스플래시·앱이름·번들ID·알림 아이콘**(ic_stat_notify).
- **`capacitor.config.ts` 자체 변경**(server.url, 플러그인 설정).
- **Capacitor/SDK 버전업·서명·빌드번호·최소 OS**.

### 🟢 재배포 불필요 — GitHub Actions 배포만 (앱 다음 실행 시 자동 반영)
- **모든 React/TS/CSS** — 화면·탭·페이지·라우팅·상태·UI 로직.
- **기존 네이티브 플러그인을 JS에서 호출하는 브리지 코드** — 예: `services/nativeUpload.ts`.
- **영상/이미지 보기**(HTML5 `<video>`), 데이터 조회.
- **백엔드(Python)** — 아예 별개 경로(로컬 서버+ngrok), 네이티브와 무관.

### 보고 형식(예시)
> "이 변경은 🟢 **프론트(JS)** 라 Actions 배포만으로 모든 기기에 적용됩니다(재빌드 불필요)."
> "이 변경은 🔴 **네이티브(Android Java)** 수정이라 새 APK 빌드/배포가 필요합니다."
> 한 작업에 두 갈래가 섞이면 각각 분리해 명시한다(예: resume=네이티브 재빌드 O, saveFileForNative 메모리수정=JS 재빌드 X).

---

## 배포·운영 아키텍처 (위 규칙의 근거)
- **프론트엔드**: React 19 + Vite. `git push` → GitHub Actions → **sol-manager.com** 배포. 네이티브 앱이 이 URL을 원격 로드.
- **네이티브 앱**: Capacitor 8.3.1 빈 껍데기(WebView + 플러그인 + 권한). 화면은 원격. **네이티브 코드 변경 시에만** Xcode(iOS)·Gradle(Android) 재빌드.
- **백엔드**: FastAPI + PostgreSQL 16. 사용자가 이 PC에서 `bash scripts/start.sh`로 직접 구동(uvicorn 단일 워커) + ngrok 터널(sol-act-server.ngrok.app). **백엔드는 사용자가 직접 켜고 끈다 — 임의로 start/kill 하지 말 것.**
- **미디어**: 외장 SSD(/Volumes/SAMSUNG). 영상은 청크 업로드.

## 주의
- DB/테스트 변경은 사용자 동의 후. 데이터 무손실 최우선.
- 비밀파일은 gitignore: `.env`, `*.p8`, keystore, `auto_assign_students.py`(학생 실명 포함).
- Postgres JSON 컬럼은 `.like()` 직접 사용 금지 → `cast(col, Text).like(...)`.
- AI 비용 민감: 무료(라이브러리/로컬/무료티어) 우선.
