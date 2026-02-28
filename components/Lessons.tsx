
import React, { useState, useEffect } from 'react';
import { User, UserRole, Lesson, LessonJournal, AttendanceRecord, ClassInfo, Subject, SUBJECT_LABELS, PrivateLessonRequest } from '../types';
import toast from 'react-hot-toast';

interface LessonsProps {
  user: User;
  classes: ClassInfo[];
  allUsers: User[];
}

const today = new Date().toISOString().split('T')[0];
const dayMs = 86400000;
const dateOffset = (offset: number) => new Date(Date.now() + dayMs * offset).toISOString().split('T')[0];

const MOCK_LESSONS: Lesson[] = [
  // Group lessons
  { id: 'l1', classId: 'c1', className: '입시 A반', date: today, startTime: '18:00', endTime: '20:00', location: '301호', status: 'scheduled', subject: Subject.ACTING, teacherId: 't1', teacherName: '박선생', isPrivate: false },
  { id: 'l2', classId: 'c2', className: '입시 B반', date: today, startTime: '14:00', endTime: '16:00', location: '302호', status: 'scheduled', subject: Subject.ACTING, teacherId: 't1', teacherName: '박선생', isPrivate: false },
  { id: 'l3', classId: 'c1', className: '입시 A반', date: dateOffset(-2), startTime: '18:00', endTime: '20:00', location: '301호', status: 'completed', subject: Subject.ACTING, teacherId: 't1', teacherName: '박선생', isPrivate: false },
  { id: 'l4', classId: 'c1', className: '입시 A반', date: dateOffset(-4), startTime: '18:00', endTime: '20:00', location: '301호', status: 'completed', subject: Subject.MUSICAL, teacherId: 't1', teacherName: '박선생', isPrivate: false },
  { id: 'l5', classId: 'c2', className: '입시 B반', date: dateOffset(-7), startTime: '14:00', endTime: '16:00', location: '302호', status: 'completed', subject: Subject.DANCE, teacherId: 't2', teacherName: '김무용', isPrivate: false },
  { id: 'l6', classId: 'c1', className: '입시 A반', date: dateOffset(2), startTime: '18:00', endTime: '20:00', location: '301호', status: 'scheduled', subject: Subject.DANCE, teacherId: 't2', teacherName: '김무용', isPrivate: false },
  { id: 'l7', classId: 'c3', className: '기초반', date: dateOffset(4), startTime: '14:00', endTime: '16:00', location: '201호', status: 'scheduled', subject: Subject.ACTING, teacherId: 't1', teacherName: '박선생', isPrivate: false },
  { id: 'l8', classId: 'c3', className: '기초반', date: dateOffset(7), startTime: '14:00', endTime: '16:00', location: '201호', status: 'scheduled', subject: Subject.MUSICAL, teacherId: 't2', teacherName: '김무용', isPrivate: false },
  // Private lessons
  { id: 'l9', classId: 'c1', className: '입시 A반', date: dateOffset(1), startTime: '10:00', endTime: '11:00', location: '개인연습실', status: 'scheduled', subject: Subject.ACTING, teacherId: 't1', teacherName: '박선생', isPrivate: true, privateStudentIds: ['s1'], requestId: 'pr1' },
  { id: 'l10', classId: 'c2', className: '입시 B반', date: dateOffset(3), startTime: '11:00', endTime: '12:00', location: '개인연습실', status: 'scheduled', subject: Subject.DANCE, teacherId: 't2', teacherName: '김무용', isPrivate: true, privateStudentIds: ['s3'], requestId: 'pr3' },
];

const MOCK_JOURNALS: LessonJournal[] = [
  { id: 'j1', lessonId: 'l3', authorId: 't1', authorName: '박선생', journalType: 'teacher', content: '즉흥 연기 훈련 진행. 학생들의 순발력이 향상되고 있음. 감정 전환 연습에서 김배우 학생이 큰 발전을 보임.', objectives: '감정 전환 및 즉흥 반응 훈련', nextPlan: '다음 수업에서 2인 장면 연기 시작 예정', date: new Date(Date.now() - dayMs * 2).toISOString() },
  { id: 'j2', lessonId: 'l3', authorId: 's1', authorName: '김배우', journalType: 'student', content: '오늘 즉흥 연기가 처음에는 어려웠지만 점점 자연스러워진 것 같아요. 감정 전환이 아직 어색하지만 계속 연습해보겠습니다!', date: new Date(Date.now() - dayMs * 2).toISOString() },
  { id: 'j3', lessonId: 'l4', authorId: 't1', authorName: '박선생', journalType: 'teacher', content: '호흡 훈련과 발성 기초. 복식호흡 이해도 확인. 전반적으로 양호하나 이연기 학생은 추가 지도 필요.', objectives: '발성 기초 및 호흡법', nextPlan: '발성 심화 + 대사 전달력 훈련', date: new Date(Date.now() - dayMs * 4).toISOString() },
];

