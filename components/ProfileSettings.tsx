
import React, { useState, useRef, useEffect } from 'react';
import { User, UserRole } from '../types';
import { userApi, uploadApi, resolveFileUrl, registerPushSubscription } from '../services/api';
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

  // Push notification
  const [pushStatus, setPushStatus] = useState<'loading' | 'unsupported' | 'denied' | 'granted' | 'prompt'>('loading');

  // PWA install
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    setPushStatus(Notification.permission as 'denied' | 'granted' | 'prompt');
  }, []);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    const ua = navigator.userAgent;
    setIsIOS(/iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
  };

  const handleEnablePush = async () => {
    try {
      await registerPushSubscription(true);
      const newStatus = Notification.permission as 'denied' | 'granted' | 'prompt';
      setPushStatus(newStatus);
      if (newStatus === 'granted') {
        toast.success('푸시 알림이 활성화되었습니다.');
      } else if (newStatus === 'denied') {
        toast.error('알림 권한이 차단되었습니다. 브라우저 설정에서 허용해주세요.');
      }
    } catch {
      toast.error('알림 설정에 실패했습니다.');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadApi.upload(file, undefined, 'avatars');
      const updated = await userApi.update(user.id, { avatar: result.url });
      onUserUpdate({ ...user, avatar: updated.avatar || result.url });
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

      {/* Push Notification Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="font-bold text-slate-700 mb-4">푸시 알림</h2>
        {pushStatus === 'loading' ? (
          <p className="text-sm text-slate-400">확인 중...</p>
        ) : pushStatus === 'unsupported' ? (
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-600 font-medium">이 브라우저에서는 푸시 알림을 지원하지 않습니다.</p>
            <p className="text-xs text-slate-400 mt-1">iOS: 홈 화면에 앱을 추가한 후 이용할 수 있습니다.</p>
          </div>
        ) : pushStatus === 'granted' ? (
          <div className="flex items-center gap-3 bg-green-50 rounded-xl p-4">
            <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <p className="text-sm text-green-700 font-medium">푸시 알림이 활성화되어 있습니다.</p>
          </div>
        ) : pushStatus === 'denied' ? (
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-sm text-red-700 font-medium">알림이 차단되어 있습니다.</p>
            <p className="text-xs text-slate-500 mt-1">브라우저 설정 &gt; 사이트 설정 &gt; 알림에서 허용으로 변경해주세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">앱을 사용하지 않을 때에도 새 알림을 받을 수 있습니다.</p>
            <button
              onClick={handleEnablePush}
              className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200"
            >
              푸시 알림 켜기
            </button>
          </div>
        )}
      </div>

      {/* App Install Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="font-bold text-slate-700 mb-4">앱 설치</h2>
        {isStandalone ? (
          <div className="flex items-center gap-3 bg-green-50 rounded-xl p-4">
            <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <p className="text-sm text-green-700 font-medium">앱이 설치되어 있습니다.</p>
          </div>
        ) : deferredPrompt ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">홈 화면에 앱을 추가하면 더 빠르게 실행할 수 있습니다.</p>
            <button
              onClick={handleInstallApp}
              className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200"
            >
              홈 화면에 추가
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">아래 단계를 따라 홈 화면에 앱을 추가하세요.</p>
            <ol className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <span className="bg-brand-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>하단의 <span className="font-bold">공유 버튼</span>을 탭하세요.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <span className="bg-brand-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span><span className="font-bold">홈 화면에 추가</span>를 탭하세요.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700">
                <span className="bg-brand-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>오른쪽 상단의 <span className="font-bold">추가</span>를 탭하세요.</span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-600">브라우저 메뉴에서 <span className="font-bold">홈 화면에 추가</span> 또는 <span className="font-bold">앱 설치</span>를 선택하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};
