// R8 코드·리소스 축소를 릴리스 빌드에 켜는 config 플러그인.
// android/ 는 expo prebuild 재생성물(gitignore)이라 gradle.properties 직접수정은 날아간다.
// 이 플러그인이 prebuild마다 아래 두 속성을 주입해 build.gradle의
//   minifyEnabled  <- android.enableMinifyInReleaseBuilds
//   shrinkResources<- android.enableShrinkResourcesInReleaseBuilds
// 를 true로 만든다. (dex 축소 + 미사용 리소스 제거 → 앱 크기↓, Play 최적화 점수↑, mapping.txt 생성)
const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withR8(config) {
  return withGradleProperties(config, (cfg) => {
    const set = (key, value) => {
      const i = cfg.modResults.findIndex((p) => p.type === 'property' && p.key === key);
      if (i >= 0) cfg.modResults[i].value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    };
    set('android.enableMinifyInReleaseBuilds', 'true');
    set('android.enableShrinkResourcesInReleaseBuilds', 'true');
    return cfg;
  });
};
