
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole, Evaluation, PortfolioItem, PortfolioComment, CompetitionEvent, ChecklistItem, Subject, SUBJECT_LABELS, ClassInfo } from '../types';
import toast from 'react-hot-toast';
import { evaluationApi, portfolioApi, auditionApi, API_URL, getToken } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import { ConfirmDialog } from './ConfirmDialog';
import { useUpload } from '../services/UploadContext';
import { useAppData } from '../services/AppContext';

interface GrowthProps {
  user: User;
}

type GrowthTab = 'evaluation' | 'portfolio' | 'competition';
type PortfolioView = 'grid' | 'timeline';

const PORTFOLIO_CATEGORY_LABELS: Record<string, string> = {
  monologue: '독백',
  scene: '장면연기',
  musical: '뮤지컬',
  improv: '즉흥연기',
  audition_prep: '오디션 준비',
  other: '기타',
};

/** Format seconds to mm:ss string */
function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const Growth: React.FC<GrowthProps> = ({ user }) => {
  const { allUsers, classes } = useAppData();
  const { startUpload: globalStartUpload, updateProgress: globalUpdateProgress, finishUpload: globalFinishUpload } = useUpload();
  const [activeTab, setActiveTab] = useState<GrowthTab>('evaluation');

  // Evaluations
  const [evalSubjectFilter, setEvalSubjectFilter] = useState<Subject | 'all'>('all');
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [evalStudentId, setEvalStudentId] = useState('');
  const [evalClassId, setEvalClassId] = useState('');
  const [evalPeriod, setEvalPeriod] = useState('');
  const [evalScores, setEvalScores] = useState({ acting: 3, expression: 3, creativity: 3, teamwork: 3, effort: 3 });
  const [evalComment, setEvalComment] = useState('');
  const [evalSubject, setEvalSubject] = useState<Subject | ''>('');

  // Portfolios
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [newPfTitle, setNewPfTitle] = useState('');
  const [newPfDesc, setNewPfDesc] = useState('');
  const [newPfCategory, setNewPfCategory] = useState('other');
  const [newPfTags, setNewPfTags] = useState('');
  const [newPfVideoUrl, setNewPfVideoUrl] = useState('');
  const [newPfVideoFile, setNewPfVideoFile] = useState<File | null>(null);
  const [isPfVideoUploading, setIsPfVideoUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedUpload, setFailedUpload] = useState<{ file: File; portfolioId: string } | null>(null);
  const pfVideoInputRef = useRef<HTMLInputElement>(null);
  const pendingVideoPortfolioIdRef = useRef<string | null>(null);
  const uploadAbortRef = useRef<(() => void) | null>(null);
  const [commentText, setCommentText] = useState('');

  // Portfolio view toggle (grid vs timeline)
  const [portfolioView, setPortfolioView] = useState<PortfolioView>('grid');
  const [practiceGroups, setPracticeGroups] = useState<{ groupName: string; items: PortfolioItem[] }[]>([]);
  const [practiceGroupsLoading, setPracticeGroupsLoading] = useState(false);

  // Timestamp comment state
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Portfolio create modal — practice group
  const [newPfPracticeGroup, setNewPfPracticeGroup] = useState('');
  const [newPfPracticeGroupCustom, setNewPfPracticeGroupCustom] = useState('');

  // Evaluation edit/delete
  const [editingEval, setEditingEval] = useState<Evaluation | null>(null);
  const [deleteEvalId, setDeleteEvalId] = useState<string | null>(null);

  // Events
  const [events, setEvents] = useState<CompetitionEvent[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');

  // Event edit/delete
  const [editingEvent, setEditingEvent] = useState<CompetitionEvent | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);

  // Portfolio delete (ConfirmDialog instead of window.confirm)
  const [deletePortfolioId, setDeletePortfolioId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const isStudent = user.role === UserRole.STUDENT;
  const isStaff = !isStudent;
  const students = allUsers.filter(u => u.role === UserRole.STUDENT);

  const loadData = useCallback(async () => {
    try {
      const [evalsData, pfData, eventsData] = await Promise.all([
        evaluationApi.list(isStudent ? { studentId: user.id } : {}),
        portfolioApi.list(isStudent ? { studentId: user.id } : {}),
        auditionApi.list(),
      ]);
      setEvaluations(evalsData);
      setPortfolios(pfData);
      setEvents(eventsData);
    } catch (err: any) {
      console.error('Failed to load growth data:', err);
      toast.error(err.message || '성장 데이터를 불러오지 못했습니다.');
    }
  }, [user.id]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [user.id]);

  useDataRefresh(['evaluations', 'portfolios', 'auditions'], loadData);

  // ESC key handler for all modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedPortfolioId) { setSelectedPortfolioId(null); return; }
        if (isEventModalOpen) { setIsEventModalOpen(false); return; }
        if (isPortfolioModalOpen) { setIsPortfolioModalOpen(false); return; }
        if (isEvalModalOpen) { setIsEvalModalOpen(false); return; }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedPortfolioId, isEventModalOpen, isPortfolioModalOpen, isEvalModalOpen]);

  // Warn before page close when upload is in progress
  useEffect(() => {
    if (!isPfVideoUploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isPfVideoUploading]);

  // Load practice groups when timeline view is selected
  useEffect(() => {
    if (portfolioView === 'timeline') {
      setPracticeGroupsLoading(true);
      portfolioApi.listPracticeGroups(isStudent ? user.id : undefined)
        .then(groups => setPracticeGroups(groups))
        .catch(err => {
          console.error('Failed to load practice groups:', err);
          toast.error('연습 시리즈를 불러오지 못했습니다.');
        })
        .finally(() => setPracticeGroupsLoading(false));
    }
  }, [portfolioView, user.id, isStudent]);

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

  // Extract unique practice group names from user's portfolios (for create modal dropdown)
  const existingPracticeGroups = Array.from(
    new Set(myPortfolios.map(p => p.practiceGroup).filter((g): g is string => !!g))
  );

  // Handlers
  const handleOpenCreateEval = () => {
    setEditingEval(null);
    setEvalStudentId(''); setEvalPeriod(''); setEvalComment(''); setEvalSubject('');
    setEvalScores({ acting: 3, expression: 3, creativity: 3, teamwork: 3, effort: 3 });
    setIsEvalModalOpen(true);
  };

  const handleOpenEditEval = (ev: Evaluation) => {
    setEditingEval(ev);
    setEvalStudentId(ev.studentId);
    setEvalSubject(ev.subject as Subject);
    setEvalPeriod(ev.period);
    setEvalScores({ ...ev.scores });
    setEvalComment(ev.comment || '');
    setEvalClassId(ev.classId || '');
    setIsEvalModalOpen(true);
  };

  const handleCreateEvaluation = async () => {
    if (!evalStudentId || !evalPeriod || !evalSubject) return;
    try {
      const newEval = await evaluationApi.create({
        studentId: evalStudentId,
        classId: evalClassId || classes[0]?.id,
        subject: evalSubject,
        period: evalPeriod,
        scores: { ...evalScores },
        comment: evalComment,
      });
      setEvaluations([...evaluations, newEval]);
      setIsEvalModalOpen(false);
      setEvalStudentId(''); setEvalPeriod(''); setEvalComment(''); setEvalSubject('');
      setEvalScores({ acting: 3, expression: 3, creativity: 3, teamwork: 3, effort: 3 });
      toast.success('평가가 등록되었습니다.');
    } catch { toast.error('평가 등록에 실패했습니다.'); }
  };

  const handleUpdateEvaluation = async () => {
    if (!editingEval || !evalPeriod) return;
    try {
      const updated = await evaluationApi.update(editingEval.id, {
        scores: { ...evalScores },
        comment: evalComment,
        period: evalPeriod,
      });
      setEvaluations(prev => prev.map(e => e.id === editingEval.id ? updated : e));
      setIsEvalModalOpen(false);
      setEditingEval(null);
      toast.success('평가가 수정되었습니다.');
    } catch { toast.error('평가 수정에 실패했습니다.'); }
  };

  const handleDeleteEvaluation = async () => {
    if (!deleteEvalId) return;
    try {
      await evaluationApi.delete(deleteEvalId);
      setEvaluations(prev => prev.filter(e => e.id !== deleteEvalId));
      setDeleteEvalId(null);
      toast.success('평가가 삭제되었습니다.');
    } catch { toast.error('평가 삭제에 실패했습니다.'); }
  };

  const handlePfVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pfVideoInputRef.current) pfVideoInputRef.current.value = '';
    setNewPfVideoFile(file);
  };

  const startPfVideoUpload = (file: File, portfolioId: string) => {
    setIsPfVideoUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setFailedUpload(null);
    pendingVideoPortfolioIdRef.current = portfolioId;
    globalStartUpload(portfolioId, `영상 업로드: ${file.name}`);

    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams({
      subfolder: 'portfolios',
      target_type: 'portfolio',
      target_id: portfolioId,
    });

    const xhr = new XMLHttpRequest();
    xhr.timeout = 5 * 60 * 1000; // 5 minute timeout
    uploadAbortRef.current = () => xhr.abort();

    xhr.upload.addEventListener('progress', (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        setUploadProgress(pct);
        globalUpdateProgress(portfolioId, pct);
      }
    });

    const handleUploadFailure = (errorMsg: string) => {
      setIsPfVideoUploading(false);
      setUploadProgress(null);
      setUploadError(errorMsg);
      setFailedUpload({ file, portfolioId });
      uploadAbortRef.current = null;
      globalFinishUpload(portfolioId);
      toast.error(errorMsg);
    };

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          const url: string = result.url;
          const pendingId = pendingVideoPortfolioIdRef.current;
          if (pendingId) {
            pendingVideoPortfolioIdRef.current = null;
            const updated = await portfolioApi.update(pendingId, { videoUrl: url });
            setPortfolios(prev => prev.map(p => p.id === pendingId ? updated : p));
            toast.success('영상이 포트폴리오에 저장되었습니다.');
          }
          setUploadError(null);
          setFailedUpload(null);
        } catch {
          handleUploadFailure('영상 저장 중 오류가 발생했습니다.');
          return;
        }
      } else {
        handleUploadFailure('영상 업로드에 실패했습니다.');
        return;
      }
      setIsPfVideoUploading(false);
      setUploadProgress(null);
      uploadAbortRef.current = null;
      globalFinishUpload(portfolioId);
    });
    xhr.addEventListener('error', () => handleUploadFailure('네트워크 오류로 업로드에 실패했습니다.'));
    xhr.addEventListener('timeout', () => handleUploadFailure('업로드 시간이 초과되었습니다.'));
    xhr.addEventListener('abort', () => {
      setIsPfVideoUploading(false);
      setUploadProgress(null);
      setUploadError(null);
      setFailedUpload(null);
      uploadAbortRef.current = null;
      globalFinishUpload(portfolioId);
      toast('업로드가 취소되었습니다.');
    });

    xhr.open('POST', `${API_URL}/api/upload?${params}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  };

  const handleRetryUpload = () => {
    if (failedUpload) {
      startPfVideoUpload(failedUpload.file, failedUpload.portfolioId);
    }
  };

  const handleCancelUpload = () => {
    uploadAbortRef.current?.();
  };

  const handleCreatePortfolio = async () => {
    if (!newPfTitle.trim()) {
      toast.error('제목을 입력해주세요.');
      return;
    }
    try {
      const practiceGroup =
        newPfPracticeGroup === '__new__'
          ? newPfPracticeGroupCustom.trim() || undefined
          : newPfPracticeGroup || undefined;

      const newPf = await portfolioApi.create({
        title: newPfTitle,
        description: newPfDesc,
        videoUrl: undefined,  // always empty on create; file uploads after
        category: newPfCategory || 'other',
        tags: newPfTags.split(',').map(t => t.trim()).filter(Boolean),
        practiceGroup,
      });
      setPortfolios(prev => [...prev, newPf]);

      // Close modal and reset form
      const fileToUpload = newPfVideoFile;
      setIsPortfolioModalOpen(false);
      setNewPfTitle(''); setNewPfDesc(''); setNewPfCategory('other'); setNewPfTags('');
      setNewPfVideoUrl(''); setNewPfVideoFile(null);
      setNewPfPracticeGroup(''); setNewPfPracticeGroupCustom('');

      // Start upload after portfolio is created (ID now known → server can patch DB directly)
      if (fileToUpload) {
        startPfVideoUpload(fileToUpload, newPf.id);
        toast.success('포트폴리오가 등록되었습니다. 영상 업로드 중...');
      } else {
        toast.success('포트폴리오가 등록되었습니다.');
      }
    } catch { toast.error('포트폴리오 등록에 실패했습니다.'); }
  };

  const handleDeletePortfolio = async () => {
    if (!deletePortfolioId) return;
    try {
      await portfolioApi.delete(deletePortfolioId);
      setPortfolios(prev => prev.filter(p => p.id !== deletePortfolioId));
      if (selectedPortfolioId === deletePortfolioId) setSelectedPortfolioId(null);
      setDeletePortfolioId(null);
      toast.success('포트폴리오가 삭제되었습니다.');
    } catch { toast.error('삭제에 실패했습니다.'); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedPortfolioId) return;
    try {
      const newComment = await portfolioApi.addComment(
        selectedPortfolioId,
        commentText,
        commentTimestamp ?? undefined,
      );
      setPortfolios(prev => prev.map(p =>
        p.id === selectedPortfolioId ? { ...p, comments: [...p.comments, newComment] } : p
      ));
      setCommentText('');
      setCommentTimestamp(null);
      toast.success('댓글이 등록되었습니다.');
    } catch { toast.error('댓글 등록에 실패했습니다.'); }
  };

  const handleCaptureTimestamp = () => {
    if (videoRef.current) {
      setCommentTimestamp(Math.floor(videoRef.current.currentTime));
    }
  };

  const handleSeekVideo = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleOpenCreateEvent = () => {
    setEditingEvent(null);
    setNewEventTitle(''); setNewEventDate(''); setNewEventLocation(''); setNewEventDesc('');
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (ev: CompetitionEvent) => {
    setEditingEvent(ev);
    setNewEventTitle(ev.title);
    setNewEventDate(ev.date);
    setNewEventLocation(ev.location || '');
    setNewEventDesc(ev.description || '');
    setIsEventModalOpen(true);
  };

  const handleCreateEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate) return;
    try {
      const newEvent = await auditionApi.create({
        title: newEventTitle,
        description: newEventDesc || '설명 없음',
        date: newEventDate,
        location: newEventLocation || '미정',
        auditionType: 'competition',
      });
      setEvents([...events, newEvent]);
      setIsEventModalOpen(false);
      setNewEventTitle(''); setNewEventDate(''); setNewEventLocation(''); setNewEventDesc('');
      toast.success('대회/행사가 등록되었습니다.');
    } catch { toast.error('대회/행사 등록에 실패했습니다.'); }
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent || !newEventTitle.trim()) return;
    try {
      const updated = await auditionApi.update(editingEvent.id, {
        title: newEventTitle,
        description: newEventDesc,
        date: newEventDate,
        location: newEventLocation,
      });
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? updated : e));
      setIsEventModalOpen(false);
      setEditingEvent(null);
      toast.success('대회/행사가 수정되었습니다.');
    } catch { toast.error('대회/행사 수정에 실패했습니다.'); }
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventId) return;
    try {
      await auditionApi.delete(deleteEventId);
      setEvents(prev => prev.filter(e => e.id !== deleteEventId));
      setDeleteEventId(null);
      toast.success('대회/행사가 삭제되었습니다.');
    } catch { toast.error('대회/행사 삭제에 실패했습니다.'); }
  };

  const handleToggleChecklist = async (eventId: string, checkId: string) => {
    const event = events.find(e => e.id === eventId);
    const item = event?.checklist.find(c => c.id === checkId);
    if (!item) return;
    try {
      await auditionApi.updateChecklist(eventId, checkId, { completed: !item.completed });
      setEvents(prev => prev.map(e =>
        e.id === eventId ? {
          ...e,
          checklist: e.checklist.map(c => c.id === checkId ? { ...c, completed: !c.completed } : c)
        } : e
      ));
    } catch { toast.error('체크리스트 업데이트에 실패했습니다.'); }
  };

  const handleAddChecklistItem = async (eventId: string, text: string) => {
    if (!text.trim()) return;
    try {
      const newItem = await auditionApi.addChecklist(eventId, { content: text });
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, checklist: [...e.checklist, newItem] } : e
      ));
    } catch { toast.error('체크리스트 추가에 실패했습니다.'); }
  };

  const tabs: { id: GrowthTab; label: string }[] = [
    { id: 'evaluation', label: '평가 리포트' },
    { id: 'portfolio', label: '포트폴리오' },
    { id: 'competition', label: '대회·행사' },
  ];

  const upcomingEvents = events.filter(e => e.status === 'upcoming' || e.status === 'ongoing');
  const pastEvents = events.filter(e => e.status === 'completed');

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-slate-300 border-t-brand-400 rounded-full animate-spin"></div></div>;
  }

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
      <div className="flex gap-1 border-b border-slate-100 overflow-x-auto no-scrollbar scroll-hint">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
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
                onClick={handleOpenCreateEval}
                className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2"
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
                className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  evalSubjectFilter === s
                    ? 'bg-brand-500 text-white'
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
                    <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">{SUBJECT_LABELS[ev.subject]}</span>
                  </div>
                  <p className="text-xs text-slate-400">{ev.className} • 평가자: {ev.evaluatorName}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isStaff && (
                    <>
                      <button
                        onClick={() => handleOpenEditEval(ev)}
                        className="text-xs text-slate-400 hover:text-brand-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >수정</button>
                      <button
                        onClick={() => setDeleteEvalId(ev.id)}
                        className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >삭제</button>
                    </>
                  )}
                  <span className="text-xs text-slate-400 ml-1">{ev.date}</span>
                </div>
              </div>

              {/* Score Bars */}
              <div className="space-y-3 mb-4">
                {(Object.entries(ev.scores) as [string, number][]).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 w-14">{scoreLabels[key]}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-400 to-brand-500 rounded-full transition-all"
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
          {/* Top row: view toggle + upload button */}
          <div className="flex items-center justify-between gap-3">
            {/* Grid / Timeline toggle */}
            <div className="flex bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setPortfolioView('grid')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  portfolioView === 'grid'
                    ? 'bg-white text-brand-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setPortfolioView('timeline')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  portfolioView === 'timeline'
                    ? 'bg-white text-brand-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                연습 시리즈
              </button>
            </div>

            {isStudent && (
              <button
                onClick={() => setIsPortfolioModalOpen(true)}
                className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                영상 업로드
              </button>
            )}
          </div>

          {/* === Grid View (existing behavior) === */}
          {portfolioView === 'grid' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myPortfolios.map(pf => (
                  <div
                    key={pf.id}
                    onClick={() => { setSelectedPortfolioId(pf.id); setCommentTimestamp(null); }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                  >
                    {/* Video Thumbnail Placeholder */}
                    <div className="aspect-video bg-slate-100 relative flex items-center justify-center">
                      {pf.videoUrl ? (
                        <div className="w-14 h-14 rounded-full bg-black/30 flex items-center justify-center group-hover:bg-brand-500/80 transition-colors">
                          <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                      ) : failedUpload?.portfolioId === pf.id ? (
                        <div className="flex flex-col items-center gap-2 text-red-400 w-full px-6" onClick={(e) => e.stopPropagation()}>
                          <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                          <span className="text-xs font-medium text-red-500">업로드 실패</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRetryUpload(); }}
                            className="text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-full"
                          >
                            다시 시도
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400 w-full px-6">
                          <svg className="w-6 h-6 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                          {pendingVideoPortfolioIdRef.current === pf.id && uploadProgress !== null ? (
                            <div className="w-full flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-brand-600">{uploadProgress}%</span>
                              <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancelUpload(); }}
                                className="text-xs font-medium text-red-400 hover:text-red-600 mt-1"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-medium">영상 업로드 중</span>
                          )}
                        </div>
                      )}
                      <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">{PORTFOLIO_CATEGORY_LABELS[pf.category] || pf.category}</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-sm text-slate-800 line-clamp-1">{pf.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{pf.studentName} • {pf.date}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {pf.tags.map(tag => (
                          <span key={tag} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
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
            </>
          )}

          {/* === Timeline View (practice groups) === */}
          {portfolioView === 'timeline' && (
            <>
              {practiceGroupsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-brand-400 rounded-full animate-spin"></div>
                </div>
              ) : practiceGroups.length > 0 ? (
                <div className="space-y-8">
                  {practiceGroups.map(group => {
                    // Sort items oldest to newest
                    const sorted = [...group.items].sort(
                      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                    );
                    return (
                      <div key={group.groupName}>
                        {/* Group header */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                          <h3 className="font-bold text-sm text-slate-700">{group.groupName}</h3>
                          <span className="text-xs text-slate-400 font-medium">{sorted.length}개</span>
                          <div className="flex-1 h-px bg-slate-100" />
                        </div>

                        {/* Horizontal scrollable timeline row */}
                        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-hint">
                          {sorted.map((pf, idx) => (
                            <div
                              key={pf.id}
                              onClick={() => { setSelectedPortfolioId(pf.id); setCommentTimestamp(null); }}
                              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group shrink-0 w-56"
                            >
                              {/* Thumbnail */}
                              <div className="aspect-video bg-slate-100 relative flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center group-hover:bg-brand-500/80 transition-colors">
                                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                                {/* Timeline index badge */}
                                <span className="absolute top-2 left-2 bg-brand-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                  {idx + 1}
                                </span>
                              </div>
                              <div className="p-3">
                                <h4 className="font-bold text-xs text-slate-800 line-clamp-1">{pf.title}</h4>
                                <p className="text-xs text-slate-400 mt-1">{pf.date}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p className="font-medium">연습 시리즈에 등록된 영상이 없습니다.</p>
                  <p className="text-xs mt-1">포트폴리오 업로드 시 "연습 시리즈"를 선택하면 여기에 표시됩니다.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* === COMPETITION TAB === */}
      {activeTab === 'competition' && (
        <div className="space-y-6">
          {isStaff && (
            <div className="flex justify-end">
              <button
                onClick={handleOpenCreateEvent}
                className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2"
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
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-lg text-slate-800">{ev.title}</h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                            <span>{ev.date}</span>
                            <span>•</span>
                            <span>{ev.location}</span>
                          </div>
                          {ev.description && <p className="text-sm text-slate-500 mt-2">{ev.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isStaff && (
                            <>
                              <button
                                onClick={() => handleOpenEditEvent(ev)}
                                className="text-xs text-slate-400 hover:text-brand-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                              >수정</button>
                              <button
                                onClick={() => setDeleteEventId(ev.id)}
                                className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                              >삭제</button>
                            </>
                          )}
                          <span className="bg-brand-100 text-brand-600 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
                            D-{Math.max(0, Math.ceil((new Date(ev.date).getTime() - Date.now()) / 86400000))}
                          </span>
                        </div>
                      </div>

                      {/* Progress */}
                      {total > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-500">준비 현황</span>
                            <span className="text-xs text-slate-400">{done}/{total} ({progress}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="h-full bg-gradient-to-r from-brand-400 to-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
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
                              className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500 border-gray-300"
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
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-600">{ev.title}</h4>
                        <p className="text-xs text-slate-400">{ev.date} • {ev.location}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isStaff && (
                          <button
                            onClick={() => setDeleteEventId(ev.id)}
                            className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >삭제</button>
                        )}
                        <span className="bg-green-100 text-green-600 text-xs font-bold px-2 py-1 rounded-full">완료</span>
                      </div>
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsEvalModalOpen(false)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsEvalModalOpen(false)} aria-label="닫기" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-6">{editingEval ? '평가 수정' : '학생 평가 작성'}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="input-eval-student" className="block text-xs font-bold text-slate-500 mb-1">학생 <span className="text-red-400">*</span></label>
                <select id="input-eval-student" value={evalStudentId} onChange={e => setEvalStudentId(e.target.value)} disabled={!!editingEval} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 disabled:opacity-50">
                  <option value="">학생 선택</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="input-eval-subject" className="block text-xs font-bold text-slate-500 mb-1">과목 <span className="text-red-400">*</span></label>
                <select id="input-eval-subject" value={evalSubject} onChange={e => setEvalSubject(e.target.value as Subject)} disabled={!!editingEval} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 disabled:opacity-50">
                  <option value="">과목 선택</option>
                  {Object.values(Subject).map(s => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="input-eval-period" className="block text-xs font-bold text-slate-500 mb-1">평가 기간 <span className="text-red-400">*</span></label>
                <input id="input-eval-period" value={evalPeriod} onChange={e => setEvalPeriod(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="예: 2024년 3월" />
              </div>
              {Object.entries(evalScores).map(([key, val]) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-500">{scoreLabels[key]}</label>
                    <span className="text-xs font-bold text-brand-500">{val}/5</span>
                  </div>
                  <input type="range" min={1} max={5} value={val} onChange={e => setEvalScores(prev => ({ ...prev, [key]: Number(e.target.value) }))} className="w-full accent-brand-500" />
                </div>
              ))}
              <div>
                <label htmlFor="input-eval-comment" className="block text-xs font-bold text-slate-500 mb-1">코멘트</label>
                <textarea id="input-eval-comment" value={evalComment} onChange={e => setEvalComment(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 resize-none h-24" placeholder="학생에 대한 종합 피드백을 작성하세요." />
              </div>
              <button onClick={editingEval ? handleUpdateEvaluation : handleCreateEvaluation} className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 shadow-lg shadow-brand-200">{editingEval ? '수정하기' : '등록하기'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Detail Modal */}
      {selectedPortfolio && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedPortfolioId(null)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-lg p-5 md:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelectedPortfolioId(null); setCommentTimestamp(null); }} aria-label="닫기" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-start justify-between pr-8 mb-1">
              <h3 className="text-xl font-bold text-slate-800">{selectedPortfolio.title}</h3>
              {(isStaff || selectedPortfolio.studentId === user.id) && (
                <button
                  onClick={() => setDeletePortfolioId(selectedPortfolio.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  삭제
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4">{selectedPortfolio.studentName} • {selectedPortfolio.date}</p>

            {/* Video Player */}
            <div className="aspect-video bg-black rounded-xl mb-4 overflow-hidden">
              {selectedPortfolio.videoUrl ? (
                <video
                  ref={videoRef}
                  src={selectedPortfolio.videoUrl.startsWith('/') ? `${API_URL}${selectedPortfolio.videoUrl}` : selectedPortfolio.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  preload="metadata"
                >
                  <source src={selectedPortfolio.videoUrl.startsWith('/') ? `${API_URL}${selectedPortfolio.videoUrl}` : selectedPortfolio.videoUrl} />
                </video>
              ) : isPfVideoUploading && pendingVideoPortfolioIdRef.current === selectedPortfolio.id ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-3">
                  <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  <span className="text-sm">영상 업로드 중... {uploadProgress !== null ? `${uploadProgress}%` : ''}</span>
                  {uploadProgress !== null && (
                    <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-400 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                  <button onClick={handleCancelUpload} className="text-xs text-red-300 hover:text-red-400 mt-1">취소</button>
                </div>
              ) : failedUpload?.portfolioId === selectedPortfolio.id ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-red-300 gap-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  <span className="text-sm">{uploadError || '업로드 실패'}</span>
                  <button onClick={handleRetryUpload} className="text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 px-4 py-1.5 rounded-full">다시 시도</button>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <span className="text-sm">영상이 없습니다</span>
                  {isStudent && selectedPortfolio.studentId === user.id && (
                    <>
                      <input ref={pfVideoInputRef} type="file" className="hidden" accept="video/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && selectedPortfolio) {
                          startPfVideoUpload(file, selectedPortfolio.id);
                        }
                        if (pfVideoInputRef.current) pfVideoInputRef.current.value = '';
                      }} />
                      <button onClick={() => pfVideoInputRef.current?.click()} className="text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 px-4 py-1.5 rounded-full">영상 업로드</button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 mb-3 flex-wrap">
              <span className="text-xs bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full font-bold">{PORTFOLIO_CATEGORY_LABELS[selectedPortfolio.category] || selectedPortfolio.category}</span>
              {selectedPortfolio.practiceGroup && (
                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">{selectedPortfolio.practiceGroup}</span>
              )}
              {selectedPortfolio.tags.map(tag => (
                <span key={tag} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
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
                      <span className="text-xs text-slate-400">{c.date}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      {c.timestampSec != null && (
                        <button
                          onClick={() => handleSeekVideo(c.timestampSec!)}
                          className="shrink-0 mt-0.5 bg-brand-100 text-brand-600 text-xs font-bold px-2 py-0.5 rounded-md hover:bg-brand-200 transition-colors cursor-pointer"
                          title={`${formatTimestamp(c.timestampSec)}(으)로 이동`}
                        >
                          {formatTimestamp(c.timestampSec)}
                        </button>
                      )}
                      <p className="text-sm text-slate-600">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment input with timestamp capture */}
              <div className="space-y-2">
                {commentTimestamp != null && (
                  <div className="flex items-center gap-2">
                    <span className="bg-brand-100 text-brand-600 text-xs font-bold px-2 py-0.5 rounded-md">
                      {formatTimestamp(commentTimestamp)}
                    </span>
                    <button
                      onClick={() => setCommentTimestamp(null)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      삭제
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                    className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500"
                    placeholder="댓글 작성..."
                  />
                  <button
                    onClick={handleCaptureTimestamp}
                    className="bg-slate-100 text-slate-600 px-3 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors whitespace-nowrap"
                    title="현재 영상 위치를 댓글에 첨부합니다"
                  >
                    현재 위치
                  </button>
                  <button onClick={handleAddComment} className="bg-brand-500 text-white px-4 rounded-xl font-bold text-sm hover:bg-brand-600">등록</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Create Modal */}
      {isPortfolioModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsPortfolioModalOpen(false)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsPortfolioModalOpen(false)} aria-label="닫기" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-6">포트폴리오 등록</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="input-portfolio-title" className="block text-xs font-bold text-slate-500 mb-1">제목 <span className="text-red-400">*</span></label>
                <input id="input-portfolio-title" value={newPfTitle} onChange={e => setNewPfTitle(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="예: 햄릿 독백 연기" />
              </div>
              <div>
                <label htmlFor="input-portfolio-video" className="block text-xs font-bold text-slate-500 mb-1">영상 파일 <span className="text-red-400">*</span></label>
                <input id="input-portfolio-video" ref={pfVideoInputRef} type="file" className="hidden" accept="video/*" onChange={handlePfVideoUpload} />
                {newPfVideoFile ? (
                  <div className="relative rounded-xl overflow-hidden border border-brand-200 bg-brand-50 p-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      <span className="text-sm font-medium text-brand-700 truncate">{newPfVideoFile.name}</span>
                      <button onClick={() => { setNewPfVideoFile(null); }} className="ml-auto text-xs text-red-400 hover:text-red-600 shrink-0">변경</button>
                    </div>
                    <p className="text-xs text-brand-400 mt-1">등록 후 업로드가 시작됩니다.</p>
                  </div>
                ) : (
                  <button
                    onClick={() => pfVideoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-brand-300 transition-colors"
                  >
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <span className="text-xs font-bold text-slate-500">클릭하여 영상을 선택하세요</span>
                  </button>
                )}
              </div>
              {/* Collapsible detail settings */}
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400 hover:text-slate-600 py-1">
                  <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  상세 설정
                </summary>
                <div className="space-y-4 mt-3">
                  <div>
                    <label htmlFor="input-portfolio-category" className="block text-xs font-bold text-slate-500 mb-1">카테고리 <span className="text-red-400">*</span></label>
                    <select id="input-portfolio-category" value={newPfCategory} onChange={e => setNewPfCategory(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500">
                      <option value="other">기타</option>
                      <option value="monologue">독백</option>
                      <option value="scene">장면연기</option>
                      <option value="musical">뮤지컬</option>
                      <option value="improv">즉흥연기</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="input-portfolio-practice-group" className="block text-xs font-bold text-slate-500 mb-1">연습 시리즈</label>
                    <select
                      id="input-portfolio-practice-group"
                      value={newPfPracticeGroup}
                      onChange={e => setNewPfPracticeGroup(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                    >
                      <option value="">없음</option>
                      {existingPracticeGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                      <option value="__new__">새 시리즈</option>
                    </select>
                    {newPfPracticeGroup === '__new__' && (
                      <input
                        value={newPfPracticeGroupCustom}
                        onChange={e => setNewPfPracticeGroupCustom(e.target.value)}
                        className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                        placeholder="새 시리즈 이름을 입력하세요"
                      />
                    )}
                  </div>
                  <div>
                    <label htmlFor="input-portfolio-tags" className="block text-xs font-bold text-slate-500 mb-1">태그 (쉼표로 구분)</label>
                    <input id="input-portfolio-tags" value={newPfTags} onChange={e => setNewPfTags(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="예: 셰익스피어, 비극, 입시" />
                  </div>
                  <div>
                    <label htmlFor="input-portfolio-desc" className="block text-xs font-bold text-slate-500 mb-1">설명</label>
                    <textarea id="input-portfolio-desc" value={newPfDesc} onChange={e => setNewPfDesc(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 resize-none h-20" placeholder="영상에 대한 설명을 입력하세요." />
                  </div>
                </div>
              </details>
              <button onClick={handleCreatePortfolio} className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 shadow-lg shadow-brand-200">등록하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Event Create Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsEventModalOpen(false)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsEventModalOpen(false)} aria-label="닫기" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-6">{editingEvent ? '대회/행사 수정' : '대회/행사 등록'}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="input-event-title" className="block text-xs font-bold text-slate-500 mb-1">행사명 <span className="text-red-400">*</span></label>
                <input id="input-event-title" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="예: 한예종 실기 시험" />
              </div>
              <div>
                <label htmlFor="input-event-date" className="block text-xs font-bold text-slate-500 mb-1">날짜 <span className="text-red-400">*</span></label>
                <input id="input-event-date" type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" />
              </div>
              <div>
                <label htmlFor="input-event-location" className="block text-xs font-bold text-slate-500 mb-1">장소</label>
                <input id="input-event-location" value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="예: 국립극장" />
              </div>
              <div>
                <label htmlFor="input-event-desc" className="block text-xs font-bold text-slate-500 mb-1">설명 (선택)</label>
                <textarea id="input-event-desc" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 resize-none h-20" placeholder="행사에 대한 설명" />
              </div>
              <button onClick={editingEvent ? handleUpdateEvent : handleCreateEvent} className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 shadow-lg shadow-brand-200">{editingEvent ? '수정하기' : '등록하기'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteEvalId && (
        <ConfirmDialog
          title="평가 삭제"
          message="이 평가를 삭제하시겠습니까?"
          variant="danger"
          confirmLabel="삭제"
          onConfirm={handleDeleteEvaluation}
          onCancel={() => setDeleteEvalId(null)}
        />
      )}

      {deletePortfolioId && (
        <ConfirmDialog
          title="포트폴리오 삭제"
          message="이 포트폴리오를 삭제하시겠습니까?"
          variant="danger"
          confirmLabel="삭제"
          onConfirm={handleDeletePortfolio}
          onCancel={() => setDeletePortfolioId(null)}
        />
      )}

      {deleteEventId && (
        <ConfirmDialog
          title="대회/행사 삭제"
          message="이 대회/행사를 삭제하시겠습니까?"
          variant="danger"
          confirmLabel="삭제"
          onConfirm={handleDeleteEvent}
          onCancel={() => setDeleteEventId(null)}
        />
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
        className="flex-1 p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-brand-500"
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
