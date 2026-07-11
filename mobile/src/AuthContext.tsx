import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadToken, getToken, clearToken } from './services/storage';
import { authApi, usersApi, setSessionExpiredHandler } from './services/api';
import type { User } from './types';

type Status = 'loading' | 'authed' | 'guest';

interface AuthCtx {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  // 부팅: 저장된 토큰 로드 → sub로 본인 조회(자동 로그인)
  const boot = useCallback(async () => {
    await loadToken();
    if (!getToken()) { setStatus('guest'); return; }
    try {
      const me = await usersApi.getMe();
      if (me) { setUser(me); setStatus('authed'); }
      else { await clearToken(); setStatus('guest'); }
    } catch {
      await clearToken();
      setStatus('guest');
    }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  // 401 → 로그인으로 전환
  useEffect(() => {
    setSessionExpiredHandler(() => { setUser(null); setStatus('guest'); });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const me: User | null = res?.user ?? (await usersApi.getMe());
    if (!me) throw new Error('사용자 정보를 불러오지 못했습니다.');
    setUser(me);
    setStatus('authed');
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
    setStatus('guest');
  }, []);

  const refresh = useCallback(async () => {
    const me = await usersApi.getMe();
    if (me) setUser(me);
  }, []);

  return <Ctx.Provider value={{ status, user, login, logout, refresh }}>{children}</Ctx.Provider>;
}
