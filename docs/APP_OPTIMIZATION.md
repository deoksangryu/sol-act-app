# SOL-ACT 앱 최적화 가이드 (Play "최적화 점수" 대응)

## ✅ 적용 완료 (2026-07-24, versionCode 3)
- **R8 코드·리소스 축소 적용·검증 완료**: `plugins/withR8.js`(config plugin)로 `enableMinifyInReleaseBuilds`·`enableShrinkResourcesInReleaseBuilds`=true.
  - **결과: dex 27MB → 10.4MB (−61%)**, AAB 59.4→55.2MB, mapping.txt 생성(Play 크래시 역난독화용).
  - **런타임 검증**: 유니버설 APK를 에뮬레이터에 설치·실행 → 홈·배움·AI첨삭 신규화면 정상 렌더, 크래시 0 → R8 keep 규칙 문제 없음 확인.
  - 산출물: `mobile/android/app/build/outputs/bundle/release/app-release.aab` (55.2MB, versionCode 3) / 바탕화면 `SOL-ACT-v1.0.0-build3-R8.aab`.
- **남은 최적화(프로덕션 최종에)**: x86/x86_64 ABI 제외(아래 1번). 지금 적용하면 x86 에뮬 테스트가 막혀 **최종 출시 직전에만** 적용.

---

## 결론 먼저
- Play Console의 "앱 최적화 점수 낮음"은 **정보성 권장**이며 **게시를 막지 않습니다.**
- AAB는 Play가 **기기별로 쪼개 배포**하므로 **실제 사용자 다운로드 크기는 이미 작습니다**(arm64 기기 ~25~35MB). 83MB는 "전부 합친 유니버설" 크기일 뿐.
- ⚠️ **테스트 단계(지금)에는 최적화를 적용하지 마세요.** 아래 최적화(특히 x86 ABI 제외)를 적용하면 **안드로이드 에뮬레이터(x86_64)에서 앱이 안 깔려 E2E 테스트가 막힙니다.**
- ✅ **최적화는 "실기기 테스트 완료 → 프로덕션 출시" 시점에** 적용하는 것이 안전합니다.

---

## 프로덕션 출시 때 적용할 최적화 (순서대로)

### 1. x86/x86_64 ABI 제외 (가장 큰 안전한 감소)
실제 폰은 전부 ARM(arm64-v8a). x86/x86_64는 에뮬레이터·일부 크롬북용이라 프로덕션엔 불필요 → 네이티브 라이브러리 크기 절반↓.
- **방법(config plugin 권장)**: `mobile/plugins/` 에 build.gradle의 `defaultConfig`에 아래를 주입하는 플러그인 추가(prebuild마다 재적용):
  ```groovy
  ndk { abiFilters "arm64-v8a", "armeabi-v7a" }
  ```
  (기존 `withReleaseSigning.js` 와 같은 방식으로 `withAppBuildGradle` 사용)
- 또는 임시로 프로덕션 빌드 직전 `android/app/build.gradle` 에 직접 추가 후 `bundleRelease`.
- ⚠️ 적용 후엔 **x86 에뮬레이터에서 테스트 불가** → arm 실기기 또는 arm 에뮬레이터로만 확인.

### 2. R8 코드 축소 (선택, 주의)
`minifyEnabled true` + `shrinkResources true` 로 Java/Kotlin 껍데기 축소.
- ⚠️ RN/Expo는 껍데기가 얇아 **크기 절감 효과가 작고**, proguard 규칙 누락 시 **런타임 크래시** 위험.
- 적용 시 **반드시 실기기에서 전 기능 테스트** + `mapping.txt`를 Play에 업로드(크래시 역난독화용).
- 첫 출시엔 **끄고 가는 것을 권장**(현재 상태).

### 3. 네이티브 디버그 심볼 분리 (선택)
`android.buildTypes.release`에 디버그 심볼을 AAB에 포함하지 않도록 설정하면 업로드 크기↓(크래시 분석은 별도 심볼 업로드).

---

## 재현용: 최적화 적용 후 빌드
```bash
cd mobile
# (config plugin 추가했으면) 프리빌드로 재적용
JAVA_HOME=/opt/homebrew/opt/openjdk@17 npx expo prebuild -p android
cd android && rm -rf app/build
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew bundleRelease --no-daemon
# 산출물: app/build/outputs/bundle/release/app-release.aab
```
> versionCode를 반드시 +1 (app.json android.versionCode).

## 요약
지금은 **최적화 점수를 무시하고** 테스트를 진행하세요(실제 다운로드는 이미 최적). 최적화는 **최종 프로덕션 출시 직전**에 위 1번(x86 제외)만 적용해도 충분히 효과적이고, 2번(R8)은 실기기 테스트가 가능할 때만.
