# 푸시 알림 활성화 가이드 (SOL-ACT)

> 결론 먼저: **현재 푸시는 "웹 푸시(VAPID)" 방식**이라 **모바일 브라우저/홈화면 PWA에서만** 동작하고, **네이티브 앱(TestFlight iOS / APK Android) 안에서는 백그라운드 푸시가 오지 않는다.** 네이티브 앱에서 진짜 푸시를 받으려면 **FCM/APNs(네이티브 푸시) 추가 작업**이 필요하다. 아래에 현재 동작 범위 + 활성화 절차 + 네이티브 푸시 추가 방법을 모두 정리한다.

---

## 1. 지금 구현된 것 (Web Push / VAPID)

| 계층 | 내용 | 위치 |
|---|---|---|
| 백엔드 | `pywebpush`로 VAPID 웹푸시 발송, VAPID 키 설정됨 | `backend/app/routers/push.py`, `backend/.env`(VAPID_*) |
| 구독 API | `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `DELETE /api/push/unsubscribe` | `services/api.ts` `pushApi` |
| 프론트 등록 | 로그인 시 무팝업 등록(`App.tsx`), 프로필에서 권한요청 등록(`ProfileSettings.tsx`) | `registerPushSubscription()` |
| 서비스워커 | `push` 수신 → `showNotification`, 클릭 시 앱 포커스 | `public/sw.js` |
| 실시간(보완) | 앱이 **열려 있을 때** 종 뱃지/토스트 | `services/useWebSocket.ts` |

### 어떤 알림이 트리거되나 (백엔드 `notify_*` 연결)
영상 업로드→교사, 영상 피드백→학생, 일지 댓글→학생, 과제 출제→학생, 과제 채점→학생, 음악 다운로드 요청→교사/원장, 음악 승인·거절→학생 등. (실시간 종 뱃지는 항상, 백그라운드 푸시는 아래 "동작 범위"를 따른다.)

---

## 2. 동작 범위 (핵심)

웹 푸시는 브라우저의 **Push API(`PushManager`)** 에 의존한다. `registerPushSubscription()`은 `'PushManager' in window`가 아니면 **조용히 종료**된다(`services/api.ts`).

| 실행 환경 | 백그라운드 푸시 | 비고 |
|---|---|---|
| **모바일 사파리(iOS 16.4+) → 홈화면에 추가한 PWA** | ✅ 동작 | iOS는 "홈 화면에 추가"한 PWA만 웹푸시 허용 |
| **안드로이드 Chrome 브라우저 / 설치형 PWA** | ✅ 동작 | |
| **iOS 네이티브 앱(TestFlight, WKWebView)** | ❌ 안 됨 | WKWebView엔 `PushManager` 없음 → 무동작 |
| **안드로이드 네이티브 앱(APK, System WebView)** | ❌ 안 됨 | WebView엔 Push API 없음. FCM 스캐폴딩만 있고 `google-services.json` 미설정 |
| 위 네이티브 앱이라도 **앱이 열려 있을 때** | ✅ 인앱 알림 | WebSocket 종 뱃지/토스트(백그라운드 아님) |

즉, 지금 상태로도 **PWA로 쓰는 사용자**는 푸시를 받는다. 하지만 **TestFlight/APK 네이티브 앱 사용자**는 백그라운드 푸시를 못 받는다.

---

## 3. 지금 바로 푸시를 켜는 법 (Web Push, 추가 코드 0)

PWA/브라우저 사용자용. 추가 개발 없이 사용자가 켜는 절차:

1. **백엔드 VAPID 키 확인**: `backend/.env`에 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`가 채워져 있어야 한다(현재 채워져 있음). 키를 새로 만들려면:
   ```bash
   cd backend && source venv/bin/activate
   python -c "from pywebpush import Vapid; v=Vapid(); v.generate_keys(); \
import base64; \
print('PUBLIC=', base64.urlsafe_b64encode(v.public_key.public_bytes_raw()).decode().rstrip('=')); \
print('PRIVATE=', base64.urlsafe_b64encode(v.private_key.private_bytes_raw()).decode().rstrip('='))"
   ```
   (키를 바꾸면 기존 구독은 무효가 되어 재구독 필요)
2. 사용자 동작: 앱(PWA)에서 **프로필 → 알림 켜기** → iOS는 사용자 제스처로 권한 팝업 → 허용.
   - iOS는 **반드시 사파리에서 "공유 → 홈 화면에 추가"** 로 설치한 PWA여야 함. 일반 사파리 탭은 불가.
