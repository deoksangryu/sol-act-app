
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { resolveFileUrl } from '../services/api';

interface UsersProps {
  user: User;
  allUsers: User[];
}

export const Users: React.FC<UsersProps> = ({ user, allUsers }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'directors'>('students');

  if (user.role === UserRole.STUDENT) return <div className="p-8 text-center text-slate-400">접근 권한이 없습니다.</div>;

  const students = allUsers.filter(u => u.role === UserRole.STUDENT);
  const teachers = allUsers.filter(u => u.role === UserRole.TEACHER);
  const directors = allUsers.filter(u => u.role === UserRole.DIRECTOR);
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
            <button className="text-sm font-bold text-brand-500 bg-brand-50 px-4 py-2 rounded-xl hover:bg-brand-100 flex items-center gap-2">
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
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'students' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  수강생 ({students.length})
              </button>
              <button
                onClick={() => setActiveTab('teachers')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'teachers' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  선생님 ({teachers.length})
              </button>
              <button
                onClick={() => setActiveTab('directors')}
                className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'directors' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                  원장 ({directors.length})
              </button>
          </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-4">
        {(activeTab === 'students' || !isDirector ? students : activeTab === 'teachers' ? teachers : directors).map((u) => (
          <div key={u.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <img src={resolveFileUrl(u.avatar)} alt="User" className="w-16 h-16 rounded-full object-cover bg-slate-200" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-800 truncate">{u.name}</h3>
              </div>
              <p className="text-xs text-slate-400 truncate">{u.email}</p>
              <div className="mt-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${u.role === UserRole.STUDENT ? 'bg-brand-50 text-brand-600' : u.role === UserRole.TEACHER ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                  {u.role === UserRole.STUDENT ? '수강생' : u.role === UserRole.TEACHER ? '선생님' : '원장'}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isDirector && activeTab === 'teachers' && teachers.length === 0 && (
          <div className="col-span-full text-center py-10 text-slate-400">등록된 선생님이 없습니다.</div>
        )}
        {isDirector && activeTab === 'directors' && directors.length === 0 && (
          <div className="col-span-full text-center py-10 text-slate-400">등록된 원장이 없습니다.</div>
        )}
      </div>
    </div>
  );
};
