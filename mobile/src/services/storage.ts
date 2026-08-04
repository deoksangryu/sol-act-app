import * as SecureStore from 'expo-secure-store';

// 토큰만 보안 저장소에 보관(사이즈 제한 회피). 사용자는 부팅 시 토큰의 sub로 재조회.
const TOKEN_KEY = 'sol_act_token';

let _token: string | null = null;

export function getToken(): string | null {
  return _token;
}

/** 부팅 시 1회 호출: 보안 저장소에서 토큰을 메모리 캐시로 로드 */
export async function loadToken(): Promise<string | null> {
  try {
    _token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    _token = null;
  }
  return _token;
}

export async function setToken(token: string): Promise<void> {
  _token = token;
  try { await SecureStore.setItemAsync(TOKEN_KEY, token); } catch { /* keep memory cache */ }
}

export async function clearToken(): Promise<void> {
  _token = null;
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* noop */ }
}

// --- JWT payload 디코드 (base64url, atob 비의존 순수 구현) ---
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64UrlDecode(seg: string): string {
  let s = seg.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const e1 = B64.indexOf(s[i]);
    const e2 = B64.indexOf(s[i + 1]);
    const e3 = B64.indexOf(s[i + 2]);
    const e4 = B64.indexOf(s[i + 3]);
    out += String.fromCharCode((e1 << 2) | (e2 >> 4));
    if (s[i + 2] !== '=') out += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
    if (s[i + 3] !== '=') out += String.fromCharCode(((e3 & 3) << 6) | e4);
  }
  return out;
}

/** 현재 토큰 payload 디코드 (실패 시 null) */
export function getTokenPayload(): { sub?: string | number; exp?: number } | null {
  if (!_token) return null;
  const parts = _token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(b64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

/** 현재 토큰의 sub(user id) 추출 — 백엔드 JWT payload {"sub": user_id} */
export function getUserIdFromToken(): string | null {
  const sub = getTokenPayload()?.sub;
  return sub != null ? String(sub) : null;
}