3. 확인: 다른 계정으로 트리거(예: 학생이 영상 업로드 → 교사에게 알림) 후 잠금화면 알림 확인.

---

## 4. 네이티브 푸시 — **코드는 구현 완료**, 자격증명만 넣으면 켜짐

TestFlight iOS / APK Android 앱의 백그라운드 푸시 코드를 **이미 다 구현**해 뒀다. FCM/APNs **자격증명이 없으면 자동으로 무동작**(앱은 정상 구동)하고, 넣는 즉시 켜진다. 남은 건 외부 자격증명 발급 + 설정뿐이다.

### 이미 구현된 것 (코드)
- 플러그인: `@capacitor/push-notifications` 설치됨(package.json).
- 프론트: [services/nativePush.ts](../services/nativePush.ts) `registerNativePush()` — 로그인 시 [App.tsx](../App.tsx)에서 호출, 권한 요청 → 토큰을 `POST /api/push/device-token`으로 저장. 로그아웃 시 해제.
- 백엔드: `DeviceToken` 모델/테이블, `POST·DELETE /api/push/device-token`([routers/push.py](../backend/app/routers/push.py)), 발송기 [services/native_push.py](../backend/app/services/native_push.py)(Android=FCM, iOS=APNs), `notify_user`/`notify_users`에 **웹푸시와 나란히 네이티브 발송** 통합. → 1장의 모든 트리거가 네이티브에서도 발송된다.
- iOS `Info.plist`에 `remote-notification` 백그라운드 모드 추가됨.

### 활성화 절차 (자격증명 발급 + 설정)

**A. 공통 — 패키지 설치 + 동기화**
```bash
npm install                 # @capacitor/push-notifications 포함
cd backend && pip install -r requirements.txt   # firebase-admin, httpx[http2]
npx cap sync                # 네이티브 플러그인 반영
```

**B. Android (FCM)**
1. Firebase 콘솔 → 프로젝트 생성 → **Android 앱**(패키지 `com.solact.academy`) 추가 → `google-services.json` 다운로드 → `android/app/google-services.json`. (`build.gradle`이 자동 감지)
2. Firebase 콘솔 → 프로젝트 설정 → **서비스 계정 → 새 비공개 키 생성** → JSON 다운로드 → 서버에 두고 환경변수 `FCM_CREDENTIALS_FILE=/경로/serviceAccount.json`.

**C. iOS (APNs)**
1. Apple Developer → Keys → **APNs Auth Key(.p8)** 생성 → `.p8` 파일 + **Key ID** + **Team ID** 기록.
2. 서버 환경변수: `APNS_KEY_FILE=/경로/AuthKey_XXXX.p8`, `APNS_KEY_ID=...`, `APNS_TEAM_ID=...`, (개발 빌드 테스트면 `APNS_USE_SANDBOX=true`).
3. Xcode → App 타깃 → **Signing & Capabilities → ＋ Push Notifications** 추가(여기서 `aps-environment` 엔타이틀먼트가 생성됨 — 이건 Xcode에서만 가능). Background Modes의 Remote notifications는 Info.plist에 이미 반영돼 있다.
4. (선택) iOS도 Firebase로 묶고 싶으면 `GoogleService-Info.plist`를 추가하지만, 위 APNs 직접 발송 경로만으로도 동작한다.

**D. 확인**: 서버 재시작 후 로그에 `native_push_configured=True`가 되면 활성. 다른 계정으로 트리거(영상 업로드 등) → 앱 닫은 상태에서 알림 수신 확인.

> 환경변수는 `backend/.env`에 넣으면 된다(`app/config.py`의 `FCM_CREDENTIALS_FILE`, `APNS_*` 항목). 미설정이면 백엔드는 경고 없이 네이티브 발송만 건너뛴다.

---

## 5. 권장 로드맵

1. **지금**: PWA 사용자에게 "홈 화면 추가 → 알림 켜기" 안내(이미 동작). 네이티브 앱은 코드가 준비됐으니 자격증명만 넣으면 백그라운드 푸시가 켜진다.
2. **자격증명 발급 시**: 위 4장 A~C를 따라 환경변수만 설정 + Xcode에서 Push Notifications capability 추가 + 새 TestFlight/APK 빌드. 코드 추가 작업은 없다.
