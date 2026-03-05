
import React, { useState, useRef } from 'react';
import { User, UserRole } from '../types';
import { userApi, getToken, resolveFileUrl } from '../services/api';
import toast from 'react-hot-toast';

interface ProfileSettingsProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

const ROLE_LABELS: Record<string, string> = {
  student: '수강생',
  teacher: '선생님',
  director: '원장님',
};

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, onUserUpdate }) => {
  // Profile edit
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const res = await fetch(`${API_URL}/api/upload?subfolder=avatars`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const result = await res.json();
      const avatarUrl = result.url; // store relative path, resolve to full URL at display time
      const updated = await userApi.update(user.id, { avatar: avatarUrl });
      onUserUpdate({ ...user, avatar: updated.avatar || avatarUrl });
      toast.success('프로필 사진이 변경되었습니다.');
    } catch { toast.error('사진 업로드에 실패했습니다.'); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error('이름을 입력해주세요.'); return; }
    setIsSaving(true);
    try {
      const updated = await userApi.update(user.id, { name: name.trim(), email: email.trim() });
      onUserUpdate({ ...user, name: updated.name, email: updated.email });
      toast.success('프로필이 저장되었습니다.');
    } catch { toast.error('프로필 저장에 실패했습니다.'); }
    finally { setIsSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) { toast.error('비밀번호를 입력해주세요.'); return; }
    if (newPassword.length < 8) { toast.error('새 비밀번호는 8자 이상이어야 합니다.'); return; }
    if (!/[A-Za-z]/.test(newPassword)) { toast.error('비밀번호에 영문자가 포함되어야 합니다.'); return; }
    if (!/\d/.test(newPassword)) { toast.error('비밀번호에 숫자가 포함되어야 합니다.'); return; }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) { toast.error('비밀번호에 특수문자가 포함되어야 합니다.'); return; }
    if (newPassword !== confirmPassword) { toast.error('새 비밀번호가 일치하지 않습니다.'); return; }
    setIsChangingPw(true);
    try {
      await userApi.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('비밀번호가 변경되었습니다.');
    } catch (err: any) {
      const msg = err?.message || '비밀번호 변경에 실패했습니다.';
      toast.error(msg);
    }
    finally { setIsChangingPw(false); }
  };

  const hasProfileChanges = name !== user.name || email !== user.email;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in-up">
      <h1 className="text-2xl font-bold text-slate-800">프로필 설정</h1>

      {/* Avatar Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="font-bold text-slate-700 mb-4">프로필 사진</h2>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <img
              src={resolveFileUrl(user.avatar)}
              alt={user.name}
              className="w-24 h-24 rounded-full object-cover border-2 border-slate-200"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {isUploading ? (
                <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              )}
            </button>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
          </div>
          <div>
            <p className="font-bold text-slate-800">{user.name}</p>
            <p className="text-sm text-slate-400">{ROLE_LABELS[user.role] || user.role}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="mt-2 text-xs font-bold text-brand-500 hover:text-brand-600"
            >
              {isUploading ? '업로드 중...' : '사진 변경'}
            </button>
          </div>
        </div>
      </div>

      {/* Profile Info Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="font-bold text-slate-700 mb-4">기본 정보</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">이름</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">역할</label>
            <input
              value={ROLE_LABELS[user.role] || user.role}
              disabled
              className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 cursor-not-allowed"
            />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={!hasProfileChanges || isSaving}
            className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '저장 중...' : '프로필 저장'}
          </button>
        </div>
      </div>

      {/* Password Change Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="font-bold text-slate-700 mb-4">비밀번호 변경</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">현재 비밀번호</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
              placeholder="8자 이상, 영문+숫자+특수문자"
              autoComplete="new-password"
            />
            {newPassword && (
              <div className="mt-2 space-y-0.5">
                <p className={`text-[10px] ${newPassword.length >= 8 ? 'text-green-500' : 'text-slate-400'}`}>
                  {newPassword.length >= 8 ? '\u2713' : '\u2022'} 8자 이상
                </p>
                <p className={`text-[10px] ${/[A-Za-z]/.test(newPassword) ? 'text-green-500' : 'text-slate-400'}`}>
                  {/[A-Za-z]/.test(newPassword) ? '\u2713' : '\u2022'} 영문자 포함
                </p>
                <p className={`text-[10px] ${/\d/.test(newPassword) ? 'text-green-500' : 'text-slate-400'}`}>
                  {/\d/.test(newPassword) ? '\u2713' : '\u2022'} 숫자 포함
                </p>
                <p className={`text-[10px] ${/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? 'text-green-500' : 'text-slate-400'}`}>
                  {/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? '\u2713' : '\u2022'} 특수문자 포함
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
              autoComplete="new-password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>
          <button
            onClick={handleChangePassword}
            disabled={!currentPassword || !newPassword || newPassword !== confirmPassword || isChangingPw}
            className="w-full bg-slate-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChangingPw ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
      </div>
    </div>
  );
};
