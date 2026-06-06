/** 영상 파일의 길이(초)를 메타데이터만 로드해 얻는다. 파일 본문을 디코딩하지 않아 가볍다.
 *  제시대사 연기영상의 2분(120초) 제한 검증에 사용. 실패 시 null(검증을 막지 않음). */
export function getVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      const done = (d: number | null) => {
        URL.revokeObjectURL(url);
        v.removeAttribute('src');
        resolve(d);
      };
      v.onloadedmetadata = () => {
        const d = v.duration;
        done(isFinite(d) && d > 0 ? d : null);
      };
      v.onerror = () => done(null);
      // 일부 환경에서 메타데이터 이벤트가 늦는 경우 대비(8초 타임아웃)
      setTimeout(() => done(null), 8000);
      v.src = url;
    } catch {
      resolve(null);
    }
  });
}
