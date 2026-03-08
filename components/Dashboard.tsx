
import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, ViewState, Assignment, DietLog, Lesson, CompetitionEvent, Subject, SUBJECT_LABELS } from '../types';
import { assignmentApi, dietApi, lessonApi, auditionApi, journalApi, portfolioApi, userApi } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import toast from 'react-hot-toast';
import { EmptyState } from './EmptyState';
import { formatRelativeKo } from '../services/dateUtils';

function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface DashboardProps {
  user: User;
  onChangeView: (view: ViewState) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onChangeView }) => {
  const isStudent = user.role === UserRole.STUDENT;

  const [stats, setStats] = useState({ pendingAssignments: 0, todayCalories: 0, todayLessons: 0 });
  const [todayLessonList, setTodayLessonList] = useState<Lesson[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CompetitionEvent[]>([]);
  const [directorStats, setDirectorStats] = useState({ totalStudents: 0, totalTeachers: 0, todayAllLessons: 0, pendingSubmissions: 0 });
  const [recentActivity, setRecentActivity] = useState<{ type: string; text: string; time: string }[]>([]);

  const loadData = useCallback(async () => {
    const today = toLocalDateStr(new Date());
    try {
      const [assignmentsData, dietData, lessonsData, eventsData] = await Promise.all([
        assignmentApi.list({ status: 'pending' }).catch(() => []),
        dietApi.list({ date: today }).catch(() => []),
        lessonApi.list({ dateFrom: today, dateTo: today }).catch(() => []),
        auditionApi.list({ status: 'upcoming' }).catch(() => []),
      ]);
      const pending = Array.isArray(assignmentsData) ? assignmentsData.length : 0;
      const dietArr = Array.isArray(dietData) ? dietData as DietLog[] : [];
      const cals = dietArr.reduce((acc, curr) => acc + (curr.calories || 0), 0);
      const lessonsArr = Array.isArray(lessonsData) ? lessonsData : [];
      const todayL = lessonsArr.filter((l: any) => l.status !== 'cancelled');
      setTodayLessonList(todayL);
      const eventsArr = Array.isArray(eventsData) ? eventsData : [];
      setUpcomingEvents(eventsArr.slice(0, 3));
      setStats({ pendingAssignments: pending, todayCalories: cals, todayLessons: todayL.length });

      // Director-specific data loading
      if (user.role === UserRole.DIRECTOR) {
        const [usersData, journalsData, portfoliosData] = await Promise.all([
          userApi.list().catch(() => []),
          journalApi.list().catch(() => []),
          portfolioApi.list().catch(() => []),
        ]);

        // Calculate stats
        const students = (Array.isArray(usersData) ? usersData : []).filter((u: any) => u.role === 'student');
        const teachers = (Array.isArray(usersData) ? usersData : []).filter((u: any) => u.role === 'teacher');
        setDirectorStats({
          totalStudents: students.length,
          totalTeachers: teachers.length,
          todayAllLessons: lessonsArr.length,
          pendingSubmissions: pending,
        });

        // Build activity feed from recent data
        const activities: { type: string; text: string; time: string }[] = [];

        // From assignments (submitted ones)
        const assignmentsArr = Array.isArray(assignmentsData) ? assignmentsData : [];
        assignmentsArr.filter((a: any) => a.status === 'submitted').forEach((a: any) => {
          activities.push({
            type: 'assignment',
            text: `${a.studentName}님이 과제 "${a.title}"을 제출했습니다.`,
            time: a.updatedAt || a.createdAt,
          });
        });

        // From journals
        const journalsArr = Array.isArray(journalsData) ? journalsData : [];
        journalsArr.slice(0, 10).forEach((j: any) => {
          activities.push({
            type: 'journal',
            text: `${j.authorName}님이 수업일지를 작성했습니다.`,
            time: j.createdAt,
          });
        });

        // From portfolios
        const portfoliosArr = Array.isArray(portfoliosData) ? portfoliosData : [];
        portfoliosArr.slice(0, 5).forEach((p: any) => {
          activities.push({
            type: 'portfolio',
            text: `${p.studentName}님이 포트폴리오 "${p.title}"을 등록했습니다.`,
            time: p.date,
          });
        });

        // Sort by time, take recent 15
        activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setRecentActivity(activities.slice(0, 15));
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      toast.error('데이터를 불러오지 못했습니다. 새로고침해주세요.');
    }
  }, [user.role]);

  useEffect(() => { loadData(); }, [loadData]);

  useDataRefresh(['assignments', 'lessons', 'auditions', 'diet'], loadData);

  // D-day calculation for nearest event
  const nearestEvent = upcomingEvents[0];
  const dDay = nearestEvent ? Math.max(0, Math.ceil((new Date(nearestEvent.date).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            반가워요, <span className="text-brand-500">{user.name}</span>님!
          </h1>
          <p className="text-slate-500 mt-1">{isStudent ? '오늘도 멋진 연기를 보여주세요.' : '오늘도 좋은 하루 되세요.'}</p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-sm font-semibold text-slate-600">{new Date().toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
        </div>
      </div>

      {/* Quick Actions / Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div onClick={() => onChangeView('lessons')} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-shadow group">
          <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">오늘 수업</h3>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.todayLessons} <span className="text-xs font-normal text-slate-400">개</span></p>
        </div>

        <div onClick={() => onChangeView('assignments')} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-shadow group">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{isStudent ? '진행 중인 과제' : '미완료 과제'}</h3>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.pendingAssignments} <span className="text-xs font-normal text-slate-400">개</span></p>
        </div>

        {isStudent ? (
          <div onClick={() => onChangeView('diet')} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-shadow group">
            <div className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">오늘의 식단</h3>
            <p className="text-2xl font-bold text-slate-800 mt-1">{stats.todayCalories.toLocaleString()} <span className="text-xs font-normal text-slate-400">kcal</span></p>
          </div>
        ) : (
          <div onClick={() => onChangeView('growth')} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-shadow group">
            <div className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">성장 관리</h3>
            <p className="text-2xl font-bold text-slate-800 mt-1">{upcomingEvents.length} <span className="text-xs font-normal text-slate-400">건 일정</span></p>
          </div>
        )}

        {/* D-DAY Card */}
        <div onClick={() => onChangeView('growth')} className="bg-gradient-to-br from-brand-400 to-pink-500 p-5 rounded-2xl shadow-md text-white flex flex-col justify-between relative overflow-hidden cursor-pointer">
          <div className="relative z-10">
            <h3 className="text-white/80 text-xs font-bold uppercase tracking-wider">D-DAY</h3>
            {dDay !== null ? (
              <>
                <p className="text-2xl font-bold mt-1">D-{dDay}</p>
                <p className="text-xs mt-2 text-white/90 line-clamp-1">{nearestEvent?.title}</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold mt-1">-</p>
                <p className="text-xs mt-2 text-white/90">등록된 일정 없음</p>
              </>
            )}
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-20">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
        </div>
      </div>

      {/* Student Quick Actions */}
      {isStudent && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onChangeView('growth')}
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group text-left flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">연습영상 올리기</h3>
              <p className="text-xs text-slate-400 mt-0.5">나의 연습 기록을 남겨보세요</p>
            </div>
          </button>
          <button
            onClick={() => onChangeView('lessons')}
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group text-left flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">연습일지 쓰기</h3>
              <p className="text-xs text-slate-400 mt-0.5">오늘 연습을 기록해보세요</p>
            </div>
          </button>
        </div>
      )}

      {/* Main Feature Area */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's Lessons */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-slate-800">오늘의 수업</h3>
            <button onClick={() => onChangeView('lessons')} className="text-xs font-bold text-brand-500 hover:underline py-2 px-2">전체 보기</button>
          </div>
          <div className="space-y-3">
            {todayLessonList.length > 0 ? todayLessonList.map(l => (
              <div key={l.id} onClick={() => onChangeView('lessons')} className="flex gap-4 items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-slate-50">
                <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-xs ${
                  l.status === 'completed' ? 'bg-green-50 text-green-500' : 'bg-brand-50 text-brand-500'
                }`}>
                  {l.startTime}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-700 text-sm truncate">{l.className}</h4>
                  <p className="text-xs text-slate-400">{l.location} • {l.isPrivate ? '(개인) ' : ''}{SUBJECT_LABELS[l.subject]}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  l.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-brand-100 text-brand-600'
                }`}>
                  {l.status === 'completed' ? '완료' : '예정'}
                </span>
              </div>
            )) : (
              <EmptyState icon="calendar" title="오늘은 쉬는 날이에요" description="예정된 수업이 없습니다." />
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-slate-800">다가오는 대회·행사</h3>
            <button onClick={() => onChangeView('growth')} className="text-xs font-bold text-brand-500 hover:underline py-2 px-2">더보기</button>
          </div>
          <div className="space-y-3">
            {upcomingEvents.length > 0 ? upcomingEvents.map(ev => {
              const evDDay = Math.max(0, Math.ceil((new Date(ev.date).getTime() - Date.now()) / 86400000));
              const done = (ev.checklist || []).filter(c => c.completed).length;
              const total = (ev.checklist || []).length;
              return (
                <div key={ev.id} onClick={() => onChangeView('growth')} className="flex gap-4 items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-slate-50">
                  <div className="w-12 h-12 rounded-xl bg-pink-50 flex-shrink-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-pink-500">D-{evDDay}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-700 text-sm truncate">{ev.title}</h4>
                    <p className="text-xs text-slate-400">{ev.date} • {ev.location}</p>
                  </div>
                  {total > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">{done}/{total}</span>
                  )}
                </div>
              );
            }) : (
              <EmptyState icon="calendar" title="다가오는 일정이 없어요" description="새 대회나 행사가 등록되면 여기에 표시됩니다." />
            )}
          </div>
        </div>
      </div>

      {/* Director Overview Section */}
      {user.role === UserRole.DIRECTOR && (
        <>
          {/* Director Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-slate-500 text-xs font-bold uppercase">전체 학생</h3>
              <p className="text-2xl font-bold text-slate-800 mt-1">{directorStats.totalStudents}명</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-slate-500 text-xs font-bold uppercase">전체 선생님</h3>
              <p className="text-2xl font-bold text-slate-800 mt-1">{directorStats.totalTeachers}명</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-slate-500 text-xs font-bold uppercase">오늘 전체 수업</h3>
              <p className="text-2xl font-bold text-slate-800 mt-1">{directorStats.todayAllLessons}개</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-slate-500 text-xs font-bold uppercase">미제출 과제</h3>
              <p className="text-2xl font-bold text-slate-800 mt-1">{directorStats.pendingSubmissions}건</p>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <h3 className="font-bold text-lg text-slate-800 mb-4">최근 활동</h3>
            <div className="space-y-3">
              {recentActivity.length > 0 ? recentActivity.map((act, i) => (
                <div key={i} className="flex gap-3 items-start p-3 rounded-xl border border-slate-50 hover:bg-slate-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    act.type === 'assignment' ? 'bg-blue-50 text-blue-500' :
                    act.type === 'journal' ? 'bg-purple-50 text-purple-500' :
                    'bg-brand-50 text-brand-500'
                  }`}>
                    {act.type === 'assignment' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    )}
                    {act.type === 'journal' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17.25c0 5.25 3.07 9.75 7.022 11.278.338.106.671.203 1.005.279m0-13c5.5 0 10-4.745 10-11.25 0-5.25-3.07-9.75-7.022-11.278A15.02 15.02 0 0012 6.253z" /></svg>
                    )}
                    {act.type === 'portfolio' && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{act.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatRelativeKo(act.time)}</p>
                  </div>
                </div>
              )) : (
                <EmptyState icon="notification" title="최근 활동이 없습니다" />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
