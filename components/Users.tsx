
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { resolveFileUrl, userApi, authApi } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';
import toast from 'react-hot-toast';
import { useAppData } from '../services/AppContext';

interface InviteCode {
  code: string;
  role: string;
  used: boolean;
  usedBy?: string;
  memo?: string;
  createdAt?: string;
}

interface UsersProps {
  user: User;
  onUserDeleted?: () => void;
}

export const Users: React.FC<UsersProps> = ({ user, onUserDeleted }) => {
  const { allUsers } = useAppData();
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'directors'>('students');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<'student' | 'teacher'>('student');
  const [inviteCount, setInviteCount] = useState(1);
  const [inviteMemo, setInviteMemo] = useState('');
  const [generatedCodes, setGeneratedCodes] = useState<InviteCode[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [showCodesTab, setShowCodesTab] = useState<'create' | 'list'>('create');
  const [inviteLoading, setInviteLoading] = useState(false);

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      await userApi.delete(deleteUserId);
      setDeleteUserId(null);
      toast.success('사용자가 삭제되었습니다.');
      onUserDeleted?.();
    } catch { toast.error('사용자 삭제에 실패했습니다.'); }
  };

  const handleCreateCodes = async () => {
    setInviteLoading(true);
    try {
      const codes = await authApi.createInviteCodes({ role: inviteRole, count: inviteCount, memo: inviteMemo || undefined });
      setGeneratedCodes(codes as InviteCode[]);
      toast.success(`초대 코드 ${codes.length}개가 생성되었습니다.`);
    } catch { toast.error('초대 코드 생성에 실패했습니다.'); }
    finally { setInviteLoading(false); }
  };

  const handleLoadCodes = async () => {
    try {
      const codes = await authApi.listInviteCodes();
      setInviteCodes(codes as InviteCode[]);
    } catch { toast.error('초대 코드 목록을 불러올 수 없습니다.'); }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('코드가 복사되었습니다.');
  };

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
        {isDirector && (
            <button
              onClick={() => { setShowInviteModal(true); setGeneratedCodes([]); setShowCodesTab('create'); }}
              className="text-sm font-bold text-brand-500 bg-brand-50 px-4 py-2 rounded-xl hover:bg-brand-100 flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                초대 코드
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 overflow-y-auto pb-4">
        {(activeTab === 'students' || !isDirector ? students : activeTab === 'teachers' ? teachers : directors).map((u) => (
          <div key={u.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <img src={resolveFileUrl(u.avatar)} alt="User" className="w-16 h-16 rounded-full object-cover bg-slate-200" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-800 truncate">{u.name}</h3>
                {isDirector && u.id !== user.id && (
                  <button
                    onClick={() => setDeleteUserId(u.id)}
                    className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                  >삭제</button>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{u.email}</p>
              <div className="mt-2">
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${u.role === UserRole.STUDENT ? 'bg-brand-50 text-brand-600' : u.role === UserRole.TEACHER ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
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

      {deleteUserId && (
        <ConfirmDialog
          title="사용자 삭제"
          message="이 사용자의 모든 관련 데이터(과제, 식단, 포트폴리오 등)가 함께 삭제됩니다. 정말 삭제하시겠습니까?"
          variant="danger"
          confirmLabel="삭제"
          onConfirm={handleDeleteUser}
          onCancel={() => setDeleteUserId(null)}
        />
      )}

      {/* Invite Code Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">초대 코드 관리</h3>
                <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Tab switch */}
              <div className="flex gap-2 mb-6 border-b border-slate-100">
                <button
                  onClick={() => setShowCodesTab('create')}
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${showCodesTab === 'create' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400'}`}
                >생성</button>
                <button
                  onClick={() => { setShowCodesTab('list'); handleLoadCodes(); }}
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${showCodesTab === 'list' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400'}`}
                >목록</button>
              </div>

              {showCodesTab === 'create' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">역할</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setInviteRole('student')}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${inviteRole === 'student' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                      >수강생</button>
                      <button
                        onClick={() => setInviteRole('teacher')}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${inviteRole === 'teacher' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                      >선생님</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">생성 개수</label>
                    <input
                      type="number" min={1} max={20} value={inviteCount}
                      onChange={e => setInviteCount(Math.max(1, Math.min(20, Number(e.target.value))))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-300 focus:border-brand-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">메모 (선택)</label>
                    <input
                      type="text" value={inviteMemo} onChange={e => setInviteMemo(e.target.value)}
                      placeholder="예: 3월 신규 수강생"
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-300 focus:border-brand-400 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleCreateCodes}
                    disabled={inviteLoading}
                    className="w-full py-3 bg-brand-500 text-white rounded-xl font-bold text-sm hover:bg-brand-600 disabled:opacity-50 transition-colors"
                  >
                    {inviteLoading ? '생성 중...' : `코드 ${inviteCount}개 생성`}
                  </button>

                  {/* Generated codes display */}
                  {generatedCodes.length > 0 && (
                    <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-sm font-bold text-green-700 mb-3">생성 완료!</p>
                      <div className="space-y-2">
                        {generatedCodes.map(c => (
                          <div key={c.code} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-green-100">
                            <code className="text-sm font-mono font-bold text-slate-700">{c.code}</code>
                            <button
                              onClick={() => handleCopyCode(c.code)}
                              className="text-xs text-brand-500 font-bold hover:text-brand-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            >복사</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {inviteCodes.length === 0 ? (
                    <p className="text-center py-6 text-sm text-slate-400">생성된 코드가 없습니다.</p>
                  ) : inviteCodes.map(c => (
                    <div key={c.code} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${c.used ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <code className={`text-sm font-mono font-bold ${c.used ? 'text-slate-400' : 'text-slate-700'}`}>{c.code}</code>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${c.role === 'student' ? 'bg-brand-50 text-brand-600' : 'bg-blue-50 text-blue-600'}`}>
                          {c.role === 'student' ? '수강생' : '선생님'}
                        </span>
                        {c.used && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-bold shrink-0">사용됨</span>}
                      </div>
                      {!c.used && (
                        <button
                          onClick={() => handleCopyCode(c.code)}
                          className="text-xs text-brand-500 font-bold hover:text-brand-700 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >복사</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
