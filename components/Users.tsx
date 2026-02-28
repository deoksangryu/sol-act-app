
import React, { useState } from 'react';
import { User, UserRole } from '../types';

interface UsersProps {
  user: User;
  allUsers: User[];
}

export const Users: React.FC<UsersProps> = ({ user, allUsers }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers'>('students');

  if (user.role === UserRole.STUDENT) return <div className="p-8 text-center text-slate-400">접근 권한이 없습니다.</div>;

  const students = allUsers.filter(u => u.role === UserRole.STUDENT);
  const teachers = allUsers.filter(u => u.role === UserRole.TEACHER);
  const isDirector = user.role === UserRole.DIRECTOR;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">구성원 관리</h2>
          <p className="text-sm text-slate-500">
            {isDirector ? '학생 및 선생님을 관리합니다.' : '수강생 목록을 확인합니다.'}
          </p>
        </div>
        {/* Only Director can add users for now in this mock */}
        {isDirector && (
            <button className="text-sm font-bold text-orange-500 bg-orange-50 px-4 py-2 rounded-xl hover:bg-orange-100 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                추가
            </button>
        )}
      </div>

      {/* Tabs for Director */}
      {isDirector && (
          <div className="flex gap-2 border-b border-slate-100 shrink-0">
              <button 
                onClick={() => setActiveTab('students')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'students' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  수강생 ({students.length})
              </button>
              <button 
                onClick={() => setActiveTab('teachers')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'teachers' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  선생님 ({teachers.length})
              </button>
          </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-4">
        {(activeTab === 'students' || !isDirector ? students : teachers).map((u) => (
          <div key={u.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <img src={u.avatar} alt="User" className="w-16 h-16 rounded-full object-cover bg-slate-200" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-800 truncate">{u.name}</h3>
                  {isDirector && activeTab === 'teachers' && (
                      <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full">T</span>
                  )}
              </div>
              <p className="text-xs text-slate-400 truncate">{u.email}</p>
              
              <div className="mt-3 flex gap-2">
                 <button className="text-[10px] bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 font-medium">
                     {activeTab === 'students' || !isDirector ? '상담일지' : '담당 클래스'}
                 </button>
                 <button className="text-[10px] bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 font-medium">
                     {activeTab === 'students' || !isDirector ? '성적표' : '프로필 수정'}
                 </button>
              </div>
            </div>
          </div>
        ))}
        
        {(activeTab === 'teachers' && teachers.length === 0) && (
            <div className="col-span-full text-center py-10 text-slate-400">
                등록된 선생님이 없습니다.
            </div>
        )}
      </div>
    </div>
  );
};
