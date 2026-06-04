# iOS TestFlight 배포 가이드 (SOL-ACT)

이 문서는 쏠연기뮤지컬학원 앱(`com.solact.academy`)을 **Xcode 16 + TestFlight**로 배포하는 전체 절차다.

---

## 0. 이 앱의 배포 구조 (중요)

이 앱은 **하이브리드**다. 네이티브 셸(Capacitor)이 웹앱을 **원격 URL에서 로드**한다.

- `capacitor.config.ts` → `server.url = 'https://sol-manager.com'`
- 즉 **화면(React/TS) = sol-manager.com**, **네이티브 기능(업로드/카메라/알림) = 앱 바이너리**

| 변경한 부분 | 다시 해야 할 일 |
|---|---|
| **프론트엔드(JS/TS/CSS)만** 변경 | GitHub에 push → Actions가 sol-manager.com 배포. **앱 재빌드 불필요.** 앱은 다음 실행 때 새 화면을 로드함 |
| **네이티브(Swift/Kotlin)** 변경 | **반드시 Xcode 재빌드 → TestFlight 새 빌드 필요** (예: 백그라운드 업로드 Swift) |

> 이번에 변경한 iOS 백그라운드 업로드(Swift)는 **네이티브 변경**이라 아래 절차로 새 빌드를 올려야 적용된다.

---

## 1. 사전 준비 (최초 1회)

1. **Apple Developer Program 가입** (연 $99) — 이미 팀 `UZ449Q9344`가 프로젝트에 설정돼 있으니, 이 팀 계정으로 로그인돼 있어야 한다.
2. **Xcode 16 설치** (App Store). 설치 후 최초 실행 시 약관 동의 + 추가 컴포넌트 설치.
3. Xcode → **Settings → Accounts**에서 Apple ID 로그인 → 팀 `UZ449Q9344`(쏠연기학원 개발자 계정)가 보이는지 확인.
4. **App Store Connect**(appstoreconnect.apple.com)에 앱이 등록돼 있어야 한다:
   - My Apps → (없으면) **＋ → New App**
   - Platform: iOS, Bundle ID: **`com.solact.academy`** 선택, 이름/언어/SKU 입력.

> 참고: 이 프로젝트는 **CocoaPods가 아니라 Swift Package Manager(SPM)** 를 쓴다. 따라서 `.xcworkspace`가 없고 **`ios/App/App.xcodeproj`** 를 직접 연다.

---

## 2. 빌드 직전 (터미널)

프로젝트 루트에서:

```bash
# 1) 웹 자산 빌드 (원격 로드라도 sync로 네이티브 플러그인/설정 최신화)
npm run build

# 2) 네이티브 프로젝트에 동기화 (플러그인 등록·capacitor.config 반영)
npx cap sync ios
```

> `cap sync`는 손으로 추가한 인앱 플러그인 소스(`ios/App/App/Plugins/...`)를 **자동으로 Xcode 타깃에 넣어주지 않는다.** 이 부분은 이미 `project.pbxproj`에 수동 연결해 두었다(BackgroundUploader 등 5개 파일). 새 네이티브 파일을 추가할 때만 신경 쓰면 된다.

---

## 3. Xcode에서 아카이브 & 업로드

1. **프로젝트 열기**
   ```bash
   open ios/App/App.xcodeproj
   ```
2. 상단 타깃을 **App**, 디바이스를 **Any iOS Device (arm64)** 로 설정 (시뮬레이터로는 아카이브 불가).
3. **빌드 번호 올리기** (TestFlight 업로드마다 +1 필수):
   - 타깃 **App → General → Identity → Build** 값을 현재 `2` → `3` 으로.
   - 또는 타깃 **Build Settings → `CURRENT_PROJECT_VERSION`** 을 증가.
   - 버전(`MARKETING_VERSION`, 현재 `2.0`)은 사용자에게 보이는 버전 — 기능 릴리스 단위로만 올리면 된다.
