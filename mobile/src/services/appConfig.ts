// 앱 버전 게이트 — 런치 시 백엔드 설정을 받아 설치버전과 비교.
// 공개 엔드포인트라 인증 없이 raw fetch. 응답은 camelCase 그대로 사용.
import Constants from 'expo-constants';
import { API_URL } from '../config';

export interface AppVersionConfig {
  minVersion: string;
  latestVersion: string;
  iosUrl: string;
  androidUrl: string;
  message: string;
}

// app.json의 expo.version (예: "1.0.0"). 없으면 0.0.0으로 간주(=강제 안 걸리게).
export const CURRENT_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

export async function fetchAppConfig(): Promise<AppVersionConfig | null> {
  try {
    const res = await fetch(`${API_URL}/api/app/config`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!res.ok) return null;
    return (await res.json()) as AppVersionConfig;
  } catch {
    return null; // 오프라인·서버다운 등 — 게이트를 띄우지 않음(정상 진입)
  }
}

/** semver 숫자 비교: a<b => -1, a==b => 0, a>b => 1 */
export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export type UpdateLevel = 'none' | 'soft' | 'hard';

export function updateLevel(cfg: AppVersionConfig, current: string = CURRENT_VERSION): UpdateLevel {
  if (cmpVersion(current, cfg.minVersion) < 0) return 'hard'; // 강제
  if (cmpVersion(current, cfg.latestVersion) < 0) return 'soft'; // 권장
  return 'none';
}
