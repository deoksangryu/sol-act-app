# SOL-ACT 스토어 출시 가이드 (App Store · Google Play)

작성일 2026-07-22. 개인(individual) 개발자 계정 기준. 이미 준비/자동화된 것과, **오직 본인만 할 수 있는 잔업**을 분리해 정리.

---

## ✅ 이미 완료된 것 (코드/빌드 측)

| 항목 | 상태 |
|---|---|
| 앱 버전 | `1.0.0`, iOS `buildNumber 1`, Android `versionCode 1` (app.json) |
| 프로덕션 API URL | `https://sol-act-server.ngrok.app` (config.ts 기본값 + mobile/.env + eas.json env) |
| iOS 암호화 신고 면제 | `ITSAppUsesNonExemptEncryption: false` (매 제출 시 질문 스킵) |
| **인앱 계정 삭제** | 구현·검증 완료 (내 정보 → 계정 삭제). **양 스토어 필수 요건 충족** |
| Android **AAB(서명)** | `mobile/android/app/build/outputs/bundle/release/app-release.aab` (59.6MB, 릴리스 키 서명 확인, 2053까지 유효) |
| EAS 빌드 설정 | `mobile/eas.json` (development/preview/production 프로파일) |
| **개인정보처리방침 게시** | ✅ **https://sol-manager.com/privacy 라이브** (실제 데이터수집 감사 반영). 스토어에 이 URL 등록 |
| 아이콘/스플래시 | `mobile/assets/` 준비됨 (icon.png, adaptive-icon 세트) |
| 백엔드 업로드 경로 하드닝 | 경로우회·이벤트루프 블로킹·동시성·실패정리 개선 완료 |

> AAB는 **업로드 키**(CN=SOL-ACT)로 서명됨. Google Play App Signing(권장)에 그대로 업로드하면 됩니다.
> **⚠️ 키스토어 백업 필수**: `mobile/credentials/solact-release.keystore` + 비밀번호를 잃으면 앱 업데이트 불가.

---

## 🔴 본인만 할 수 있는 잔업 (계정 로그인·심사 제출)

### A. 사전 준비 (공통)
1. ✅ **개인정보처리방침 게시 완료**: **https://sol-manager.com/privacy** 로 라이브. 두 스토어(App Store Connect·Play Console)의 "개인정보처리방침 URL"에 이 주소를 입력하면 됩니다.
   - (참고) AI 분석(Gemini) 기능을 나중에 켜면 방침의 제3자 조항과 스토어 데이터 라벨을 함께 갱신해야 합니다.
2. **스크린샷 촬영**: 실기기/시뮬레이터에서 주요 화면 캡처.
   - iPhone 6.7" (1290×2796) 및 6.5" 최소 3~10장 / iPad(선택)
   - Android 폰 스크린샷 2~8장 (최소 320px, 16:9 또는 9:16)
   - 추천 화면: 홈(연습 링)·영상 제출·피드백·음원·대시보드
3. **앱 설명/키워드** 준비(한국어). 예시는 아래 §D.

### B. Google Play (개인 계정 특수 요건 ⚠️)
개인(personal) 계정은 **프로덕션 출시 전 "닫힌 테스트(Closed testing)"를 반드시 거쳐야** 합니다.
1. Play Console → 앱 만들기(이름 SOL-ACT, 무료).
2. **닫힌 테스트 트랙** 생성 → AAB 업로드(`app-release.aab`).
3. **테스터 20명 이상**을 이메일/구글그룹으로 초대하고 **14일 연속** 테스트 유지(구글 정책).
4. 그 동안 **앱 콘텐츠** 작성: 개인정보처리방침 URL, 데이터 안전 폼(§C), 광고 없음, 타겟 연령, 콘텐츠 등급 설문.
5. 14일 + 20테스터 충족 후 **프로덕션 출시 신청** → 심사(보통 며칠).

### C. Google Play "데이터 안전(Data safety)" 폼 답변 (그대로 입력)
- 데이터 수집: **예**
- 데이터 암호화 전송: **예(HTTPS)**
- 사용자 데이터 삭제 요청 방법 제공: **예(인앱 계정 삭제 + 문의)**
- 수집·공유 항목:
  | 유형 | 수집 | 공유 | 목적 |
  |---|---|---|---|
  | 이름 | 예 | 아니오 | 앱 기능·계정 관리 |
  | 이메일 | 예 | 아니오 | 앱 기능·계정 관리 |
  | 사진/동영상 | 예 | 아니오 | 앱 기능(과제 제출) |
  | 음성/오디오 | 예 | 아니오 | 앱 기능(녹음 제출) |
  | 건강·피트니스(키 등) | 예 | 아니오 | 앱 기능 |
  | 기기 ID/푸시토큰 | 예 | 아니오 | 알림 |
- 광고·제3자 판매: **아니오**. 위치·연락처·금융정보: **수집 안 함**.

### D. Apple App Store
1. **로그인 필요**: `eas login` (Expo) → `eas build --platform ios --profile production`
   - 최초 1회 Apple 로그인 시 EAS가 인증서·프로비저닝을 자동 생성(App Store Connect API 키 또는 Apple ID).
   - (대안) Mac에서 `cd mobile && npx expo prebuild -p ios && open ios/*.xcworkspace` 후 Xcode Archive → 업로드. 역시 Apple 로그인 필요.
2. **App Store Connect** → 새 앱: 이름 SOL-ACT, 번들ID `com.solact.academy`, SKU 임의.
3. **앱 개인정보(App Privacy)**: §C와 동일 취지로 "수집하는 데이터" 선언(이름·이메일·사진/영상·오디오·건강·식별자, 제3자 공유 없음, 추적 없음).
4. 스크린샷·설명·키워드·지원 URL·개인정보 URL 입력. 암호화: 이미 `ITSAppUsesNonExemptEncryption:false` 처리됨.
5. **TestFlight**로 내부 테스트(선택) → **심사 제출**. 개인 계정은 D-U-N-S 불필요(개인 명의 노출).

#### 앱 설명 예시(한국어)
> **SOL-ACT — 연기 배우의 성장 기록**
> 연기·뮤지컬 입시 준비생을 위한 학습 관리 앱. 연습 영상을 제출해 선생님 피드백을 받고,
> 출석·연습시간·포트폴리오·식단을 한 곳에서 관리하세요. 매일의 노력이 성장으로 쌓입니다.

---

## 📌 업데이트 배포 시 (다음 버전)
- `app.json` 의 `version` + `ios.buildNumber` + `android.versionCode` 를 올린다(예: 1.0.1 / 2 / 2).
- Android: `cd mobile/android && JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew bundleRelease` → 새 AAB 업로드.
- iOS: `eas build -p ios --profile production` → App Store Connect 제출.
- ⚠️ **같은 키스토어**로 서명해야 Play 업데이트 가능(백업 필수).

## 🔧 재현용 빌드 명령 (Android AAB)
```bash
cd mobile/android
rm -rf app/build
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk \
  ./gradlew bundleRelease --no-daemon
# 산출물: app/build/outputs/bundle/release/app-release.aab
```