const MOCK_ATTENDANCE: AttendanceRecord[] = [
  { id: 'at1', lessonId: 'l3', studentId: 's1', studentName: '김배우', status: 'present' },
  { id: 'at2', lessonId: 'l3', studentId: 's2', studentName: '이연기', status: 'present' },
  { id: 'at3', lessonId: 'l4', studentId: 's1', studentName: '김배우', status: 'present' },
  { id: 'at4', lessonId: 'l4', studentId: 's2', studentName: '이연기', status: 'late', note: '교통 사정으로 10분 지각' },
  { id: 'at5', lessonId: 'l5', studentId: 's3', studentName: '최무대', status: 'present' },
  { id: 'at6', lessonId: 'l5', studentId: 's4', studentName: '박감정', status: 'absent' },
];

const MOCK_PRIVATE_REQUESTS: PrivateLessonRequest[] = [
  { id: 'pr1', studentId: 's1', studentName: '김배우', teacherId: 't1', teacherName: '박선생', subject: Subject.ACTING, preferredDate: dateOffset(1), preferredStartTime: '10:00', preferredEndTime: '11:00', reason: '독백 준비를 위해 개인 지도를 받고 싶습니다.', status: 'approved', responseNote: '좋습니다. 개인연습실에서 만나요.', createdAt: new Date(Date.now() - dayMs * 3).toISOString(), respondedAt: new Date(Date.now() - dayMs * 2).toISOString() },
  { id: 'pr2', studentId: 's2', studentName: '이연기', teacherId: 't1', teacherName: '박선생', subject: Subject.MUSICAL, preferredDate: dateOffset(5), preferredStartTime: '15:00', preferredEndTime: '16:00', reason: '뮤지컬 넘버 개인 연습이 필요합니다.', status: 'pending', createdAt: new Date(Date.now() - dayMs * 1).toISOString() },
  { id: 'pr3', studentId: 's3', studentName: '최무대', teacherId: 't2', teacherName: '김무용', subject: Subject.DANCE, preferredDate: dateOffset(3), preferredStartTime: '11:00', preferredEndTime: '12:00', reason: '안무 동작이 어려워서 추가 지도 부탁드립니다.', status: 'approved', responseNote: '그날 시간 괜찮습니다.', createdAt: new Date(Date.now() - dayMs * 5).toISOString(), respondedAt: new Date(Date.now() - dayMs * 4).toISOString() },
];

