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

## 4. 네이티브 앱에서 진짜 푸시 받기 (FCM + APNs 추가)

TestFlight iOS / APK Android 앱 사용자에게 백그라운드 푸시를 보내려면 **네이티브 푸시 채널**을 추가해야 한다. 외부 자격증명(Apple APNs 키, Firebase 프로젝트)이 필요해 **코드만으로는 끝나지 않는다.** 단계:

### 4-1. 플러그인 추가
```bash
npm i @capacitor/push-notifications
npx cap sync
```

### 4-2. Firebase 프로젝트 (FCM 허브 — iOS·Android 공통)
1. Firebase 콘솔에서 프로젝트 생성.
2. **Android 앱** 추가(패키지 `com.solact.academy`) → `google-services.json` 다운로드 → `android/app/google-services.json`에 저장. (이미 `build.gradle`이 이 파일을 감지하도록 돼 있음)
3. **iOS 앱** 추가(번들 `com.solact.academy`) → `GoogleService-Info.plist` 다운로드 → Xcode의 App 타깃에 추가.

### 4-3. iOS APNs 연결
1. Apple Developer → Keys → **APNs Auth Key(.p8)** 생성 → Key ID/Team ID 기록.
2. Firebase 콘솔 → 프로젝트 설정 → Cloud Messaging → **APNs 인증 키 업로드**(.p8 + Key ID + Team ID).
3. Xcode App 타깃 → **Signing & Capabilities → ＋ Capability → Push Notifications** 추가.
4. 같은 화면에서 **Background Modes → Remote notifications** 체크 (Info.plist `UIBackgroundModes`에 `remote-notification` 추가됨).

### 4-4. 프론트 등록 코드 (네이티브 토큰 → 백엔드)
네이티브일 때는 웹푸시 대신 네이티브 토큰을 등록하도록 분기. 예:
```ts
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export async function registerNativePush() {
  if (!Capacitor.isNativePlatform()) return;            // 네이티브에서만
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;
  await PushNotifications.register();
  PushNotifications.addListener('registration', t =>
    // 백엔드에 디바이스 토큰 저장 (신규 엔드포인트 필요: POST /api/push/device-token)
    pushApi.saveDeviceToken(t.value, Capacitor.getPlatform()));
}
```
- `App.tsx`의 로그인 후 `registerPushSubscription()` 옆에서 `registerNativePush()`도 호출.

### 4-5. 백엔드: 디바이스 토큰 저장 + FCM 발송
1. 모델/테이블 `DeviceToken(user_id, token, platform)` 추가, `POST /api/push/device-token` 엔드포인트 추가.
2. 발송: `pywebpush`(웹) **와 함께** FCM HTTP v1로 네이티브 토큰에 발송.
   ```bash
   pip install firebase-admin   # backend/requirements.txt에 추가
   ```
   ```python
   # notification_service.py 내 notify_user/notify_users 확장
   import firebase_admin
   from firebase_admin import messaging, credentials
   # 앱 시작 시 1회: firebase_admin.initialize_app(credentials.Certificate("serviceAccount.json"))
   def _send_fcm(tokens, title, body):
       for t in tokens:
           messaging.send(messaging.Message(
               token=t, notification=messaging.Notification(title=title, body=body)))
   ```
3. 기존 `notify_user`/`notify_users`가 **웹푸시 구독 + 네이티브 토큰** 양쪽으로 보내도록 합치면, 위 1장의 모든 트리거가 네이티브에서도 동작한다.

> 정리: **(4-2)(4-3)는 외부 콘솔 설정**(Firebase/Apple), **(4-4)(4-5)는 코드 작업**이다. 자격증명(파일 3종: `google-services.json`, `GoogleService-Info.plist`, Firebase 서비스계정 JSON 또는 APNs .p8)을 준비해 주면 4-4·4-5 코드는 바로 붙일 수 있다.

---

## 5. 권장 로드맵

1. **지금**: 백엔드 VAPID 키 확인 + PWA 사용자에게 "홈 화면 추가 → 알림 켜기" 안내(추가 개발 0). 네이티브 앱은 **앱 열려 있을 때 실시간 알림**으로 우선 운영.
2. **다음(원장님이 자격증명 준비 시)**: 4장의 FCM/APNs를 붙여 TestFlight/APK 네이티브 앱에서도 백그라운드 푸시 활성화.

필요한 자격증명을 받으면 4-4/4-5 코드 작성 + 백엔드 발송 통합까지 이어서 진행하겠다.
