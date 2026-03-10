
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

  const tabs: { id: AcademyTab; label: string }[] = [
    { id: 'classes', label: '클래스' },
    { id: 'users', label: '구성원' },
    { id: 'diet', label: '식단' },
    { id: 'stickers', label: '칭찬' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h2 className="text-2xl font-bold text-slate-800">학원 관리</h2>
        <p className="text-sm text-slate-500">클래스와 구성원을 관리합니다.</p>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-slate-100 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors text-center ${
              activeTab === tab.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
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
