/** 새 배포 자동 감지 → 안전할 때 조용히 새로고침.
 *
 *  배경: 서비스워커가 index.html을 네트워크 우선으로 주지만, 앱이 "이미 떠 있던 세션"으로
 *  resume되면 메모리의 옛 JS가 계속 돈다(앱을 완전히 닫았다 열어야 갱신). 그래서 앱이
 *  다시 보이는 순간(resume/focus)에 서버의 최신 index를 받아 현재 번들과 비교하고,
 *  새 버전이면 reload 한다.
 *
 *  안전 규칙:
 *   - 영상 업로드 중이면 절대 새로고침하지 않음(업로드 중단 방지).
 *   - 개발 모드(해시 번들 없음)에선 비활성.
 *   - 1분에 한 번으로 제한.
 *   - resume/focus 시점에만 reload → 작업 중간에 갑자기 끊기지 않음.
 */
const ENTRY_RE = /assets\/index-[A-Za-z0-9_-]+\.js/;
const entryOf = (s: string): string | null => s.match(ENTRY_RE)?.[0] || null;

let current: string | null = null;
let lastCheck = 0;
let isUploading: () => boolean = () => false;

async function check(): Promise<void> {
  const now = Date.now();
  if (now - lastCheck < 60_000) return; // 1분 throttle
  lastCheck = now;
  try {
    // 서비스워커가 '/'는 네트워크 우선이라 최신 index를 받는다(쿼리로 HTTP 캐시도 우회).
    const res = await fetch('/?_swcheck=' + now, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = entryOf(await res.text());
    if (current && latest && latest !== current && !isUploading()) {
      window.location.reload();
    }
  } catch {
    /* 오프라인 등 — 무시 */
  }
}

export function initAutoUpdate(isUploadingGetter: () => boolean): void {
  isUploading = isUploadingGetter;
  // 지금 실행 중인 엔트리 번들 파일명(빌드마다 콘텐츠 해시로 바뀜)
  const tag = document.querySelector('script[type="module"][src*="/assets/index-"]') as HTMLScriptElement | null;
  current = tag ? entryOf(tag.src) : null;
  if (!current) return; // dev 모드 등 — 비활성

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', check);
}
