import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { authApi, DEMO_MODE } from '../services/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

const inputCls =
  'w-full p-3.5 bg-toss-surf border border-transparent rounded-2xl text-base text-toss-ink placeholder:text-toss-faint focus:bg-white focus:border-toss-blue outline-none transition-colors';

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [findMode, setFindMode] = useState<'none' | 'email' | 'password'>('none');

  // Find state
  const [findName, setFindName] = useState('');
  const [findEmail, setFindEmail] = useState('');
  const [findResults, setFindResults] = useState<{ email: string; role: string }[] | null>(null);
  const [tempPassword, setTempPassword] = useState('');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const pwRules = {
    length: regPassword.length >= 8,
    letter: /[A-Za-z]/.test(regPassword),
    digit: /\d/.test(regPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(regPassword),
  };
  const pwValid = pwRules.length && pwRules.letter && pwRules.digit && pwRules.special;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail || !regPassword) { setError('모든 칸을 채워주세요.'); return; }
    if (!pwValid) { setError('비밀번호 규칙을 확인해주세요.'); return; }
    if (regPassword !== regConfirm) { setError('비밀번호가 일치하지 않아요.'); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.register({ name: regName.trim(), email: regEmail, password: regPassword, role: UserRole.STUDENT });
      const res = await authApi.login(regEmail, regPassword);
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setFindMode('none');
    setError('');
    setFindResults(null);
    setTempPassword('');
  };

  const openFind = (fm: 'email' | 'password') => {
    setFindMode(fm);
    setError('');
    setFindName('');
    setFindEmail('');
    setFindResults(null);
    setTempPassword('');
  };

  const handleFindEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findName.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.findEmail(findName.trim());
      setFindResults(res.results);
    } catch (err: any) {
      setError(err.message || '이름에 해당하는 계정을 찾을 수 없어요.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findEmail.trim() || !findName.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.resetPassword(findEmail.trim(), findName.trim());
      setTempPassword(res.tempPassword);
    } catch (err: any) {
      setError(err.message || '계정을 찾을 수 없어요.');
    } finally {
      setLoading(false);
    }
  };

  const cta = 'w-full bg-toss-blue text-white p-4 rounded-2xl text-base font-semibold transition-colors disabled:bg-toss-surf disabled:text-toss-faint';

  return (
    <div
      className="min-h-[100dvh] bg-white flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex-1 w-full max-w-md mx-auto px-6 flex flex-col justify-center py-8">

        {/* Wordmark + 안내 */}
        <div className="mb-8">
          <h1 className="text-[28px] font-extrabold tracking-tight text-toss-blue">SOL-ACT</h1>
          <p className="text-[22px] font-bold leading-[1.4] text-toss-ink mt-5 tracking-[-0.02em]">
            {findMode !== 'none'
              ? <>계정을<br />찾아드릴게요</>
              : mode === 'login'
                ? <>다시 만나서<br />반가워요</>
                : <>쏠연기뮤지컬학원에<br />오신 걸 환영해요</>}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-toss-warn-bg text-toss-warn text-sm mb-4">{error}</div>
        )}

        {/* ── 계정 찾기 ── */}
        {findMode !== 'none' ? (
          <div className="animate-fade-in">
            <div className="flex bg-toss-surf rounded-2xl p-1 mb-4">
              <button onClick={() => openFind('email')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${findMode === 'email' ? 'bg-white text-toss-ink shadow-sm' : 'text-toss-sub'}`}>아이디 찾기</button>
              <button onClick={() => openFind('password')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${findMode === 'password' ? 'bg-white text-toss-ink shadow-sm' : 'text-toss-sub'}`}>비밀번호 찾기</button>
            </div>

            {findMode === 'email' ? (
              <form onSubmit={handleFindEmail} className="space-y-3">
                <input value={findName} onChange={(e) => setFindName(e.target.value)} className={inputCls} placeholder="가입할 때 입력한 이름" required />
                <button type="submit" disabled={loading} className={cta}>{loading ? '조회 중…' : '이메일 찾기'}</button>
                {findResults && (
                  <div className="p-4 rounded-2xl bg-toss-success-bg text-sm">
                    <p className="font-semibold text-toss-success mb-2">조회 결과</p>
                    {findResults.length === 0 && <p className="text-toss-sub">해당하는 계정이 없어요</p>}
                    {findResults.map((r, i) => (
                      <div key={i} className="flex justify-between items-center py-1">
                        <span className="text-toss-ink">{r.email}</span>
                        <span className="text-xs text-toss-sub">({r.role === 'student' ? '수강생' : r.role === 'teacher' ? '선생님' : '원장'})</span>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <input type="email" value={findEmail} onChange={(e) => setFindEmail(e.target.value)} className={inputCls} placeholder="가입한 이메일" required />
                <input value={findName} onChange={(e) => setFindName(e.target.value)} className={inputCls} placeholder="가입할 때 입력한 이름" required />
                <button type="submit" disabled={loading} className={cta}>{loading ? '처리 중…' : '임시 비밀번호 발급'}</button>
                {tempPassword && (
                  <div className="p-4 rounded-2xl bg-toss-success-bg text-sm">
                    <p className="font-semibold text-toss-success mb-1">임시 비밀번호가 발급됐어요</p>
                    <p className="font-mono text-lg text-center py-2 bg-white rounded-xl">{tempPassword}</p>
                    <p className="text-xs text-toss-sub mt-2">로그인 후 설정에서 비밀번호를 바꿔주세요.</p>
                  </div>
                )}
              </form>
            )}

            <button onClick={() => { setFindMode('none'); setError(''); }} className="w-full text-sm text-toss-sub py-3 mt-1">로그인으로 돌아가기</button>
          </div>
        ) : mode === 'login' ? (
          /* ── 로그인 ── */
          <form onSubmit={handleLogin} className="space-y-3 animate-fade-in">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="이메일" required autoComplete="email" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="비밀번호" required autoComplete="current-password" />
            <button type="submit" disabled={loading} className={cta}>{loading ? '로그인 중…' : '로그인'}</button>
            <div className="flex justify-center gap-3 text-[13px] text-toss-sub pt-1">
              <button type="button" onClick={() => openFind('email')}>아이디 찾기</button>
              <span className="text-toss-line">|</span>
              <button type="button" onClick={() => openFind('password')}>비밀번호 찾기</button>
            </div>
          </form>
        ) : (
          /* ── 회원가입 (초대코드 없음) ── */
          <form onSubmit={handleRegister} className="space-y-3 animate-fade-in">
            {/* 수강생 가입 전용 — 선생님 계정은 원장이 직접 등록 */}
            <input value={regName} onChange={(e) => setRegName(e.target.value)} className={inputCls} placeholder="이름" required />
            <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className={inputCls} placeholder="이메일" required autoComplete="email" />
            <div>
              <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className={inputCls} placeholder="비밀번호 (8자 이상, 영문+숫자+특수문자)" required autoComplete="new-password" />
              {regPassword && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 px-1">
                  <span className={`text-xs ${pwRules.length ? 'text-toss-success' : 'text-toss-faint'}`}>{pwRules.length ? '✓' : '•'} 8자 이상</span>
                  <span className={`text-xs ${pwRules.letter ? 'text-toss-success' : 'text-toss-faint'}`}>{pwRules.letter ? '✓' : '•'} 영문</span>
                  <span className={`text-xs ${pwRules.digit ? 'text-toss-success' : 'text-toss-faint'}`}>{pwRules.digit ? '✓' : '•'} 숫자</span>
                  <span className={`text-xs ${pwRules.special ? 'text-toss-success' : 'text-toss-faint'}`}>{pwRules.special ? '✓' : '•'} 특수문자</span>
                </div>
              )}
            </div>
            <div>
              <input type="password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} className={inputCls} placeholder="비밀번호 확인" required autoComplete="new-password" />
              {regConfirm && regPassword !== regConfirm && <p className="text-xs text-toss-warn mt-1 px-1">비밀번호가 일치하지 않아요.</p>}
            </div>
            <button type="submit" disabled={loading || !pwValid || regPassword !== regConfirm} className={cta}>{loading ? '가입 중…' : '회원가입'}</button>
          </form>
        )}

        {/* 하단 탭 전환 */}
        {findMode === 'none' && (
          <div className="text-center text-[13px] text-toss-sub mt-6">
            {mode === 'login'
              ? <>아직 계정이 없나요? <button onClick={() => switchMode('register')} className="text-toss-blue font-semibold">회원가입</button></>
              : <>이미 계정이 있나요? <button onClick={() => switchMode('login')} className="text-toss-blue font-semibold">로그인</button></>}
          </div>
        )}

        {DEMO_MODE && (
          <div className="mt-5 p-3 rounded-2xl bg-toss-blue-bg text-xs text-toss-blue text-center">
            <p className="font-semibold mb-1">데모 모드</p>
            <p>student@muse.com / teacher@muse.com / director@muse.com</p>
            <p>비밀번호: demo</p>
          </div>
        )}
      </div>
    </div>
  );
};
