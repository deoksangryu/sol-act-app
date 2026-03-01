
import React, { useState, useEffect } from 'react';
import { User, UserRole, ViewState, ClassInfo, ChatMessage, Notification, Subject } from './types';
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
import { Notifications } from './components/Notifications';
import { InstallPrompt } from './components/InstallPrompt';
import { Toaster } from 'react-hot-toast';

// Mock Users
const MOCK_STUDENT: User = {
  id: 's1',
  name: '김배우',
  role: UserRole.STUDENT,
  avatar: 'https://picsum.photos/200',
  email: 'actor@muse.com'
};

const MOCK_TEACHER: User = {
  id: 't1',
  name: '박선생',
  role: UserRole.TEACHER,
  avatar: 'https://picsum.photos/201',
  email: 'teacher@muse.com'
};

const MOCK_DIRECTOR: User = {
  id: 'd1',
  name: '최원장',
  role: UserRole.DIRECTOR,
  avatar: 'https://picsum.photos/206',
  email: 'director@muse.com'
};

// Global Mock Data for Users List (used in Classes component)
export const ALL_USERS: User[] = [
  MOCK_STUDENT,
  MOCK_TEACHER,
  MOCK_DIRECTOR,
  { id: 's2', name: '이연기', role: UserRole.STUDENT, avatar: 'https://picsum.photos/202', email: 'lee@muse.com' },
  { id: 's3', name: '최무대', role: UserRole.STUDENT, avatar: 'https://picsum.photos/203', email: 'choi@muse.com' },
  { id: 's4', name: '박감정', role: UserRole.STUDENT, avatar: 'https://picsum.photos/204', email: 'park@muse.com' },
  { id: 't2', name: '김무용', role: UserRole.TEACHER, avatar: 'https://picsum.photos/205', email: 'dance@muse.com' },
];

const MOCK_CLASSES: ClassInfo[] = [
  {
    id: 'c1',
    name: '입시 A반',
    description: '한예종/중앙대 목표 입시반입니다.',
    subjectTeachers: {
      [Subject.ACTING]: 't1',
      [Subject.MUSICAL]: 't1',
      [Subject.DANCE]: 't2',
    },
    studentIds: ['s1', 's2'],
    schedule: '월/수/금 18:00'
  },
  {
    id: 'c2',
    name: '입시 B반',
    description: '경희대/동국대 목표 입시반입니다.',
    subjectTeachers: {
      [Subject.ACTING]: 't1',
      [Subject.DANCE]: 't2',
    },
    studentIds: ['s3', 's4'],
    schedule: '화/목 17:00'
  },
  {
    id: 'c3',
    name: '기초반',
    description: '연기 기초 과정 (취미/입문)',
    subjectTeachers: {
      [Subject.ACTING]: 't1',
      [Subject.MUSICAL]: 't2',
    },
    studentIds: ['s1', 's3', 's4'],
    schedule: '토 14:00'
  }
];

const MOCK_CHATS: ChatMessage[] = [
  {
    id: 'm1',
    classId: 'c1',
    senderId: 't1',
    senderName: '박선생',
    senderRole: UserRole.TEACHER,
    content: 'A반 여러분, 오늘 수업 10분 늦게 시작합니다. 강의실 302호로 오세요!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    avatar: MOCK_TEACHER.avatar
  },
  {
    id: 'm2',
    classId: 'c1',
    senderId: 's1',
    senderName: '김배우',
    senderRole: UserRole.STUDENT,
    content: '네 알겠습니다 선생님!',
    timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    avatar: MOCK_STUDENT.avatar
  }
];

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'info', message: '새로운 공지사항이 등록되었습니다: 10월 모의평가 안내', date: new Date().toISOString(), read: false },
  { id: 'n2', type: 'success', message: '과제 "독백 분석" 채점이 완료되었습니다.', date: new Date(Date.now() - 86400000).toISOString(), read: true },
];

