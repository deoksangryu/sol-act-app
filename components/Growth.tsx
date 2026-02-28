
import React, { useState, useEffect } from 'react';
import { User, UserRole, Evaluation, PortfolioItem, PortfolioComment, CompetitionEvent, ChecklistItem, Subject, SUBJECT_LABELS, ClassInfo } from '../types';
import toast from 'react-hot-toast';

interface GrowthProps {
  user: User;
  allUsers: User[];
  classes: ClassInfo[];
}

const MOCK_EVALUATIONS: Evaluation[] = [
  {
    id: 'ev1', studentId: 's1', studentName: '김배우', evaluatorId: 't1', evaluatorName: '박선생',
    classId: 'c1', className: '입시 A반 (심화)', subject: Subject.ACTING, period: '2024년 1월',
    scores: { acting: 4, expression: 5, creativity: 3, teamwork: 4, effort: 5 },
    comment: '감정 표현력이 뛰어나고 수업에 대한 열정이 돋보입니다. 즉흥 연기에서 좀 더 창의적인 선택을 할 수 있도록 연습해보세요.',
    date: '2024-01-15'
  },
  {
    id: 'ev2', studentId: 's1', studentName: '김배우', evaluatorId: 't1', evaluatorName: '박선생',
    classId: 'c1', className: '입시 A반 (심화)', subject: Subject.ACTING, period: '2024년 2월',
    scores: { acting: 5, expression: 5, creativity: 4, teamwork: 5, effort: 5 },
    comment: '전월 대비 창의성 부분에서 눈에 띄는 향상이 있었습니다. 이 기세를 유지해주세요!',
    date: '2024-02-15'
  },
  {
    id: 'ev3', studentId: 's2', studentName: '이연기', evaluatorId: 't1', evaluatorName: '박선생',
    classId: 'c1', className: '입시 A반 (심화)', subject: Subject.DANCE, period: '2024년 1월',
    scores: { acting: 3, expression: 3, creativity: 4, teamwork: 3, effort: 4 },
    comment: '창의적인 해석이 돋보이지만 기본기를 더 다져야 합니다. 발성 연습에 좀 더 시간을 투자하세요.',
    date: '2024-01-15'
  },
  {
    id: 'ev4', studentId: 's1', studentName: '김배우', evaluatorId: 't1', evaluatorName: '박선생',
    classId: 'c1', className: '입시 A반 (심화)', subject: Subject.DANCE, period: '2024년 2월',
    scores: { acting: 3, expression: 4, creativity: 3, teamwork: 4, effort: 4 },
    comment: '무용 기초 동작이 안정적이며 리듬감이 좋습니다. 유연성 훈련을 병행하면 더 좋은 결과가 있을 것입니다.',
    date: '2024-02-15'
  },
];

const MOCK_PORTFOLIOS: PortfolioItem[] = [
  {
    id: 'pf1', studentId: 's1', studentName: '김배우',
    title: '햄릿 독백 - "죽느냐 사느냐"', description: '3막 1장 햄릿의 독백 연기입니다. 고뇌와 번민의 감정선을 중심으로 연기했습니다.',
    videoUrl: 'https://example.com/video1', category: '독백',
    tags: ['셰익스피어', '비극', '입시준비'],
    comments: [
      { id: 'pc1', authorId: 't1', authorName: '박선생', content: '감정의 깊이가 인상적이에요. 중간 부분에서 호흡을 좀 더 길게 가져가면 좋겠어요.', date: '2024-01-20' }
    ],
    date: '2024-01-18'
  },
  {
    id: 'pf2', studentId: 's1', studentName: '김배우',
    title: '창작 즉흥극 - 카페 장면', description: '수업 시간에 진행한 즉흥 장면 연기입니다. 파트너와의 호흡이 좋았습니다.',
    videoUrl: 'https://example.com/video2', category: '장면연기',
    tags: ['즉흥', '2인연기'],
    comments: [],
    date: '2024-02-10'
  },
];

