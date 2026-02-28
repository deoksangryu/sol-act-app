
import React, { useState } from 'react';
import { User, UserRole, ClassInfo } from '../types';
import { Classes } from './Classes';
import { Users } from './Users';

interface AcademyManagementProps {
  user: User;
  classes: ClassInfo[];
  setClasses: (classes: ClassInfo[]) => void;
  allUsers: User[];
}

type AcademyTab = 'classes' | 'users';

export const AcademyManagement: React.FC<AcademyManagementProps> = ({ user, classes, setClasses, allUsers }) => {
  const [activeTab, setActiveTab] = useState<AcademyTab>('classes');

  // Only staff can access
  if (user.role === UserRole.STUDENT) {
    return <div className="p-8 text-center text-slate-400">접근 권한이 없습니다.</div>;
  }

  const tabs: { id: AcademyTab; label: string; icon: string }[] = [
    { id: 'classes', label: '클래스 관리', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'users', label: '구성원 관리', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
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
              activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'
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
          <Classes user={user} classes={classes} setClasses={setClasses} allUsers={allUsers} />
        )}
        {activeTab === 'users' && (
          <Users user={user} allUsers={allUsers} />
        )}
      </div>
    </div>
  );
};