const App: React.FC = () => {
  // Data version reset — clear old-format data on first load
  if (localStorage.getItem('muse_data_version') !== '2') {
    ['muse_classes', 'muse_lessons', 'muse_journals', 'muse_attendance', 'muse_evaluations', 'muse_private_requests'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('muse_data_version', '2');
  }

  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');

  // Shared State with LocalStorage Persistence
  const [classes, setClasses] = useState<ClassInfo[]>(() => {
    const saved = localStorage.getItem('muse_classes');
    return saved ? JSON.parse(saved) : MOCK_CLASSES;
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('muse_chats');
    return saved ? JSON.parse(saved) : MOCK_CHATS;
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('muse_notifications');
    return saved ? JSON.parse(saved) : MOCK_NOTIFICATIONS;
  });
  
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('muse_classes', JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem('muse_chats', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('muse_notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Simple simulated login
  const handleLogin = (role: UserRole) => {
    if (role === UserRole.STUDENT) setUser(MOCK_STUDENT);
    else if (role === UserRole.TEACHER) setUser(MOCK_TEACHER);
    else if (role === UserRole.DIRECTOR) setUser(MOCK_DIRECTOR);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
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
      case 'dashboard':
        return <Dashboard user={user!} onChangeView={setCurrentView} />;
      case 'lessons':
        return <Lessons user={user!} classes={classes} allUsers={ALL_USERS} />;
      case 'assignments':
        return <Assignments user={user!} />;
      case 'growth':
        return <Growth user={user!} allUsers={ALL_USERS} classes={classes} />;
      case 'diet':
        return <Diet user={user!} />;
      case 'community':
        return (
          <Community
            user={user!}
            classes={classes}
            chatMessages={chatMessages}
            onSendMessage={(msg) => setChatMessages([...chatMessages, msg])}
            setClasses={setClasses}
            allUsers={ALL_USERS}
          />
        );
      case 'academy':
        return (
          <AcademyManagement
            user={user!}
            classes={classes}
            setClasses={setClasses}
            allUsers={ALL_USERS}
          />
        );
      default:
        return <Dashboard user={user!} onChangeView={setCurrentView} />;
    }
  };

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
            <span className="text-xl font-bold text-orange-500 tracking-tighter">MUSE</span>
            <span className="text-xs font-medium text-slate-400">Academy</span>
          </div>
          <div className="flex items-center gap-3">
             {/* Notification Bell (Mobile) */}
             <div className="relative">
                <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2.5 text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                </button>
                {isNotifOpen && <Notifications notifications={notifications} onClose={() => setIsNotifOpen(false)} onMarkAllRead={handleMarkAllRead} />}
             </div>
             
             <div className="text-right">
                <p className="text-xs font-bold text-slate-700">{user.name}</p>
                <p className="text-[10px] text-slate-400">{getRoleLabel(user.role)}</p>
             </div>
             <img src={user.avatar} alt="Profile" className="w-8 h-8 rounded-full border border-slate-100" />
             <button 
               onClick={handleLogout}
               className="ml-1 p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
               aria-label="로그아웃"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
          </div>
        </header>

        {/* Desktop Header / Top Bar (Optional if needed, but sticking to Sidebar for desktop main nav) */}
        {/* Adding a floating notification bell for desktop if not in sidebar */}
        <div className="hidden md:block absolute top-6 right-8 z-30">
           <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="bg-white p-2.5 rounded-full shadow-sm border border-slate-100 text-slate-400 hover:text-orange-500 hover:shadow-md transition-all relative"
              >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                 {unreadCount > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
              </button>
              {isNotifOpen && <Notifications notifications={notifications} onClose={() => setIsNotifOpen(false)} onMarkAllRead={handleMarkAllRead} />}
           </div>
        </div>

        {/* 
          Content Container 
          - App Views (Chat, Diet, etc): Hidden overflow on parent, child handles scroll. Less bottom padding.
          - Page Views (Dashboard): Auto overflow on parent. More bottom padding for scroll space.
        */}
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
              primary: '#F97316', // Orange-500
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
};

export default App;
