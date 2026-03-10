
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Classes } from './Classes';
import { Users } from './Users';
import { Diet } from './Diet';
import { PraiseStickers } from './PraiseStickers';

interface AcademyManagementProps {
  user: User;
}

type AcademyTab = 'classes' | 'users' | 'diet' | 'stickers';

export const AcademyManagement: React.FC<AcademyManagementProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<AcademyTab>('classes');

  // Only staff can access
  if (user.role === UserRole.STUDENT) {
    return <div className="p-8 text-center text-slate-400">접근 권한이 없습니다.</div>;
  }

  const tabs: { id: AcademyTab; label: string; icon: string }[] = [
    { id: 'classes', label: '클래스 관리', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'users', label: '구성원 관리', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'diet', label: '식단 관리', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'stickers', label: '칭찬스티커', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h2 className="text-2xl font-bold text-slate-800">학원 관리</h2>
        <p className="text-sm text-slate-500">클래스와 구성원을 관리합니다.</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-slate-100 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-4">
        {activeTab === 'classes' && (
          <Classes user={user} />
        )}
        {activeTab === 'users' && (
          <Users user={user} />
        )}
        {activeTab === 'diet' && (
          <Diet user={user} />
        )}
        {activeTab === 'stickers' && (
          <PraiseStickers user={user} />
        )}
      </div>
    </div>
  );
};
