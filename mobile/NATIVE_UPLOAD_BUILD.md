# 진짜 백그라운드 영상 업로드 — 빌드 & 테스트 가이드

새 RN 앱에 **네이티브 백그라운드 업로더**를 Expo 로컬 모듈(`modules/native-upload/`)로 추가했습니다.
앱이 백그라운드/종료돼도 업로드가 끝까지 진행되고, **압축은 오디오 보존을 검증**(실패 시 원본 업로드)합니다.

> ⚠️ 이 모듈은 🔴 **네이티브**입니다. Expo Go로는 동작하지 않고(자동으로 기존 포그라운드 업로드로 폴백),
> **`expo prebuild` + 로컬 빌드(개발 빌드)** 가 필요합니다. 아래 네이티브 코드는 검증된 Capacitor 판을
> 이식했지만 이 환경에서 컴파일 검증은 못 했으므로, **첫 빌드에서 사소한 빌드 에러는 함께 다듬어야 합니다.**

## 구조
```
modules/native-upload/
  expo-module.config.json        # 모듈 등록(iOS/Android + AppDelegate 서브스크라이버)
  index.ts                       # JS API (isAvailable/enqueueUpload/이벤트)
  ios/
    NativeUpload.podspec
    NativeUploadModule.swift      # Expo 모듈 래퍼
    BackgroundUploader.swift      # URLSession 백그라운드 세션(메타 디스크 영속화)
    VideoCompressor.swift         # AVAssetExportSession + 오디오 보존 검증→실패 시 원본
    NativeUploadAppDelegate.swift # 백그라운드 완료 이벤트 훅
  android/
    build.gradle                 # media3(Transformer) + okhttp 의존성
    src/main/AndroidManifest.xml # FOREGROUND_SERVICE(dataSync) + 권한 + 서비스 선언
    src/main/java/expo/modules/nativeupload/
      NativeUploadModule.kt      # Expo 모듈 래퍼
      UploadForegroundService.kt # dataSync 포그라운드 서비스(앱 닫혀도 진행)
      VideoCompressor.kt         # Media3 Transformer(오디오 passthrough·720p)
      ChunkedUploader.kt         # 청크+이어받기(백엔드 /api/upload/chunked/*)
```
JS 배선: `src/services/nativeUpload.ts`(브리지·폴백) → `UploadContext.tsx`(영상만 백그라운드 라우팅).
`VideoScreen`은 이미 **레코드-먼저-생성 후 업로드**라 자동으로 백그라운드가 됩니다.

## 빌드 순서 (로컬 전용, EAS 아님)
```bash
cd mobile
npm install                     # (media3/okhttp는 gradle이, iOS는 pod이 받음)

# 1) 네이티브 프로젝트 생성 + 자동 링크(로컬 모듈 포함)
npx expo prebuild               # mobile/ios, mobile/android 생성

# 2) iOS — 실기기 권장(백그라운드 URLSession/알림은 시뮬레이터 제약)
npx expo run:ios --device       # 또는 ios/*.xcworkspace 를 Xcode로 열어 기기에 빌드

# 3) Android — 실기기 권장
npx expo run:android            # 기기 연결 상태에서
```
- iOS 최소 배포 타깃 15.1, Android minSdk 24.
- 첫 실행 시 **알림 권한**을 허용해야 완료 알림이 뜹니다(`requestPermissions()` 호출 or 시스템 프롬프트).
- 백엔드(ngrok)가 켜져 있어야 실제 업로드가 됩니다.

## 동작 원리 (요약)
1. 영상 선택 → `portfolioApi.create(videoUrl:'')`로 **레코드 먼저 생성**.
2. `UploadContext.upload` → 영상+네이티브 있으면 `enqueueUpload({..., targetType:'portfolio'|'portfolio_video', targetId})`.
3. 네이티브가 **압축(오디오 검증)** → **업로드**(iOS=백그라운드 세션 단발 / Android=포그라운드 서비스 청크+resume).
4. 백엔드가 도착 시 `target_type/target_id`로 레코드의 `video_url`을 **패치**(앱이 닫혀도 반영) + WS로 라이브 갱신 + 로컬 알림.

## 테스트 체크리스트
- [ ] 큰 영상(수백 MB) 업로드 후 **앱 완전 종료** → 잠시 뒤 서버에 파일 도착 + 목록에서 "업로드 중"→완료로 전환.
- [ ] **세로/HEVC/1080p** 영상 → 압축본에 **오디오 있음**(무음 아님). 없으면 원본이 올라가야 함.
- [ ] 업로드 도중 네트워크 끊김 → (Android) `/status`로 이어받기, (iOS) OS가 네트워크 복귀 시 재개.
- [ ] 알림: 완료/실패 표시. 실패 시 앱에서 재시도 가능.
- [ ] Expo Go(개발 빌드 아님)에서는 기존 포그라운드 업로드로 폴백되는지(앱 열려 있는 동안 업로드).

## 알려진 튜닝 포인트(첫 빌드 시)
- **media3 버전**: `build.gradle`의 `1.4.1` 이 Gradle/AGP와 안 맞으면 최신 안정판으로 정렬(transformer/effect/common 동일 버전).
- **Expo Modules API**: `Promise`/`sendEvent`/`Events` 시그니처가 SDK 54와 다르면 소폭 조정.
- iOS **AVAssetExportSession**는 `.tracks(...)` 동기 API를 씀(16+에서 deprecation 경고, 동작엔 무방).
- 서버 청크 세션은 RAM(2h TTL) → 백엔드 재시작 시 진행 중 청크 세션은 만료되어 처음부터 재업로드(정상 폴백).
