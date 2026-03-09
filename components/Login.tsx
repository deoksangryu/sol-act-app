
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { authApi, DEMO_MODE } from '../services/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

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
  const [regCode, setRegCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRole, setRegRole] = useState<'student' | 'teacher'>('student');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const pwRules = {
    length: regPassword.length >= 8,
    letter: /[A-Za-z]/.test(regPassword),
    digit: /\d/.test(regPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(regPassword),
  };
  const pwValid = pwRules.length && pwRules.letter && pwRules.digit && pwRules.special;

  const handleVerifyCode = async (code: string) => {
    setRegCode(code);
    setCodeVerified(false);
    if (code.length < 8) return;
    try {
      const res = await authApi.verifyCode(code);
      if (res.valid) {
        setCodeVerified(true);
        setRegRole(res.role as 'student' | 'teacher');
        setError('');
      }
    } catch {
      setCodeVerified(false);
      setError('유효하지 않은 인증코드입니다.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeVerified) { setError('인증코드를 확인해주세요.'); return; }
    if (!regName.trim() || !regEmail || !regPassword) { setError('모든 필드를 입력해주세요.'); return; }
    if (!pwValid) { setError('비밀번호 규칙을 확인해주세요.'); return; }
    if (regPassword !== regConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.register({ name: regName, email: regEmail, password: regPassword, role: regRole as UserRole, inviteCode: regCode });
      // Auto-login after registration
      const res = await authApi.login(regEmail, regPassword);
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다.');
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
    setRegCode('');
    setCodeVerified(false);
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
      setError(err.message || '이름에 해당하는 계정을 찾을 수 없습니다.');
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
      setError(err.message || '계정을 찾을 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-5 md:p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 relative overflow-hidden">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-yellow-400 mb-2 tracking-tighter">SOL-ACT</h1>
          <p className="text-slate-500 font-medium">연기 입시의 새로운 기준</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            로그인
          </button>
          <button
            onClick={() => switchMode('register')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'register' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            회원가입
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center mb-4">
            {error}
          </div>
        )}

        {findMode !== 'none' ? (
          /* --- 아이디 찾기 / 비밀번호 찾기 --- */
          <div className="space-y-4 animate-fade-in">
            <div className="flex bg-slate-100 rounded-xl p-1 mb-2">
              <button
                onClick={() => openFind('email')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${findMode === 'email' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                아이디 찾기
              </button>
              <button
                onClick={() => openFind('password')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${findMode === 'password' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                비밀번호 찾기
              </button>
            </div>

            {findMode === 'email' ? (
              <form onSubmit={handleFindEmail} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">이름</label>
                  <input
                    value={findName}
                    onChange={(e) => setFindName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors"
                    placeholder="가입 시 입력한 이름"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-600 text-white p-3 rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '조회 중...' : '이메일 찾기'}
                </button>
                {findResults && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-sm">
                    <p className="font-bold text-green-700 mb-2">조회 결과</p>
                    {findResults.map((r, i) => (
                      <div key={i} className="flex justify-between items-center py-1">
                        <span className="text-slate-700 font-mono">{r.email}</span>
                        <span className="text-xs text-slate-400">({r.role === 'student' ? '수강생' : r.role === 'teacher' ? '선생님' : '원장'})</span>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">이메일</label>
                  <input
                    type="email"
                    value={findEmail}
                    onChange={(e) => setFindEmail(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors"
                    placeholder="가입한 이메일"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">이름</label>
                  <input
                    value={findName}
                    onChange={(e) => setFindName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors"
                    placeholder="가입 시 입력한 이름"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-600 text-white p-3 rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '처리 중...' : '임시 비밀번호 발급'}
                </button>
                {tempPassword && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-sm">
                    <p className="font-bold text-green-700 mb-1">임시 비밀번호가 발급되었습니다</p>
                    <p className="font-mono text-lg text-center py-2 bg-white rounded-lg border border-green-100">{tempPassword}</p>
                    <p className="text-xs text-slate-500 mt-2">로그인 후 설정에서 비밀번호를 변경해주세요.</p>
                  </div>
                )}
              </form>
            )}

            <button
              onClick={() => { setFindMode('none'); setError(''); setFindResults(null); setTempPassword(''); }}
              className="w-full text-sm text-slate-400 hover:text-slate-600 py-2 transition-colors"
            >
              로그인으로 돌아가기
            </button>
          </div>
        ) : mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors"
                placeholder="이메일을 입력하세요"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors"
                placeholder="비밀번호를 입력하세요"
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white p-4 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
            <div className="flex justify-center gap-3 text-xs text-slate-400 pt-1">
              <button type="button" onClick={() => openFind('email')} className="hover:text-slate-600 transition-colors">아이디 찾기</button>
              <span>|</span>
              <button type="button" onClick={() => openFind('password')} className="hover:text-slate-600 transition-colors">비밀번호 찾기</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">인증코드 <span className="text-red-400">*</span></label>
              <div className="relative">
                <input
                  value={regCode}
                  onChange={(e) => handleVerifyCode(e.target.value.toUpperCase())}
                  className={`w-full p-3 bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 outline-none transition-colors font-mono tracking-widest uppercase ${codeVerified ? 'border-green-400 bg-green-50' : 'border-slate-200 focus:border-brand-400 focus:bg-white'}`}
                  placeholder="학원에서 발급받은 코드"
                  maxLength={8}
                  required
                />
                {codeVerified && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm font-bold">
                    {regRole === 'student' ? '수강생' : '선생님'}
                  </span>
                )}
              </div>
              {regCode && !codeVerified && regCode.length >= 8 && (
                <p className="text-xs text-red-500 mt-1">유효하지 않은 코드입니다.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">이름 <span className="text-red-400">*</span></label>
              <input
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors disabled:opacity-50"
                placeholder="이름을 입력하세요"
                required
                disabled={!codeVerified}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">이메일 <span className="text-red-400">*</span></label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors disabled:opacity-50"
                placeholder="이메일을 입력하세요"
                required
                autoComplete="email"
                disabled={!codeVerified}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">비밀번호 <span className="text-red-400">*</span></label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors disabled:opacity-50"
                placeholder="8자 이상, 영문+숫자+특수문자"
                required
                autoComplete="new-password"
                disabled={!codeVerified}
              />
              {regPassword && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className={`text-xs ${pwRules.length ? 'text-green-500' : 'text-slate-400'}`}>{pwRules.length ? '\u2713' : '\u2022'} 8자 이상</span>
                  <span className={`text-xs ${pwRules.letter ? 'text-green-500' : 'text-slate-400'}`}>{pwRules.letter ? '\u2713' : '\u2022'} 영문</span>
                  <span className={`text-xs ${pwRules.digit ? 'text-green-500' : 'text-slate-400'}`}>{pwRules.digit ? '\u2713' : '\u2022'} 숫자</span>
                  <span className={`text-xs ${pwRules.special ? 'text-green-500' : 'text-slate-400'}`}>{pwRules.special ? '\u2713' : '\u2022'} 특수문자</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">비밀번호 확인 <span className="text-red-400">*</span></label>
              <input
                type="password"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors disabled:opacity-50"
                placeholder="비밀번호를 다시 입력하세요"
                required
                autoComplete="new-password"
                disabled={!codeVerified}
              />
              {regConfirm && regPassword !== regConfirm && (
                <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !codeVerified || !pwValid || regPassword !== regConfirm}
              className="w-full bg-yellow-400 text-slate-800 p-4 rounded-xl font-bold hover:bg-yellow-500 transition-colors shadow-lg shadow-yellow-100 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>
        )}

        {DEMO_MODE && (
          <div className="mt-4 p-3 rounded-xl bg-brand-50 border border-brand-200 text-xs text-brand-700 text-center">
            <p className="font-bold mb-1">Demo Mode</p>
            <p>student@muse.com / teacher@muse.com / director@muse.com</p>
            <p className="text-brand-500">비밀번호: demo</p>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-slate-300">
          SOL-ACT Academy System v2.0
        </p>
      </div>
    </div>
  );
};
