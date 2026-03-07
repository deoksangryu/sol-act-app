
import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, ViewState, ClassInfo, Notification } from './types';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { Dashboard } from './components/Dashboard';
import { Assignments } from './components/Assignments';
import { Diet } from './components/Diet';
import { Lessons } from './components/Lessons';
import { Growth } from './components/Growth';
import { Community } from './components/Community';
import { AcademyManagement } from './components/AcademyManagement';
import { ProfileSettings } from './components/ProfileSettings';
import { Notifications } from './components/Notifications';
import { InstallPrompt } from './components/InstallPrompt';
import { Toaster } from 'react-hot-toast';
import { getSavedUser, clearAuth, userApi, classApi, notificationApi, resolveFileUrl, registerPushSubscription, unregisterPushSubscription } from './services/api';
import { useWebSocketConnection, useNotificationWebSocket, useDataRefresh } from './services/useWebSocket';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
      // Load each independently so one failure doesn't block the others
      const [usersData, classesData, notifsData] = await Promise.all([
        userApi.list().catch((err) => { console.error('Failed to load users:', err); return [] as User[]; }),
        classApi.list().catch((err) => { console.error('Failed to load classes:', err); return [] as ClassInfo[]; }),
        notificationApi.list().catch(() => [] as Notification[]),
      ]);
      setAllUsers(usersData);
      setClasses(classesData);
      setNotifications(notifsData);
      // Register Web Push subscription (non-blocking)
      registerPushSubscription();
    } catch (err) {
      console.error('Failed to load app data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView('dashboard');
    setLoading(true);
    loadAppData(loggedInUser);
  };

  const handleLogout = () => {
    unregisterPushSubscription();
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
    // Redirect students away from staff-only views
    if (currentView === 'academy' && user!.role === UserRole.STUDENT) {
      setCurrentView('dashboard');
      return null;
    }
    switch (currentView) {
      case 'dashboard':
        return <Dashboard user={user!} onChangeView={setCurrentView} />;
      case 'lessons':
        return <Lessons user={user!} classes={classes} allUsers={allUsers} />;
      case 'assignments':
        return <Assignments user={user!} allUsers={allUsers} classes={classes} />;
      case 'growth':
        return <Growth user={user!} allUsers={allUsers} classes={classes} />;
      case 'diet':
        return <Diet user={user!} />;
      case 'community':
        return (
          <Community
            user={user!}
            classes={classes}
            setClasses={setClasses}
            allUsers={allUsers}
          />
        );
      case 'academy':
        return (
          <AcademyManagement
            user={user!}
            classes={classes}
            setClasses={setClasses}
            allUsers={allUsers}
          />
        );
      case 'profile':
        return <ProfileSettings user={user!} onUserUpdate={(u) => setUser(u)} />;
      default:
        return <Dashboard user={user!} onChangeView={setCurrentView} />;
    }
  };

  // Show loading while checking saved token
  if (loading && !user) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-yellow-400 mb-3 tracking-tighter">SOL-ACT</h1>
          <div className="w-6 h-6 border-2 border-slate-300 border-t-yellow-400 rounded-full animate-spin mx-auto"></div>
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

  // Define views that need full height (App-like behavior) vs scrolling views (Page-like behavior)
  const isAppView = ['assignments', 'diet', 'lessons', 'community', 'academy'].includes(currentView);

  return (
    <div className="flex h-[100dvh] bg-slate-50 text-slate-800 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shadow-sm z-20">
        <Sidebar
          currentView={currentView}
          onChangeView={setCurrentView}
          user={user}
          onLogout={handleLogout}
        />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden min-h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-yellow-400 tracking-tighter">SOL-ACT</span>
          </div>
          <div className="flex items-center gap-3">
             {/* Notification Bell (Mobile) */}
             <div className="relative">
                <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2.5 text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="알림">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                </button>
                {isNotifOpen && <Notifications notifications={notifications} onClose={() => setIsNotifOpen(false)} onMarkAllRead={handleMarkAllRead} />}
             </div>

             <div className="text-right">
                <p className="text-xs font-bold text-slate-700">{user.name}</p>
                <p className="text-[10px] text-slate-400">{getRoleLabel(user.role)}</p>
             </div>
             <img src={resolveFileUrl(user.avatar)} alt="Profile" className="w-8 h-8 rounded-full border border-slate-100 cursor-pointer hover:ring-2 hover:ring-brand-300" onClick={() => setCurrentView('profile')} />
             <button
               onClick={handleLogout}
               className="ml-1 p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
               aria-label="로그아웃"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
          </div>
        </header>

        {/* Desktop notification bell */}
        <div className="hidden md:block absolute top-6 right-8 z-30">
           <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="bg-white p-2.5 rounded-full shadow-sm border border-slate-100 text-slate-400 hover:text-brand-500 hover:shadow-md transition-all relative"
                aria-label="알림"
              >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                 {unreadCount > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
              </button>
              {isNotifOpen && <Notifications notifications={notifications} onClose={() => setIsNotifOpen(false)} onMarkAllRead={handleMarkAllRead} />}
           </div>
        </div>

        <div className={`flex-1 flex flex-col ${isAppView ? 'overflow-hidden pb-20 md:pb-8' : 'overflow-y-auto pb-48 md:pb-8'} p-4 md:p-8 scroll-smooth`}>
          <div className={`max-w-5xl mx-auto w-full flex-1 flex flex-col ${isAppView ? 'h-full min-h-0' : ''}`}>
            {renderView()}
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
           <MobileNav currentView={currentView} onChangeView={setCurrentView} userRole={user.role} />
        </nav>
      </main>

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Global Toast Container */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#334155',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#F97316',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
};

export default App;
