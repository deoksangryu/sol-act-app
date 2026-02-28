
import React, { useState, useEffect } from 'react';
import { User, UserRole, ViewState, Assignment, DietLog, Lesson, CompetitionEvent, Subject, SUBJECT_LABELS } from '../types';

interface DashboardProps {
  user: User;
  onChangeView: (view: ViewState) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onChangeView }) => {
  const isStudent = user.role === UserRole.STUDENT;

  const [stats, setStats] = useState({ pendingAssignments: 0, todayCalories: 0, todayLessons: 0 });
  const [todayLessonList, setTodayLessonList] = useState<Lesson[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CompetitionEvent[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    // Assignments
    const assignmentsStr = localStorage.getItem('muse_assignments');
    let pending = 0;
    if (assignmentsStr) {
       const assignments: Assignment[] = JSON.parse(assignmentsStr);
       pending = assignments.filter(a => a.status === 'pending').length;
    } else {
       pending = 1;
    }

    // Diet
    const dietStr = localStorage.getItem('muse_diet');
    let cals = 0;
    if (dietStr) {
       const diet: DietLog[] = JSON.parse(dietStr);
       cals = diet
         .filter(d => d.date.startsWith(today))
         .reduce((acc, curr) => acc + (curr.calories || 0), 0);
    } else {
        cals = 450;
    }

    // Lessons
    const lessonsStr = localStorage.getItem('muse_lessons');
    let todayL: Lesson[] = [];
    if (lessonsStr) {
      const allLessons: Lesson[] = JSON.parse(lessonsStr);
      todayL = allLessons.filter(l => l.date === today && l.status !== 'cancelled');
    }
    setTodayLessonList(todayL);

    // Events
    const eventsStr = localStorage.getItem('muse_events');
    let upcoming: CompetitionEvent[] = [];
    if (eventsStr) {
      const allEvents: CompetitionEvent[] = JSON.parse(eventsStr);
      upcoming = allEvents.filter(e => e.status === 'upcoming' || e.status === 'ongoing').slice(0, 3);
    }
    setUpcomingEvents(upcoming);

    setStats({ pendingAssignments: pending, todayCalories: cals, todayLessons: todayL.length });
  }, []);

  // D-day calculation for nearest event
  const nearestEvent = upcomingEvents[0];
  const dDay = nearestEvent ? Math.max(0, Math.ceil((new Date(nearestEvent.date).getTime() - Date.now()) / 86400000)) : null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            반가워요, <span className="text-orange-500">{user.name}</span>님!
          </h1>
          <p className="text-slate-500 mt-1">오늘도 멋진 연기를 보여주세요.</p>
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
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">진행 중인 과제</h3>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.pendingAssignments} <span className="text-xs font-normal text-slate-400">개</span></p>
        </div>

        <div onClick={() => onChangeView('diet')} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-shadow group">
          <div className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">오늘의 식단</h3>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.todayCalories.toLocaleString()} <span className="text-xs font-normal text-slate-400">kcal</span></p>
        </div>

        {/* D-DAY Card */}
        <div onClick={() => onChangeView('growth')} className="bg-gradient-to-br from-orange-400 to-pink-500 p-5 rounded-2xl shadow-md text-white flex flex-col justify-between relative overflow-hidden cursor-pointer">
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

      {/* Main Feature Area */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's Lessons */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-slate-800">오늘의 수업</h3>
            <button onClick={() => onChangeView('lessons')} className="text-xs font-bold text-orange-500 hover:underline py-2 px-2">전체 보기</button>
          </div>
          <div className="space-y-3">
            {todayLessonList.length > 0 ? todayLessonList.map(l => (
              <div key={l.id} onClick={() => onChangeView('lessons')} className="flex gap-4 items-center p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-slate-50">
                <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-xs ${
                  l.status === 'completed' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'
                }`}>
                  {l.startTime}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-700 text-sm truncate">{l.className}</h4>
                  <p className="text-xs text-slate-400">{l.location} • {l.isPrivate ? '(개인) ' : ''}{SUBJECT_LABELS[l.subject]}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  l.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                }`}>
                  {l.status === 'completed' ? '완료' : '예정'}
                </span>
              </div>
            )) : (
              <div className="text-center py-6 text-slate-400 text-sm">
                오늘 예정된 수업이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-slate-800">다가오는 대회·행사</h3>
            <button onClick={() => onChangeView('growth')} className="text-xs font-bold text-orange-500 hover:underline py-2 px-2">더보기</button>
          </div>
          <div className="space-y-3">
            {upcomingEvents.length > 0 ? upcomingEvents.map(ev => {
              const evDDay = Math.max(0, Math.ceil((new Date(ev.date).getTime() - Date.now()) / 86400000));
              const done = ev.checklist.filter(c => c.completed).length;
              const total = ev.checklist.length;
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
              <div className="text-center py-6 text-slate-400 text-sm">
                등록된 대회/행사가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