const MOCK_EVENTS: CompetitionEvent[] = [
  {
    id: 'ce1', title: '한예종 실기 시험', date: '2024-06-15', location: '한국예술종합학교',
    status: 'upcoming', description: '2024학년도 정시 실기고사',
    creatorId: 't1',
    checklist: [
      { id: 'ck1', text: '자유 독백 2편 준비', completed: true },
      { id: 'ck2', text: '지정 독백 연습', completed: true },
      { id: 'ck3', text: '즉흥 연기 대비 연습', completed: false },
      { id: 'ck4', text: '의상 준비', completed: false },
      { id: 'ck5', text: '이동 경로 확인', completed: false },
    ],
  },
  {
    id: 'ce2', title: '청소년 연극 경연대회', date: '2024-04-20', location: '국립극장 달오름극장',
    status: 'upcoming', description: '제15회 전국 청소년 연극 경연대회',
    creatorId: 't1',
    checklist: [
      { id: 'ck6', text: '단체 장면 연습', completed: true },
      { id: 'ck7', text: '소품 준비', completed: false },
    ],
  },
  {
    id: 'ce3', title: '뮤지컬 워크숍', date: '2024-01-10', location: '뮤즈 아카데미',
    status: 'completed', description: '뮤지컬 보컬 마스터클래스',
    creatorId: 't1',
    checklist: [
      { id: 'ck8', text: '노래 2곡 준비', completed: true },
      { id: 'ck9', text: '악보 출력', completed: true },
    ],
  },
];

type GrowthTab = 'evaluation' | 'portfolio' | 'competition';