export const Lessons: React.FC<LessonsProps> = ({ user, classes, allUsers }) => {
  const [lessons, setLessons] = useState<Lesson[]>(() => {
    const saved = localStorage.getItem('muse_lessons');
    return saved ? JSON.parse(saved) : MOCK_LESSONS;
  });
  const [journals, setJournals] = useState<LessonJournal[]>(() => {
    const saved = localStorage.getItem('muse_journals');
    return saved ? JSON.parse(saved) : MOCK_JOURNALS;
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('muse_attendance');
    return saved ? JSON.parse(saved) : MOCK_ATTENDANCE;
  });
  const [privateRequests, setPrivateRequests] = useState<PrivateLessonRequest[]>(() => {
    const saved = localStorage.getItem('muse_private_requests');
    return saved ? JSON.parse(saved) : MOCK_PRIVATE_REQUESTS;
  });

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'journal' | 'attendance'>('journal');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Journal form
  const [journalContent, setJournalContent] = useState('');
  const [journalObjectives, setJournalObjectives] = useState('');
  const [journalNextPlan, setJournalNextPlan] = useState('');

  // Create lesson form
  const [newClassId, setNewClassId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newSubject, setNewSubject] = useState<Subject | ''>('');

  // Private lesson request modal (student)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [reqTeacherId, setReqTeacherId] = useState('');
  const [reqSubject, setReqSubject] = useState<Subject | ''>('');
  const [reqDate, setReqDate] = useState('');
  const [reqStartTime, setReqStartTime] = useState('');
  const [reqEndTime, setReqEndTime] = useState('');
  const [reqReason, setReqReason] = useState('');

  // Private requests panel (teacher/director)
  const [isRequestsPanelOpen, setIsRequestsPanelOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const isStudent = user.role === UserRole.STUDENT;
  const isStaff = !isStudent;

  useEffect(() => { localStorage.setItem('muse_lessons', JSON.stringify(lessons)); }, [lessons]);
  useEffect(() => { localStorage.setItem('muse_journals', JSON.stringify(journals)); }, [journals]);
  useEffect(() => { localStorage.setItem('muse_attendance', JSON.stringify(attendance)); }, [attendance]);
  useEffect(() => { localStorage.setItem('muse_private_requests', JSON.stringify(privateRequests)); }, [privateRequests]);

  const selectedLesson = lessons.find(l => l.id === selectedLessonId);
  const lessonJournals = journals.filter(j => j.lessonId === selectedLessonId);
  const lessonAttendance = attendance.filter(a => a.lessonId === selectedLessonId);

  // Filter lessons for user role
  const myLessons = lessons.filter(l => {
    if (user.role === UserRole.DIRECTOR) return true;
    if (user.role === UserRole.TEACHER) return l.teacherId === user.id;
    // Student: group lessons in their class, or private lessons they're in
    if (l.isPrivate) {
      return (l.privateStudentIds || []).includes(user.id);
    }
    const cls = classes.find(c => c.id === l.classId);
    return cls ? cls.studentIds.includes(user.id) : false;
  });

  // Pending requests for teacher/director
  const pendingRequests = privateRequests.filter(r => {
    if (r.status !== 'pending') return false;
    if (user.role === UserRole.DIRECTOR) return true;
    if (user.role === UserRole.TEACHER) return r.teacherId === user.id;
    return false;
  });

  // My requests (student)
  const myRequests = privateRequests.filter(r => r.studentId === user.id);

  // Calendar logic
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const handleToday = () => {
    const t = new Date();
    setCurrentDate(t);
    setSelectedDate(t.toISOString().split('T')[0]);
  };

  // Auto-fill teacher from class + subject
  const autoTeacherId = (() => {
    if (!newClassId || !newSubject) return '';
    const cls = classes.find(c => c.id === newClassId);
    if (!cls) return '';
    return cls.subjectTeachers[newSubject as Subject] || '';
  })();

  const autoTeacherName = (() => {
    if (!autoTeacherId) return '';
    const u = allUsers.find(u => u.id === autoTeacherId);
    return u?.name || '';
  })();

  const renderCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 md:h-20 bg-slate-50/30 border border-slate-50"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLessons = myLessons.filter(l => l.date === dateStr);
      const isSelected = selectedDate === dateStr;
      const todayStr = new Date().toISOString().split('T')[0];
      const isToday = dateStr === todayStr;

      days.push(
        <div
          key={d}
          onClick={() => { setSelectedDate(dateStr === selectedDate ? null : dateStr); setSelectedLessonId(null); }}
          className={`h-14 md:h-20 border border-slate-50 p-1 relative cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-orange-50 ring-1 ring-orange-200 z-10' : 'bg-white'}`}
        >
          <div className={`text-[10px] md:text-xs font-bold mb-1 ${isToday ? 'text-white bg-orange-500 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center' : isSelected ? 'text-orange-600' : 'text-slate-700'}`}>
            {d}
          </div>
          <div className="flex flex-wrap gap-0.5 content-start">
            {dayLessons.map(l => (
              <div
                key={l.id}
                className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                  l.isPrivate ? 'bg-violet-400' :
                  l.status === 'completed' ? 'bg-green-500' :
                  l.status === 'cancelled' ? 'bg-red-400' : 'bg-orange-400'
                }`}
                title={`${l.className} ${l.startTime}${l.isPrivate ? ' (개인)' : ''}`}
              />
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  const filteredLessons = selectedDate
    ? myLessons.filter(l => l.date === selectedDate)
    : myLessons.sort((a, b) => a.date.localeCompare(b.date));

  // Handlers
  const handleCreateLesson = () => {
    if (!newClassId || !newDate || !newSubject) return;
    const cls = classes.find(c => c.id === newClassId);
    if (!cls) return;

    const teacherId = autoTeacherId;
    const teacherName = autoTeacherName || user.name;

    const newLesson: Lesson = {
      id: Date.now().toString(),
      classId: newClassId,
      className: cls.name,
      date: newDate,
      startTime: newStartTime || '18:00',
      endTime: newEndTime || '20:00',
      location: newLocation || '미정',
      status: 'scheduled',
      subject: newSubject as Subject,
      teacherId: teacherId || user.id,
      teacherName,
      isPrivate: false,
    };

    setLessons([...lessons, newLesson]);
    setIsCreateModalOpen(false);
    setNewClassId(''); setNewDate(''); setNewStartTime(''); setNewEndTime(''); setNewLocation(''); setNewSubject('');
    toast.success('수업이 등록되었습니다.');
  };

  const handleCompleteLesson = (id: string) => {
    setLessons(prev => prev.map(l => l.id === id ? { ...l, status: 'completed' } : l));
    toast.success('수업이 완료 처리되었습니다.');
  };

  const handleCancelLesson = (id: string) => {
    setLessons(prev => prev.map(l => l.id === id ? { ...l, status: 'cancelled' } : l));
    toast.success('수업이 취소되었습니다.');
  };

  const handleAddJournal = () => {
    if (!journalContent.trim() || !selectedLessonId) return;
    const newJ: LessonJournal = {
      id: Date.now().toString(),
      lessonId: selectedLessonId,
      authorId: user.id,
      authorName: user.name,
      journalType: isStaff ? 'teacher' : 'student',
      content: journalContent,
      objectives: isStaff ? journalObjectives : undefined,
      nextPlan: isStaff ? journalNextPlan : undefined,
      date: new Date().toISOString(),
    };
    setJournals([...journals, newJ]);
    setJournalContent(''); setJournalObjectives(''); setJournalNextPlan('');
    toast.success('수업일지가 등록되었습니다.');
  };

  const handleAttendance = (studentId: string, studentName: string, status: AttendanceRecord['status']) => {
    if (!selectedLessonId) return;
    const existing = attendance.find(a => a.lessonId === selectedLessonId && a.studentId === studentId);
    if (existing) {
      setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, status } : a));
    } else {
      const newA: AttendanceRecord = {
        id: Date.now().toString(),
        lessonId: selectedLessonId,
        studentId,
        studentName,
        status,
      };
      setAttendance([...attendance, newA]);
    }
    toast.success('출석이 기록되었습니다.');
  };

  // Private lesson request handlers
  const handleSubmitRequest = () => {
    if (!reqTeacherId || !reqSubject || !reqDate || !reqReason.trim()) return;
    const teacher = allUsers.find(u => u.id === reqTeacherId);
    if (!teacher) return;

    const newReq: PrivateLessonRequest = {
      id: Date.now().toString(),
      studentId: user.id,
      studentName: user.name,
      teacherId: reqTeacherId,
      teacherName: teacher.name,
      subject: reqSubject as Subject,
      preferredDate: reqDate,
      preferredStartTime: reqStartTime || '10:00',
      preferredEndTime: reqEndTime || '11:00',
      reason: reqReason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setPrivateRequests([...privateRequests, newReq]);
    setIsRequestModalOpen(false);
    setReqTeacherId(''); setReqSubject(''); setReqDate(''); setReqStartTime(''); setReqEndTime(''); setReqReason('');
    toast.success('개인 레슨 신청이 완료되었습니다.');
  };

  const handleApproveRequest = (req: PrivateLessonRequest) => {
    // Find a class that has this student and this teacher+subject
    const cls = classes.find(c =>
      c.studentIds.includes(req.studentId) &&
      c.subjectTeachers[req.subject] === req.teacherId
    );

    const newLesson: Lesson = {
      id: Date.now().toString(),
      classId: cls?.id || 'c1',
      className: cls?.name || '개인 레슨',
      date: req.preferredDate,
      startTime: req.preferredStartTime,
      endTime: req.preferredEndTime,
      location: '개인연습실',
      status: 'scheduled',
      subject: req.subject,
      teacherId: req.teacherId,
      teacherName: req.teacherName,
      isPrivate: true,
      privateStudentIds: [req.studentId],
      requestId: req.id,
    };

    setLessons(prev => [...prev, newLesson]);
    setPrivateRequests(prev => prev.map(r =>
      r.id === req.id ? { ...r, status: 'approved' as const, respondedAt: new Date().toISOString() } : r
    ));
    toast.success(`${req.studentName} 학생의 개인 레슨을 승인했습니다.`);
  };

  const handleRejectRequest = (reqId: string) => {
    setPrivateRequests(prev => prev.map(r =>
      r.id === reqId ? { ...r, status: 'rejected' as const, responseNote: rejectNote, respondedAt: new Date().toISOString() } : r
    ));
    setRejectingId(null);
    setRejectNote('');
    toast.success('개인 레슨 신청을 거절했습니다.');
  };

  const statusLabel = (s: AttendanceRecord['status']) => {
    switch(s) {
      case 'present': return '출석';
      case 'late': return '지각';
      case 'absent': return '결석';
      case 'excused': return '사유결석';
    }
  };
  const statusColor = (s: AttendanceRecord['status']) => {
    switch(s) {
      case 'present': return 'bg-green-100 text-green-600';
      case 'late': return 'bg-yellow-100 text-yellow-600';
      case 'absent': return 'bg-red-100 text-red-600';
      case 'excused': return 'bg-blue-100 text-blue-600';
    }
  };

  const requestStatusLabel = (s: PrivateLessonRequest['status']) => {
    switch(s) {
      case 'pending': return '대기중';
      case 'approved': return '승인';
      case 'rejected': return '거절';
    }
  };
  const requestStatusColor = (s: PrivateLessonRequest['status']) => {
    switch(s) {
      case 'pending': return 'bg-yellow-100 text-yellow-600';
      case 'approved': return 'bg-green-100 text-green-600';
      case 'rejected': return 'bg-red-100 text-red-600';
    }
  };

  // Get available teachers for student request
  const availableTeachers = allUsers.filter(u => u.role === UserRole.TEACHER);

  return (
    <div className="grid md:grid-cols-3 gap-6 h-full min-h-0">
      {/* Left Column: Calendar + Lesson List */}
      <div className={`md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full ${selectedLessonId ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800">수업</h2>
            {isStaff && pendingRequests.length > 0 && (
              <button
                onClick={() => setIsRequestsPanelOpen(true)}
                className="relative flex items-center gap-1 text-xs bg-violet-50 text-violet-600 border border-violet-200 px-2.5 py-1.5 rounded-lg font-bold hover:bg-violet-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                신청
                <span className="bg-violet-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{pendingRequests.length}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isStudent && (
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="text-xs flex items-center gap-1 bg-violet-50 border border-violet-200 px-3 py-2 rounded-lg hover:bg-violet-100 hover:text-violet-600 transition-colors shadow-sm text-violet-500 font-bold"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span>개인 레슨 신청</span>
              </button>
            )}
            {isStaff && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="text-xs flex items-center gap-1 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-orange-500 hover:border-orange-200 transition-colors shadow-sm"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="font-bold">수업 등록</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {/* Calendar */}
          <div className="p-2 animate-fade-in">
            <div className="flex justify-between items-center mb-4 px-2">
              <button onClick={handlePrevMonth} className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="text-center cursor-pointer hover:bg-slate-50 px-3 py-1 rounded-lg" onClick={handleToday}>
                <h3 className="text-sm font-bold text-slate-800">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h3>
                {selectedDate && <p className="text-[10px] text-orange-500">선택됨: {selectedDate}</p>}
              </div>
              <button onClick={handleNextMonth} className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1 text-center">
              {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                <div key={day} className="text-[10px] font-bold text-slate-400 uppercase">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 bg-slate-100 gap-px border border-slate-100 rounded-lg overflow-hidden">
              {renderCalendarDays()}
            </div>

            <div className="mt-3 px-2 flex justify-between items-center text-[10px] text-slate-400">
              <div className="flex gap-2 flex-wrap">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400"></div>예정</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>완료</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div>취소</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-400"></div>개인</span>
              </div>
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)} className="text-slate-500 hover:text-orange-500 underline">
                  전체 보기
                </button>
              )}
            </div>
          </div>

          {/* Student's private lesson requests */}
          {isStudent && myRequests.length > 0 && (
            <div className="px-2 pb-2 border-t border-slate-100">
              <h4 className="px-2 pt-3 pb-1 text-xs font-bold text-violet-500">내 개인 레슨 신청</h4>
              <div className="space-y-1.5">
                {myRequests.map(r => (
                  <div key={r.id} className="p-2.5 bg-violet-50/50 rounded-lg border border-violet-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${requestStatusColor(r.status)}`}>
                        {requestStatusLabel(r.status)}
                      </span>
                      <span className="text-[10px] text-slate-400">{r.preferredDate}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">{SUBJECT_LABELS[r.subject]} - {r.teacherName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{r.preferredStartTime}~{r.preferredEndTime}</p>
                    {r.responseNote && (
                      <p className="text-[10px] text-violet-500 mt-1 bg-white rounded px-2 py-1">답변: {r.responseNote}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lesson List */}
          <div className="p-2 space-y-2 border-t border-slate-100 bg-slate-50/50 flex-1 min-h-0">
            <h4 className="px-2 pt-2 text-xs font-bold text-slate-500">{selectedDate ? `${selectedDate} 수업` : '전체 수업 목록'}</h4>
            {filteredLessons.length > 0 ? filteredLessons.map(l => (
              <div
                key={l.id}
                onClick={() => setSelectedLessonId(l.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  selectedLessonId === l.id
                    ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200'
                    : 'bg-white border-transparent hover:bg-slate-50 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      l.status === 'completed' ? 'bg-green-100 text-green-600' :
                      l.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {l.status === 'completed' ? '완료' : l.status === 'cancelled' ? '취소' : '예정'}
                    </span>
                    {l.isPrivate && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-600">개인</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">{l.date}</span>
                </div>
                <h3 className="font-bold text-slate-700 text-sm">{l.className}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <span>{SUBJECT_LABELS[l.subject]}</span>
                  <span>·</span>
                  <span>{l.startTime}~{l.endTime}</span>
                  <span>·</span>
                  <span>{l.location}</span>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                해당 날짜에 수업이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Lesson Detail */}
      <div className={`md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full ${selectedLessonId ? 'flex' : 'hidden md:flex'}`}>
        {selectedLesson ? (
          <div className="flex flex-col h-full animate-fade-in min-h-0">
            {/* Lesson Header */}
            <div className="p-6 border-b border-slate-100 shrink-0">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => setSelectedLessonId(null)}
                  className="md:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">{selectedLesson.className}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-500">
                        <span>{selectedLesson.date}</span>
                        <span>·</span>
                        <span>{selectedLesson.startTime}~{selectedLesson.endTime}</span>
                        <span>·</span>
                        <span>{selectedLesson.location}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {isStaff && selectedLesson.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => handleCompleteLesson(selectedLesson.id)}
                            className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-bold hover:bg-green-100"
                          >
                            수업 완료
                          </button>
                          <button
                            onClick={() => handleCancelLesson(selectedLesson.id)}
                            className="text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100"
                          >
                            취소
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedLesson.status === 'completed' ? 'bg-green-100 text-green-600' :
                      selectedLesson.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {selectedLesson.status === 'completed' ? '완료' : selectedLesson.status === 'cancelled' ? '취소' : '예정'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">{SUBJECT_LABELS[selectedLesson.subject]}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">{selectedLesson.teacherName}</span>
                    {selectedLesson.isPrivate && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-600">개인 레슨</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs: Journal / Attendance */}
            <div className="flex border-b border-slate-100 shrink-0">
              <button
                onClick={() => setDetailTab('journal')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${detailTab === 'journal' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                수업일지 ({lessonJournals.length})
              </button>
              <button
                onClick={() => setDetailTab('attendance')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${detailTab === 'attendance' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                출석 ({lessonAttendance.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {detailTab === 'journal' && (
                <>
                  {/* Existing Journals */}
                  {lessonJournals.length > 0 ? lessonJournals.map(j => (
                    <div key={j.id} className={`p-4 rounded-xl border ${j.journalType === 'teacher' ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${j.journalType === 'teacher' ? 'bg-blue-500' : 'bg-slate-400'}`}>
                          {j.journalType === 'teacher' ? 'T' : 'S'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700">{j.authorName}</p>
                          <p className="text-[10px] text-slate-400">{new Date(j.date).toLocaleDateString('ko-KR')}</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{j.content}</p>
                      {j.objectives && (
                        <div className="mt-3 pt-3 border-t border-blue-100">
                          <p className="text-xs text-blue-600"><span className="font-bold">수업 목표:</span> {j.objectives}</p>
                        </div>
                      )}
                      {j.nextPlan && (
                        <p className="text-xs text-blue-600 mt-1"><span className="font-bold">다음 계획:</span> {j.nextPlan}</p>
                      )}
                    </div>
                  )) : (
                    <div className="text-center text-slate-400 text-sm py-8">
                      아직 수업일지가 없습니다.
                    </div>
                  )}

                  {/* Journal Form */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-bold text-slate-700">수업일지 작성</h4>
                    {isStaff && (
                      <input
                        value={journalObjectives}
                        onChange={e => setJournalObjectives(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-orange-500"
                        placeholder="수업 목표 (선택)"
                      />
                    )}
                    <textarea
                      value={journalContent}
                      onChange={e => setJournalContent(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 resize-none h-24"
                      placeholder={isStaff ? "오늘 수업 내용과 학생 피드백을 작성하세요..." : "오늘 수업에서 배운 점이나 느낀 점을 기록하세요..."}
                    />
                    {isStaff && (
                      <input
                        value={journalNextPlan}
                        onChange={e => setJournalNextPlan(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-orange-500"
                        placeholder="다음 수업 계획 (선택)"
                      />
                    )}
                    <button
                      onClick={handleAddJournal}
                      className="w-full bg-orange-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors shadow-md shadow-orange-200"
                    >
                      일지 등록
                    </button>
                  </div>
                </>
              )}

              {detailTab === 'attendance' && (
                <>
                  {/* Attendance for this lesson */}
                  {(() => {
                    const cls = classes.find(c => c.id === selectedLesson.classId);
                    const studentIds = selectedLesson.isPrivate
                      ? (selectedLesson.privateStudentIds || [])
                      : (cls?.studentIds || []);
                    const students = allUsers.filter(u => studentIds.includes(u.id));

                    if (isStudent) {
                      // Student sees own attendance
                      const myRecord = lessonAttendance.find(a => a.studentId === user.id);
                      return (
                        <div className="space-y-4">
                          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                            <p className="text-sm text-slate-500 mb-2">나의 출석 상태</p>
                            {myRecord ? (
                              <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${statusColor(myRecord.status)}`}>
                                {statusLabel(myRecord.status)}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-sm">출석 기록 없음</span>
                            )}
                            {myRecord?.note && <p className="text-xs text-slate-400 mt-2">{myRecord.note}</p>}
                          </div>
                        </div>
                      );
                    }

                    // Staff: attendance management
                    return (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500">수강생별 출석 상태를 선택하세요.</p>
                        {students.length > 0 ? students.map(s => {
                          const record = lessonAttendance.find(a => a.studentId === s.id);
                          const currentStatus = record?.status || 'present';
                          return (
                            <div key={s.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3">
                              <div className="flex items-center gap-3">
                                <img src={s.avatar} alt={s.name} className="w-8 h-8 rounded-full bg-slate-200" />
                                <span className="text-sm font-bold text-slate-700">{s.name}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {(['present', 'late', 'absent', 'excused'] as const).map(st => (
                                  <button
                                    key={st}
                                    onClick={() => handleAttendance(s.id, s.name, st)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                                      currentStatus === st ? statusColor(st) : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                    }`}
                                  >
                                    {statusLabel(st)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="text-center text-slate-400 text-sm py-8">
                            이 클래스에 등록된 학생이 없습니다.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 bg-slate-50/30">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="font-medium text-slate-500">캘린더에서 수업을 선택해주세요.</p>
            <p className="text-xs mt-1">날짜를 클릭한 후 수업을 선택하세요.</p>
          </div>
        )}
      </div>

      {/* Create Lesson Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-2">수업 등록</h3>
            <p className="text-xs text-slate-500 mb-6">새 수업을 캘린더에 추가합니다.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">클래스</label>
                <select
                  value={newClassId}
                  onChange={e => { setNewClassId(e.target.value); setNewSubject(''); }}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500"
                >
                  <option value="">클래스 선택</option>
                  {classes.filter(c => {
                    if (user.role === UserRole.DIRECTOR) return true;
                    // Teacher sees classes where they teach any subject
                    return Object.values(c.subjectTeachers).includes(user.id);
                  }).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">과목</label>
                <select
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value as Subject | '')}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500"
                >
                  <option value="">과목 선택</option>
                  {newClassId && (() => {
                    const cls = classes.find(c => c.id === newClassId);
                    if (!cls) return null;
                    return (Object.keys(cls.subjectTeachers) as Subject[]).map(sub => (
                      <option key={sub} value={sub}>{SUBJECT_LABELS[sub]}</option>
                    ));
                  })()}
                </select>
              </div>
              {autoTeacherName && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-600">
                  <span className="text-xs font-bold text-slate-500">담당 교사: </span>{autoTeacherName}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">날짜</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">시작 시간</label>
                  <input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">종료 시간</label>
                  <input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">장소</label>
                <input value={newLocation} onChange={e => setNewLocation(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500" placeholder="예: 301호" />
              </div>
              <button
                onClick={handleCreateLesson}
                className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 mt-2"
              >
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private Lesson Request Modal (Student) */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsRequestModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-2">개인 레슨 신청</h3>
            <p className="text-xs text-slate-500 mb-6">선생님에게 개인 레슨을 요청합니다.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">선생님</label>
                <select
                  value={reqTeacherId}
                  onChange={e => setReqTeacherId(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-violet-500"
                >
                  <option value="">선생님 선택</option>
                  {availableTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">과목</label>
                <select
                  value={reqSubject}
                  onChange={e => setReqSubject(e.target.value as Subject | '')}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-violet-500"
                >
                  <option value="">과목 선택</option>
                  {Object.values(Subject).map(sub => (
                    <option key={sub} value={sub}>{SUBJECT_LABELS[sub]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">희망 날짜</label>
                <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-violet-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">시작 시간</label>
                  <input type="time" value={reqStartTime} onChange={e => setReqStartTime(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">종료 시간</label>
                  <input type="time" value={reqEndTime} onChange={e => setReqEndTime(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-violet-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">신청 사유</label>
                <textarea
                  value={reqReason}
                  onChange={e => setReqReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-violet-500 resize-none h-24"
                  placeholder="개인 레슨이 필요한 이유를 작성해주세요..."
                />
              </div>
              <button
                onClick={handleSubmitRequest}
                className="w-full bg-violet-500 text-white py-3 rounded-xl font-bold hover:bg-violet-600 transition-colors shadow-lg shadow-violet-200 mt-2"
              >
                신청하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private Lesson Requests Panel (Teacher/Director) */}
      {isRequestsPanelOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[80vh] flex flex-col">
            <button
              onClick={() => { setIsRequestsPanelOpen(false); setRejectingId(null); setRejectNote(''); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-1">개인 레슨 신청 목록</h3>
            <p className="text-xs text-slate-500 mb-4">대기중인 개인 레슨 신청을 확인하고 승인/거절합니다.</p>

            <div className="flex-1 overflow-y-auto space-y-3">
              {pendingRequests.length > 0 ? pendingRequests.map(req => (
                <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600">
                        {req.studentName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{req.studentName}</p>
                        <p className="text-[10px] text-slate-400">{new Date(req.createdAt).toLocaleDateString('ko-KR')} 신청</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-600">대기중</span>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-1 text-xs text-slate-600">
                    <p><span className="font-bold text-slate-500">과목:</span> {SUBJECT_LABELS[req.subject]}</p>
                    <p><span className="font-bold text-slate-500">희망 일시:</span> {req.preferredDate} {req.preferredStartTime}~{req.preferredEndTime}</p>
                    <p><span className="font-bold text-slate-500">담당:</span> {req.teacherName}</p>
                    <p><span className="font-bold text-slate-500">사유:</span> {req.reason}</p>
                  </div>

                  {rejectingId === req.id ? (
                    <div className="space-y-2">
                      <input
                        value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-400"
                        placeholder="거절 사유를 입력하세요 (선택)"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className="flex-1 bg-red-500 text-white py-2 rounded-lg font-bold text-xs hover:bg-red-600 transition-colors"
                        >
                          거절 확인
                        </button>
                        <button
                          onClick={() => { setRejectingId(null); setRejectNote(''); }}
                          className="flex-1 bg-slate-100 text-slate-500 py-2 rounded-lg font-bold text-xs hover:bg-slate-200 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveRequest(req)}
                        className="flex-1 bg-green-50 text-green-600 py-2 rounded-lg font-bold text-xs hover:bg-green-100 transition-colors border border-green-200"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => setRejectingId(req.id)}
                        className="flex-1 bg-red-50 text-red-500 py-2 rounded-lg font-bold text-xs hover:bg-red-100 transition-colors border border-red-200"
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center text-slate-400 text-sm py-12">
                  대기중인 개인 레슨 신청이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