4. **서명 확인**: 타깃 → **Signing & Capabilities** → *Automatically manage signing* 체크, Team = `UZ449Q9344`. 빨간 에러가 없어야 한다.
5. 메뉴 **Product → Archive** (수 분 소요). 끝나면 **Organizer** 창이 뜬다.
6. Organizer에서 방금 아카이브 선택 → **Distribute App** → **TestFlight & App Store**(또는 App Store Connect) → **Upload** → 옵션 기본값으로 **Next** 연타 → **Upload**.
7. 업로드 후 App Store Connect에서 **처리(Processing)** 가 끝날 때까지 5~15분 대기 (이메일 알림 옴).

---

## 4. TestFlight에서 테스터에게 배포

1. App Store Connect → My Apps → (앱) → **TestFlight** 탭.
2. 업로드한 빌드가 보이면, 최초 빌드는 **수출 규정(Export Compliance)** 질문에 답해야 한다.
   - 표준 HTTPS만 쓰면 보통 *"앱이 비표준 암호화를 사용하지 않음"* → **예/면제**. (불확실하면 Apple 문서 확인)
3. **Internal Testing**(내부 테스터, 최대 100명, 심사 없이 즉시):
   - 좌측 **Internal Group** → 테스터(앱 관리자 본인 등) 추가 → 빌드 할당.
4. **External Testing**(외부 테스터, 최대 10,000명)은 **베타 앱 심사**(보통 1일 내)를 거친다. 학생/학부모 대상이면 이쪽.
5. 테스터는 아이폰에서 **TestFlight 앱**(App Store에서 설치) → 초대 수락 → SOL-ACT 설치.

---

## 5. 이번 빌드에서 반드시 확인할 것 (백그라운드 업로드 실기기 테스트)

새 빌드의 핵심은 **앱이 꺼져도 업로드가 계속되는지**다. 실기기에서:

1. 학생 계정 로그인 → **영상 올리기**에서 **큰 영상**(수백 MB) 선택 후 업로드 시작.
2. 진행 중 **앱을 완전히 종료**(앱 스위처에서 위로 밀어 닫기)하거나 **화면 잠금**.
3. 잠시 후 **"업로드 완료" 알림**이 뜨는지 확인.
4. 앱을 다시 열어 해당 **영상이 포트폴리오에 붙어 있는지** 확인.
5. **과제 첨부**도 동일하게(제출 후 앱 닫고 첨부 업로드 완료 확인) 검증.
6. **여러 영상 동시 선택** 후 앱을 닫아도 모두 완료되는지 확인.

> 알림이 뜨려면 최초 업로드 시 **알림 권한 허용**이 필요하다(앱이 자동으로 요청). 거부했다면 iOS 설정 → SOL-ACT → 알림에서 허용.

---

## 6. 자주 막히는 지점

- **"No account / signing error"** → Xcode Settings → Accounts에 Apple ID 추가, 팀 선택.
- **"Bundle identifier already in use / not registered"** → App Store Connect에 `com.solact.academy` 앱이 먼저 등록돼 있어야 함.
- **아카이브가 회색/비활성** → 디바이스를 "Any iOS Device"로 (시뮬레이터 아님).
- **"This build is already uploaded"** → 빌드 번호를 안 올림. `CURRENT_PROJECT_VERSION` +1.
- **CLI `xcodebuild`로 빌드 시도 시 SPM 에러**(`PinsStorage version 3`) → 이 맥의 커맨드라인 도구가 구버전(15.1)이라 그렇다. **Xcode 16 GUI로 빌드하면 정상.** 정 CLI가 필요하면 `xcode-select -s /Applications/Xcode.app` 후 재시도.
- **업로드가 백그라운드에서 안 이어짐** → 새 빌드(Swift 변경 포함)가 실제로 올라갔는지 TestFlight 빌드 번호로 확인. 구 빌드는 웹 포그라운드로 폴백한다.

---

## 7. 안드로이드 (참고)

안드로이드는 TestFlight가 아니라 **APK 직접 서빙**으로 배포한다.

```bash
npm run build && npx cap sync android
# Android Studio에서 ios/App 대신 android/ 열어 Build > Generate Signed Bundle/APK → APK
```
생성된 APK를 직접 배포(다운로드 링크 제공)한다. 안드로이드 백그라운드 업로드는 포그라운드 서비스로 이미 동작하며 매니페스트 권한도 설정돼 있다.
