
import React from 'react';
import { User, UserRole, ViewState } from '../types';
import { resolveFileUrl } from '../services/api';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  user: User;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, user, onLogout }) => {
  // v8 프로토타입 5탭 — 역할 무관 동일 (내용만 역할별 분기)
  const menuItems = [
    { id: 'classes', label: '수업', icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.42a12 12 0 01.34 5.84A12 12 0 0112 21a12 12 0 01-6.5-4.58 12 12 0 01.34-5.84L12 14z' },
    { id: 'assignments', label: '과제', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4' },
    { id: 'video', label: '영상', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    { id: 'diet', label: '식단', icon: 'M4 3v6a2 2 0 002 2h0a2 2 0 002-2V3M6 11v10M18 3c-1.66 0-3 2-3 5s1.34 4 3 4m0 0v9' },
    { id: 'music', label: '음악', icon: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-8 pb-4">
         <h2 className="text-3xl font-extrabold text-yellow-400 tracking-tighter">SOL-ACT</h2>
         <p className="text-xs font-semibold text-slate-400">연기 학원 플랫폼</p>
      </div>

      <div className="px-6 mb-8 flex items-center gap-3">
        <img
          src={resolveFileUrl(user.avatar)}
          alt="Profile"
          className="w-10 h-10 rounded-full bg-slate-200 object-cover cursor-pointer hover:ring-2 hover:ring-brand-300"
          onClick={() => onChangeView('profile' as ViewState)}
        />
        <div className="cursor-pointer" onClick={() => onChangeView('profile' as ViewState)}>
          <p className="font-bold text-slate-800 text-sm hover:text-brand-500">{user.name}</p>
          <p className="text-xs text-slate-400 capitalize">
            {user.role === UserRole.DIRECTOR ? 'Director' : user.role === UserRole.TEACHER ? 'Teacher' : 'Student'}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id as ViewState)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
              currentView === item.id
                ? 'bg-brand-500 text-white shadow-md shadow-brand-200'
                : 'text-slate-600 hover:bg-slate-50 hover:text-brand-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          로그아웃
        </button>
      </div>
    </div>
  );
};
