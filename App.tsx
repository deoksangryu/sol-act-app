
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { User, UserRole, ViewState, ClassInfo, Notification } from './types';
import { Login } from './components/Login';
import { MobileNav } from './components/MobileNav';
import { Classes } from './components/Classes';
// 첫 진입(classes) 외 탭은 지연 로드 → 초기 번들 ~30KB(gzip) 감소
const Assignments = React.lazy(() => import('./components/Assignments').then(m => ({ default: m.Assignments })));
const Video = React.lazy(() => import('./components/Video').then(m => ({ default: m.Video })));
const Diet = React.lazy(() => import('./components/Diet').then(m => ({ default: m.Diet })));
const Music = React.lazy(() => import('./components/Music').then(m => ({ default: m.Music })));
const ProfileSettings = React.lazy(() => import('./components/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
import { Notifications } from './components/Notifications';
import { Notices } from './components/Notices';
import { Practice } from './components/Practice';
import { InstallPrompt } from './components/InstallPrompt';
import toast, { Toaster } from 'react-hot-toast';
import { UploadProvider, useUpload } from './services/UploadContext';
import { AppDataProvider } from './services/AppContext';
import { UploadIndicator } from './components/UploadIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getSavedUser, clearAuth, userApi, classApi, notificationApi, badgeApi, resolveFileUrl, registerPushSubscription, unregisterPushSubscription } from './services/api';
import { registerNativePush, unregisterNativePush } from './services/nativePush';
import { useWebSocketConnection, useNotificationWebSocket, useDataRefresh } from './services/useWebSocket';

/** Retry a function up to `n` times with exponential backoff */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
  throw new Error('withRetry: unreachable');
}

const AppInner: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('classes');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);
  const [badges, setBadges] = useState<Partial<Record<ViewState, number>>>({});
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { isUploading } = useUpload();

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Session expiry warning (soft handling — shows toast before redirect)
  useEffect(() => {
    const handler = () => {
      toast.error('세션이 만료되었습니다. 3초 후 로그인 화면으로 이동합니다.', { duration: 3000 });
    };
    window.addEventListener('session-expired', handler);
    return () => window.removeEventListener('session-expired', handler);
  }, []);

  // Unified WebSocket connection (single connection for chat + notifications)
  useWebSocketConnection(user?.id ?? null);

  // Real-time notification push via WebSocket
  useNotificationWebSocket((notif) => {
    setNotifications(prev => [notif, ...prev]);
  });

  // Auto-login from saved token
  useEffect(() => {
    const savedUser = getSavedUser();
    if (savedUser) {
      setUser(savedUser);
      loadAppData(savedUser);
    } else {
      setLoading(false);
    }
  }, []);

  // 탭 뱃지(미처리 항목 수) — 로그인 시 1회 + 관련 데이터 변경 시에만 갱신(탭마다 왕복 안 함).
  // 반드시 early-return 위에 위치해야 함(Rules of Hooks).
  const refreshBadges = useCallback(() => { badgeApi.get().then(setBadges).catch(() => {}); }, []);
  useEffect(() => { if (user) refreshBadges(); }, [user, refreshBadges]);
  useDataRefresh(['assignments', 'portfolios', 'diet', 'music'], refreshBadges);

  const loadClasses = useCallback(() => {
    classApi.list().then(setClasses).catch(console.error);
  }, []);

  const loadUsers = useCallback(() => {
    userApi.list().then(setAllUsers).catch(console.error);
  }, []);

  useDataRefresh('classes', loadClasses);
  useDataRefresh('users', loadUsers);

  const loadAppData = async (currentUser: User) => {
    try {
      // Load each independently with retry so transient failures don't leave empty data
      const [usersData, classesData, notifsData] = await Promise.all([
        withRetry(() => userApi.list()).catch((err) => { console.error('Failed to load users:', err); return [] as User[]; }),
        withRetry(() => classApi.list()).catch((err) => { console.error('Failed to load classes:', err); return [] as ClassInfo[]; }),
        withRetry(() => notificationApi.list()).catch(() => [] as Notification[]),
      ]);
      setAllUsers(usersData);
      setClasses(classesData);
      setNotifications(notifsData);
      // 푸시 등록(비차단): 웹푸시(PWA/브라우저) + 네이티브 푸시(FCM/APNs)
      registerPushSubscription();
      registerNativePush();
    } catch (err) {
      console.error('Failed to load app data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('classes');
    setLoading(true);
    loadAppData(loggedInUser);
  };

  const handleLogout = () => {
    if (isUploading) {
      if (!window.confirm('영상을 업로드 중입니다. 로그아웃하면 업로드가 중단됩니다. 계속하시겠습니까?')) {
        return;
      }
    }
    unregisterPushSubscription();
    unregisterNativePush();
    clearAuth();
    setUser(null);
    setAllUsers([]);
    setClasses([]);
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    if (user) {
      try {
        await notificationApi.markAllRead();
        setNotifications(notifications.map(n => ({ ...n, read: true })));
      } catch {
        // Fallback: just update locally
        setNotifications(notifications.map(n => ({ ...n, read: true })));
      }
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.DIRECTOR: return '원장님';
      case UserRole.TEACHER: return '선생님';
      default: return '수강생';
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'classes':
        return <Classes user={user!} />;
      case 'assignments':
        return <Assignments user={user!} />;
      case 'video':
        return <Video user={user!} />;
      case 'diet':
        return <Diet user={user!} />;
      case 'music':
        return <Music user={user!} />;
      case 'profile':
        return <ProfileSettings user={user!} onUserUpdate={(u) => setUser(u)} onBack={() => setCurrentView('classes')} onLogout={handleLogout} />;
      default:
        return <Classes user={user!} />;
    }
  };

  // Show loading while checking saved token
  if (loading && !user) {
    return (
      <div className="min-h-[100dvh] bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold mb-3 tracking-tight" style={{ color: '#3182F6' }}>SOL-ACT</h1>
          <div className="w-6 h-6 border-2 border-slate-200 rounded-full animate-spin mx-auto" style={{ borderTopColor: '#3182F6' }}></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <InstallPrompt />
      </>
    );
  }

  // 하단 5탭을 보여주는 메인 화면 (프로필 등 하위화면은 자체 back 헤더 사용)
  const showNav = ['classes', 'assignments', 'video', 'diet', 'music'].includes(currentView);

  return (
    <AppDataProvider value={{ allUsers, classes, setClasses }}>
    {/* 프로토타입 프레임: 흰 배경 · 상단 벨 · 본문 · 하단 5탭 */}
    <div className="flex flex-col h-[100dvh] bg-white overflow-hidden" style={{ color: '#191F28', fontSize: 14 }}>
      {isOffline && (
        <div className="bg-red-500 text-white text-center py-2 text-sm font-medium shrink-0 z-50">
          인터넷 연결이 끊어졌어요. 연결 상태를 확인해주세요.
        </div>
      )}

      {/* 상단 바 — 벨 + 프로필 (프로토타입 상태바 위치) */}
      <header className="flex items-center justify-end gap-1 px-3 pb-1.5 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
        <button onClick={() => setIsPracticeOpen(true)} className="w-10 h-10 flex items-center justify-center" aria-label="제시대사 연습">
          <i className="ti ti-masks-theater" style={{ fontSize: 20, color: '#191F28' }} />
        </button>
        <button onClick={() => setIsNoticeOpen(true)} className="w-10 h-10 flex items-center justify-center" aria-label="공지사항">
          <i className="ti ti-speakerphone" style={{ fontSize: 20, color: '#191F28' }} />
        </button>
        <div className="relative">
          <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative w-10 h-10 flex items-center justify-center" aria-label="알림">
            <i className="ti ti-bell" style={{ fontSize: 20, color: '#191F28' }} />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: 5, right: 5, background: '#C2410C', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 14, height: 14, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>{unreadCount}</span>
            )}
          </button>
          {isNotifOpen && <Notifications notifications={notifications} onClose={() => setIsNotifOpen(false)} onMarkAllRead={handleMarkAllRead} onNavigate={(v) => { setCurrentView(v); setIsNotifOpen(false); }} />}
        </div>
        <img src={resolveFileUrl(user.avatar)} alt="" className="w-8 h-8 rounded-full object-cover cursor-pointer border border-slate-100" onClick={() => setCurrentView('profile')} />
      </header>

      {/* 본문 (데스크톱에선 폰 폭으로 가운데 정렬) */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="w-full max-w-[480px] mx-auto flex-1 flex flex-col min-h-0 px-1.5">
          <ErrorBoundary key={currentView}>
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-slate-200 rounded-full animate-spin" style={{ borderTopColor: '#3182F6' }} /></div>}>
              {renderView()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* 하단 5탭 (프로토타입) — 메인 탭에서만 노출 */}
      {showNav && (
        <nav className="shrink-0 bg-white" style={{ borderTop: '0.5px solid #EEF0F2', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="w-full max-w-[480px] mx-auto">
            <MobileNav currentView={currentView} onChangeView={setCurrentView} counts={badges} />
          </div>
        </nav>
      )}

      {isNoticeOpen && <Notices user={user} onClose={() => setIsNoticeOpen(false)} />}
      {isPracticeOpen && <Practice user={user} onClose={() => setIsPracticeOpen(false)} />}
      <InstallPrompt />
      <UploadIndicator />
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#191F28', color: '#fff', borderRadius: '14px', fontSize: '14px' },
          success: { iconTheme: { primary: '#3182F6', secondary: '#fff' } },
        }}
      />
    </div>
    </AppDataProvider>
  );
};

const App: React.FC = () => (
  <UploadProvider>
    <AppInner />
  </UploadProvider>
);

export default App;
