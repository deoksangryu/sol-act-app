// SOL-ACT 릴리스 서명 자동 배선 config 플러그인.
// android/ 는 expo prebuild 재생성물(gitignore)이라 build.gradle 직접수정은 날아간다.
// 이 플러그인이 prebuild마다 android/app/build.gradle 에 signingConfigs.release 를 주입하고
// release 빌드가 그 키로 서명되게 한다. 키/비밀번호는 mobile/credentials/keystore.properties(gitignore)에서 로드.
// keystore.properties 가 없으면(예: CI 미설정) 디버그 서명으로 안전 폴백.
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let g = cfg.modResults.contents;

    // 1) signingConfigs 블록에 release 추가 — 고유 마커로 중복방지, 디버그 블록 끝(keyPassword 'android' })에 앵커해 삽입.
    if (!g.includes("props['storeFile']")) {
      const releaseBlock = `
        release {
            def kp = rootProject.file("../credentials/keystore.properties")
            if (kp.exists()) {
                def props = new Properties()
                props.load(new FileInputStream(kp))
                storeFile file(props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            }
        }`;
      g = g.replace(/(keyPassword 'android'\s*\n\s*\})/, `$1${releaseBlock}`);
    }

    // 2) release 빌드타입이 keystore.properties 존재 시 릴리스 키로 서명(없으면 디버그 폴백)
    //    빌드타입 release 블록의 signingConfig 만 정확히 교체(주석 앵커).
    g = g.replace(
      /(\/\/ Caution! In production[\s\S]*?\n\s*)signingConfig signingConfigs\.debug/,
      `$1signingConfig rootProject.file("../credentials/keystore.properties").exists() ? signingConfigs.release : signingConfigs.debug`
    );

    cfg.modResults.contents = g;
    return cfg;
  });
};
