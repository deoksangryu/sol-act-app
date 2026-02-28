
import React, { useState } from 'react';
import { UserRole } from '../types';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setId('');
    setPassword('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole && id && password) {
      // Mock Logic: If logging in as Teacher with id 'director', grant DIRECTOR role.
      // In a real app, the backend would return the user's role in the auth token.
      if (selectedRole === UserRole.TEACHER && id === 'director') {
        onLogin(UserRole.DIRECTOR);
      } else {
        onLogin(selectedRole);
      }
    }
  };

  const getRoleName = (role: UserRole) => {
    switch (role) {
        case UserRole.STUDENT: return 'Student';
        case UserRole.TEACHER: return 'Teacher';
        default: return '';
    }
  };

  const getRoleDisplayName = (role: UserRole) => {
      switch (role) {
          case UserRole.STUDENT: return '수강생 로그인';
          case UserRole.TEACHER: return '선생님 로그인';
          default: return '';
      }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100 relative overflow-hidden">
        
        {/* Header - Always visible */}
        <div className="text-center mb-10 transition-all">
          <h1 className="text-4xl font-extrabold text-orange-500 mb-2 tracking-tighter">MUSE</h1>
          <p className="text-slate-500 font-medium">연기 입시의 새로운 기준</p>
        </div>

        {/* Step 1: Role Selection View */}
        {!selectedRole && (
          <div className="space-y-3 animate-fade-in">
            <button
              onClick={() => handleRoleSelect(UserRole.STUDENT)}
              className="w-full group relative flex items-center justify-center p-4 rounded-2xl bg-white border-2 border-orange-100 hover:border-orange-500 hover:shadow-lg transition-all duration-300"
            >
              <div className="text-left w-full pl-4">
                <p className="text-xs text-orange-500 font-bold uppercase tracking-wide mb-1">Student</p>
                <p className="text-lg font-bold text-slate-800 group-hover:text-orange-600">수강생 로그인</p>
              </div>
              <div className="absolute right-6 w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <svg className="w-4 h-4 text-orange-500 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
            </button>

            <button
              onClick={() => handleRoleSelect(UserRole.TEACHER)}
              className="w-full group relative flex items-center justify-center p-4 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-800 hover:shadow-lg transition-all duration-300"
            >
              <div className="text-left w-full pl-4">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-1">Teacher</p>
                <p className="text-lg font-bold text-slate-800">선생님 로그인</p>
              </div>
              <div className="absolute right-6 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-800 transition-colors">
                <svg className="w-4 h-4 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Login Form View */}
        {selectedRole && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
             <div className="text-center mb-6">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-2 ${
                    selectedRole === UserRole.STUDENT ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
                }`}>
                    {getRoleName(selectedRole)} Login
                </span>
                <h2 className="text-xl font-bold text-slate-800">{getRoleDisplayName(selectedRole)}</h2>
             </div>

             <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">아이디</label>
                    <input 
                        type="text" 
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white outline-none transition-colors"
                        placeholder={selectedRole === UserRole.TEACHER ? "ID (원장님은 director 입력)" : "ID를 입력하세요"}
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">비밀번호</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white outline-none transition-colors"
                        placeholder="비밀번호를 입력하세요"
                        required
                    />
                </div>
             </div>

             <div className="flex flex-col gap-3 pt-2">
                <button 
                    type="submit"
                    className="w-full bg-slate-800 text-white p-4 rounded-xl font-bold hover:bg-slate-700 transition-colors shadow-lg shadow-slate-200"
                >
                    로그인
                </button>
                <button 
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="w-full text-slate-400 text-sm font-medium hover:text-slate-600 p-2"
                >
                    이전으로 돌아가기
                </button>
             </div>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-slate-300">
          Muse Academy System v1.2
        </p>
      </div>
    </div>
  );
};