export const Growth: React.FC<GrowthProps> = ({ user, allUsers, classes }) => {
  const [activeTab, setActiveTab] = useState<GrowthTab>('evaluation');

  // Evaluations
  const [evalSubjectFilter, setEvalSubjectFilter] = useState<Subject | 'all'>('all');
  const [evaluations, setEvaluations] = useState<Evaluation[]>(() => {
    const saved = localStorage.getItem('muse_evaluations');
    return saved ? JSON.parse(saved) : MOCK_EVALUATIONS;
  });
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [evalStudentId, setEvalStudentId] = useState('');
  const [evalClassId, setEvalClassId] = useState('');
  const [evalPeriod, setEvalPeriod] = useState('');
  const [evalScores, setEvalScores] = useState({ acting: 3, expression: 3, creativity: 3, teamwork: 3, effort: 3 });
  const [evalComment, setEvalComment] = useState('');
  const [evalSubject, setEvalSubject] = useState<Subject | ''>('');

  // Portfolios
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>(() => {
    const saved = localStorage.getItem('muse_portfolios');
    return saved ? JSON.parse(saved) : MOCK_PORTFOLIOS;
  });
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [newPfTitle, setNewPfTitle] = useState('');
  const [newPfDesc, setNewPfDesc] = useState('');
  const [newPfCategory, setNewPfCategory] = useState('');
  const [newPfTags, setNewPfTags] = useState('');
  const [commentText, setCommentText] = useState('');

  // Events
  const [events, setEvents] = useState<CompetitionEvent[]>(() => {
    const saved = localStorage.getItem('muse_events');
    return saved ? JSON.parse(saved) : MOCK_EVENTS;
  });
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');

  const isStudent = user.role === UserRole.STUDENT;
  const isStaff = !isStudent;
  const students = allUsers.filter(u => u.role === UserRole.STUDENT);

  useEffect(() => { localStorage.setItem('muse_evaluations', JSON.stringify(evaluations)); }, [evaluations]);
  useEffect(() => { localStorage.setItem('muse_portfolios', JSON.stringify(portfolios)); }, [portfolios]);
  useEffect(() => { localStorage.setItem('muse_events', JSON.stringify(events)); }, [events]);

  const scoreLabels: Record<string, string> = {
    acting: '연기력', expression: '표현력', creativity: '창의성', teamwork: '협동심', effort: '성실도'
  };

  // Filter evaluations for current user and subject
  const myEvaluations = (isStudent
    ? evaluations.filter(e => e.studentId === user.id)
    : evaluations
  ).filter(e => evalSubjectFilter === 'all' || e.subject === evalSubjectFilter);

  const myPortfolios = isStudent
    ? portfolios.filter(p => p.studentId === user.id)
    : portfolios;

  const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId);

  // Handlers
  const handleCreateEvaluation = () => {
    if (!evalStudentId || !evalPeriod || !evalSubject) return;
    const student = students.find(s => s.id === evalStudentId);
    if (!student) return;
    const newEval: Evaluation = {
      id: Date.now().toString(),
      studentId: evalStudentId,
      studentName: student.name,
      evaluatorId: user.id,
      evaluatorName: user.name,
      classId: evalClassId || 'c1',
      className: '입시 A반 (심화)',
      subject: evalSubject,
      period: evalPeriod,
      scores: { ...evalScores },
      comment: evalComment,
      date: new Date().toISOString().split('T')[0],
    };
    setEvaluations([...evaluations, newEval]);
    setIsEvalModalOpen(false);
    setEvalStudentId(''); setEvalPeriod(''); setEvalComment(''); setEvalSubject('');
    setEvalScores({ acting: 3, expression: 3, creativity: 3, teamwork: 3, effort: 3 });
    toast.success('평가가 등록되었습니다.');
  };

  const handleCreatePortfolio = () => {
    if (!newPfTitle.trim()) return;
    const newPf: PortfolioItem = {
      id: Date.now().toString(),
      studentId: user.id,
      studentName: user.name,
      title: newPfTitle,
      description: newPfDesc,
      videoUrl: 'https://example.com/uploaded-video',
      category: newPfCategory || '기타',
      tags: newPfTags.split(',').map(t => t.trim()).filter(Boolean),
      comments: [],
      date: new Date().toISOString().split('T')[0],
    };
    setPortfolios([...portfolios, newPf]);
    setIsPortfolioModalOpen(false);
    setNewPfTitle(''); setNewPfDesc(''); setNewPfCategory(''); setNewPfTags('');
    toast.success('포트폴리오가 등록되었습니다.');
  };

  const handleAddComment = () => {
    if (!commentText.trim() || !selectedPortfolioId) return;
    const newComment: PortfolioComment = {
      id: Date.now().toString(),
      authorId: user.id,
      authorName: user.name,
      content: commentText,
      date: new Date().toISOString().split('T')[0],
    };
    setPortfolios(prev => prev.map(p =>
      p.id === selectedPortfolioId ? { ...p, comments: [...p.comments, newComment] } : p
    ));
    setCommentText('');
    toast.success('댓글이 등록되었습니다.');
  };

  const handleCreateEvent = () => {
    if (!newEventTitle.trim() || !newEventDate) return;
    const newEvent: CompetitionEvent = {
      id: Date.now().toString(),
      title: newEventTitle,
      date: newEventDate,
      location: newEventLocation || '미정',
      status: 'upcoming',
      description: newEventDesc,
      creatorId: user.id,
      checklist: [],
    };
    setEvents([...events, newEvent]);
    setIsEventModalOpen(false);
    setNewEventTitle(''); setNewEventDate(''); setNewEventLocation(''); setNewEventDesc('');
    toast.success('대회/행사가 등록되었습니다.');
  };

  const handleToggleChecklist = (eventId: string, checkId: string) => {
    setEvents(prev => prev.map(e =>
      e.id === eventId ? {
        ...e,
        checklist: e.checklist.map(c => c.id === checkId ? { ...c, completed: !c.completed } : c)
      } : e
    ));
  };

  const handleAddChecklistItem = (eventId: string, text: string) => {
    if (!text.trim()) return;
    const newItem: ChecklistItem = { id: Date.now().toString(), text, completed: false };
    setEvents(prev => prev.map(e =>
      e.id === eventId ? { ...e, checklist: [...e.checklist, newItem] } : e
    ));
  };

  const tabs: { id: GrowthTab; label: string }[] = [
    { id: 'evaluation', label: '평가 리포트' },
    { id: 'portfolio', label: '포트폴리오' },
    { id: 'competition', label: '대회·행사' },
  ];

  const upcomingEvents = events.filter(e => e.status === 'upcoming' || e.status === 'ongoing');
  const pastEvents = events.filter(e => e.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">성장 기록</h2>
          <p className="text-sm text-slate-500">평가, 포트폴리오, 대회 정보를 관리합니다.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-100 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}

      {/* === EVALUATION TAB === */}
      {activeTab === 'evaluation' && (
        <div className="space-y-6">
          {isStaff && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsEvalModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                평가 작성
              </button>
            </div>
          )}

          {/* Subject filter pills */}
          <div className="flex gap-2 flex-wrap">
            {(['all', Subject.ACTING, Subject.MUSICAL, Subject.DANCE] as const).map(s => (
              <button
                key={s}
                onClick={() => setEvalSubjectFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                  evalSubjectFilter === s
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? '전체' : SUBJECT_LABELS[s]}
              </button>
            ))}
          </div>

          {myEvaluations.length > 0 ? myEvaluations.map(ev => (
            <div key={ev.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-slate-800">{ev.studentName} — {ev.period}</h3>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">{SUBJECT_LABELS[ev.subject]}</span>
                  </div>
                  <p className="text-xs text-slate-400">{ev.className} • 평가자: {ev.evaluatorName}</p>
                </div>
                <span className="text-xs text-slate-400">{ev.date}</span>
              </div>

              {/* Score Bars */}
              <div className="space-y-3 mb-4">
                {(Object.entries(ev.scores) as [string, number][]).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 w-14">{scoreLabels[key]}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
                        style={{ width: `${(val / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-8 text-right">{val}/5</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed">{ev.comment}</p>
              </div>
            </div>
          )) : (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">아직 평가 기록이 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* === PORTFOLIO TAB === */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          {isStudent && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsPortfolioModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                영상 업로드
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myPortfolios.map(pf => (
              <div
                key={pf.id}
                onClick={() => setSelectedPortfolioId(pf.id)}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
              >
                {/* Video Thumbnail Placeholder */}
                <div className="aspect-video bg-slate-100 relative flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/30 flex items-center justify-center group-hover:bg-orange-500/80 transition-colors">
                    <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">{pf.category}</span>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sm text-slate-800 line-clamp-1">{pf.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{pf.studentName} • {pf.date}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {pf.tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    {pf.comments.length}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {myPortfolios.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">아직 등록된 포트폴리오가 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* === COMPETITION TAB === */}
      {activeTab === 'competition' && (
        <div className="space-y-6">
          {isStaff && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsEventModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                행사 등록
              </button>
            </div>
          )}

          {/* Upcoming */}
          {upcomingEvents.length > 0 && (
            <div>
              <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-3">다가오는 대회·행사</h3>
              <div className="space-y-4">
                {upcomingEvents.map(ev => {
                  const total = ev.checklist.length;
                  const done = ev.checklist.filter(c => c.completed).length;
                  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

                  return (
                    <div key={ev.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-lg text-slate-800">{ev.title}</h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                            <span>{ev.date}</span>
                            <span>•</span>
                            <span>{ev.location}</span>
                          </div>
                          {ev.description && <p className="text-sm text-slate-500 mt-2">{ev.description}</p>}
                        </div>
                        <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
                          D-{Math.max(0, Math.ceil((new Date(ev.date).getTime() - Date.now()) / 86400000))}
                        </span>
                      </div>

                      {/* Progress */}
                      {total > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-500">준비 현황</span>
                            <span className="text-xs text-slate-400">{done}/{total} ({progress}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Checklist */}
                      <div className="space-y-2">
                        {ev.checklist.map(item => (
                          <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => handleToggleChecklist(ev.id, item.id)}
                              className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 border-gray-300"
                            />
                            <span className={`text-sm ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                          </label>
                        ))}
                        <AddChecklistInput onAdd={(text) => handleAddChecklistItem(ev.id, text)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past */}
          {pastEvents.length > 0 && (
            <div>
              <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-3">지난 대회·행사</h3>
              <div className="space-y-3">
                {pastEvents.map(ev => (
                  <div key={ev.id} className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-600">{ev.title}</h4>
                        <p className="text-xs text-slate-400">{ev.date} • {ev.location}</p>
                      </div>
                      <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2 py-1 rounded-full">완료</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p className="font-medium">등록된 대회/행사가 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* === MODALS === */}

      {/* Evaluation Modal */}
      {isEvalModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsEvalModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-6">학생 평가 작성</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">학생</label>
                <select value={evalStudentId} onChange={e => setEvalStudentId(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500">
                  <option value="">학생 선택</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">과목</label>
                <select value={evalSubject} onChange={e => setEvalSubject(e.target.value as Subject)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500">
                  <option value="">과목 선택</option>
                  {Object.values(Subject).map(s => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">평가 기간</label>
                <input value={evalPeriod} onChange={e => setEvalPeriod(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500" placeholder="예: 2024년 3월" />
              </div>
              {Object.entries(evalScores).map(([key, val]) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500">{scoreLabels[key]}</label>
                    <span className="text-xs font-bold text-orange-500">{val}/5</span>
                  </div>
                  <input type="range" min={1} max={5} value={val} onChange={e => setEvalScores(prev => ({ ...prev, [key]: Number(e.target.value) }))} className="w-full accent-orange-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">코멘트</label>
                <textarea value={evalComment} onChange={e => setEvalComment(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 resize-none h-24" placeholder="학생에 대한 종합 피드백을 작성하세요." />
              </div>
              <button onClick={handleCreateEvaluation} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-200">등록하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Detail Modal */}
      {selectedPortfolio && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedPortfolioId(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-1">{selectedPortfolio.title}</h3>
            <p className="text-xs text-slate-400 mb-4">{selectedPortfolio.studentName} • {selectedPortfolio.date}</p>

            {/* Video Placeholder */}
            <div className="aspect-video bg-slate-100 rounded-xl mb-4 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <p className="text-xs">영상 미리보기</p>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">{selectedPortfolio.category}</span>
              {selectedPortfolio.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">{selectedPortfolio.description}</p>

            {/* Comments */}
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-sm font-bold text-slate-700 mb-3">댓글 ({selectedPortfolio.comments.length})</h4>
              <div className="space-y-3 mb-4">
                {selectedPortfolio.comments.map(c => (
                  <div key={c.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-700">{c.authorName}</span>
                      <span className="text-[10px] text-slate-400">{c.date}</span>
                    </div>
                    <p className="text-sm text-slate-600">{c.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500"
                  placeholder="댓글 작성..."
                />
                <button onClick={handleAddComment} className="bg-orange-500 text-white px-4 rounded-xl font-bold text-sm hover:bg-orange-600">등록</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Create Modal */}
      {isPortfolioModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsPortfolioModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-6">포트폴리오 등록</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">제목</label>
                <input value={newPfTitle} onChange={e => setNewPfTitle(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500" placeholder="예: 햄릿 독백 연기" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">영상 파일</label>
                <label className="flex items-center justify-center p-4 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="file" className="hidden" accept="video/*" />
                  <span className="text-xs text-slate-500">클릭하여 영상을 선택하세요</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">카테고리</label>
                <select value={newPfCategory} onChange={e => setNewPfCategory(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500">
                  <option value="">선택</option>
                  <option value="독백">독백</option>
                  <option value="장면연기">장면연기</option>
                  <option value="뮤지컬">뮤지컬</option>
                  <option value="즉흥연기">즉흥연기</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">태그 (쉼표로 구분)</label>
                <input value={newPfTags} onChange={e => setNewPfTags(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500" placeholder="예: 셰익스피어, 비극, 입시" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">설명</label>
                <textarea value={newPfDesc} onChange={e => setNewPfDesc(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 resize-none h-20" placeholder="영상에 대한 설명을 입력하세요." />
              </div>
              <button onClick={handleCreatePortfolio} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-200">등록하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Event Create Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsEventModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-6">대회/행사 등록</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">행사명</label>
                <input value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500" placeholder="예: 한예종 실기 시험" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">날짜</label>
                <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">장소</label>
                <input value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500" placeholder="예: 국립극장" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">설명 (선택)</label>
                <textarea value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 resize-none h-20" placeholder="행사에 대한 설명" />
              </div>
              <button onClick={handleCreateEvent} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-200">등록하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Small helper component for adding checklist items inline
const AddChecklistInput: React.FC<{ onAdd: (text: string) => void }> = ({ onAdd }) => {
  const [text, setText] = useState('');
  return (
    <div className="flex gap-2 mt-1">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onAdd(text); setText(''); } }}
        className="flex-1 p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500"
        placeholder="체크리스트 항목 추가..."
      />
      <button
        onClick={() => { if (text.trim()) { onAdd(text); setText(''); } }}
        className="text-xs bg-slate-100 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-200 font-bold"
      >
        추가
      </button>
    </div>
  );
};
