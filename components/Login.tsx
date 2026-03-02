
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { authApi, DEMO_MODE } from '../services/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail || !regPassword) { setError('모든 필드를 입력해주세요.'); return; }
    if (!pwValid) { setError('비밀번호 규칙을 확인해주세요.'); return; }
    if (regPassword !== regConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.register({ name: regName, email: regEmail, password: regPassword, role: regRole as UserRole });
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
    setError('');
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 relative overflow-hidden">

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

        {mode === 'login' ? (
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
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">이름 <span className="text-red-400">*</span></label>
              <input
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors"
                placeholder="이름을 입력하세요"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">이메일 <span className="text-red-400">*</span></label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors"
                placeholder="이메일을 입력하세요"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">역할</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRegRole('student')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${regRole === 'student' ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  수강생
                </button>
                <button
                  type="button"
                  onClick={() => setRegRole('teacher')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${regRole === 'teacher' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  선생님
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">비밀번호 <span className="text-red-400">*</span></label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors"
                placeholder="8자 이상, 영문+숫자+특수문자"
                required
                autoComplete="new-password"
              />
              {regPassword && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className={`text-[10px] ${pwRules.length ? 'text-green-500' : 'text-slate-400'}`}>{pwRules.length ? '\u2713' : '\u2022'} 8자 이상</span>
                  <span className={`text-[10px] ${pwRules.letter ? 'text-green-500' : 'text-slate-400'}`}>{pwRules.letter ? '\u2713' : '\u2022'} 영문</span>
                  <span className={`text-[10px] ${pwRules.digit ? 'text-green-500' : 'text-slate-400'}`}>{pwRules.digit ? '\u2713' : '\u2022'} 숫자</span>
                  <span className={`text-[10px] ${pwRules.special ? 'text-green-500' : 'text-slate-400'}`}>{pwRules.special ? '\u2713' : '\u2022'} 특수문자</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">비밀번호 확인 <span className="text-red-400">*</span></label>
              <input
                type="password"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white outline-none transition-colors"
                placeholder="비밀번호를 다시 입력하세요"
                required
                autoComplete="new-password"
              />
              {regConfirm && regPassword !== regConfirm && (
                <p className="text-[10px] text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !pwValid || regPassword !== regConfirm}
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
