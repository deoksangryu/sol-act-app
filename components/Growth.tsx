
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserRole, Evaluation, PortfolioItem, PortfolioComment, CompetitionEvent, ChecklistItem, Subject, SUBJECT_LABELS, ClassInfo } from '../types';
import toast from 'react-hot-toast';
import { evaluationApi, portfolioApi, auditionApi, uploadApi, API_URL, getToken } from '../services/api';
import { useDataRefresh } from '../services/useWebSocket';
import { ConfirmDialog } from './ConfirmDialog';
import { useUpload } from '../services/UploadContext';
import { useAppData } from '../services/AppContext';

interface GrowthProps {
  user: User;
}

type GrowthTab = 'evaluation' | 'portfolio' | 'journal' | 'competition';
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
  const { startUpload: globalStartUpload, updateProgress: globalUpdateProgress, updatePhase: globalUpdatePhase, finishUpload: globalFinishUpload } = useUpload();
  const [activeTab, setActiveTab] = useState<GrowthTab>('evaluation');

  // Evaluations
  const [evalSubjectFilter, setEvalSubjectFilter] = useState<Subject | 'all'>('all');
  const [evalStudentFilter, setEvalStudentFilter] = useState<string>('all');
  const [evalSearchQuery, setEvalSearchQuery] = useState('');
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
  const [newPfTitles, setNewPfTitles] = useState<string[]>(['']);
  const [newPfDesc, setNewPfDesc] = useState('');
  const [newPfCategory, setNewPfCategory] = useState('other');
  const [newPfTags, setNewPfTags] = useState('');
  const [newPfVideoFiles, setNewPfVideoFiles] = useState<File[]>([]);
  const [pfUploadMode, setPfUploadMode] = useState<'individual' | 'single'>('individual'); // individual=영상별 포트폴리오, single=하나에 모아서
  // Per-portfolio upload tracking
  const [activeUploads, setActiveUploads] = useState<Record<string, { progress: number | null; error: string | null; file: File }>>({});
  const uploadAbortRefs = useRef<Record<string, () => void>>({});
  const pfVideoInputRef = useRef<HTMLInputElement>(null);
  // Compat aliases
  const isPfVideoUploading = Object.keys(activeUploads).length > 0;
  const pendingVideoPortfolioIdRef = useRef<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Portfolio filters (staff)
  const [pfStudentFilter, setPfStudentFilter] = useState<string>('all');
  const [pfSearchQuery, setPfSearchQuery] = useState('');

  // Portfolio view toggle (grid vs timeline)
  const [portfolioView, setPortfolioView] = useState<PortfolioView>('grid');
  const [practiceGroups, setPracticeGroups] = useState<{ groupName: string; items: PortfolioItem[] }[]>([]);
  const [practiceGroupsLoading, setPracticeGroupsLoading] = useState(false);

  // Timestamp comment state
  const [commentTimestamp, setCommentTimestamp] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);

  // Practice journal (independent tab)
  const [journalFeed, setJournalFeed] = useState<Record<string, unknown>[]>([]);
  const [journalFeedLoading, setJournalFeedLoading] = useState(false);
  const [journalStudentFilter, setJournalStudentFilter] = useState<string>('all');
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [journalTitle, setJournalTitle] = useState('');
  const [journalContent, setJournalContent] = useState('');
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [isJournalSaving, setIsJournalSaving] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<Record<string, unknown> | null>(null);
  const [journalAttachmentFile, setJournalAttachmentFile] = useState<File | null>(null);
  const [journalAttachmentUrl, setJournalAttachmentUrl] = useState<string>('');
  const [isJournalAttachmentUploading, setIsJournalAttachmentUploading] = useState(false);

  // Portfolio create modal — practice group
  const [newPfPracticeGroup, setNewPfPracticeGroup] = useState('');
  const [newPfPracticeGroupCustom, setNewPfPracticeGroupCustom] = useState('');

  // Evaluation edit/delete
  const [editingEval, setEditingEval] = useState<Evaluation | null>(null);
  const [deleteEvalId, setDeleteEvalId] = useState<string | null>(null);

  // Event filters
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventViewMode, setEventViewMode] = useState<'calendar' | 'list'>('calendar');
  const [eventCalDate, setEventCalDate] = useState(new Date());
  const [eventSelectedDate, setEventSelectedDate] = useState<string | null>(null);

  // Events
  const [events, setEvents] = useState<CompetitionEvent[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventRegStart, setNewEventRegStart] = useState('');
  const [newEventRegEnd, setNewEventRegEnd] = useState('');

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

  // Load journal feed when tab is active
  const loadJournalFeed = useCallback(async () => {
    setJournalFeedLoading(true);
    try {
      const data = await portfolioApi.listJournals(
        journalStudentFilter !== 'all' ? journalStudentFilter : undefined
      );
      setJournalFeed(data);
    } catch { /* silent */ }
    finally { setJournalFeedLoading(false); }
  }, [journalStudentFilter]);

  useEffect(() => {
    if (activeTab === 'journal') loadJournalFeed();
  }, [activeTab, journalStudentFilter]);

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

  // Load practice groups when timeline view is selected (respect student filter)
  useEffect(() => {
    if (portfolioView === 'timeline') {
      setPracticeGroupsLoading(true);
      const studentId = isStudent ? user.id : (pfStudentFilter !== 'all' ? pfStudentFilter : undefined);
      portfolioApi.listPracticeGroups(studentId)
        .then(groups => {
          // Apply search filter on client side
          if (pfSearchQuery.trim()) {
            const q = pfSearchQuery.trim().toLowerCase();
            return groups.map(g => ({
              ...g,
              items: g.items.filter((p: PortfolioItem) =>
                p.title.toLowerCase().includes(q)
                || p.studentName.toLowerCase().includes(q)
                || p.tags.some((t: string) => t.toLowerCase().includes(q))
              ),
            })).filter(g => g.items.length > 0);
          }
          return groups;
        })
        .then(groups => setPracticeGroups(groups))
        .catch(err => {
          console.error('Failed to load practice groups:', err);
          toast.error('연습 시리즈를 불러오지 못했습니다.');
        })
        .finally(() => setPracticeGroupsLoading(false));
    }
  }, [portfolioView, user.id, isStudent, pfStudentFilter, pfSearchQuery]);

  const scoreLabels: Record<string, string> = {
    acting: '연기력', expression: '표현력', creativity: '창의성', teamwork: '협동심', effort: '성실도'
  };

  // Filter evaluations for current user, subject, student, and search
  const myEvaluations = (isStudent
    ? evaluations.filter(e => e.studentId === user.id)
    : evaluations
  ).filter(e => evalSubjectFilter === 'all' || e.subject === evalSubjectFilter)
   .filter(e => evalStudentFilter === 'all' || e.studentId === evalStudentFilter)
   .filter(e => {
     if (!evalSearchQuery.trim()) return true;
     const q = evalSearchQuery.trim().toLowerCase();
     return e.studentName.toLowerCase().includes(q)
       || e.period.toLowerCase().includes(q)
       || (e.comment || '').toLowerCase().includes(q)
       || e.className.toLowerCase().includes(q);
   });

  const myPortfolios = (isStudent
    ? portfolios.filter(p => p.studentId === user.id)
    : portfolios
  ).filter(p => pfStudentFilter === 'all' || p.studentId === pfStudentFilter)
   .filter(p => {
     if (!pfSearchQuery.trim()) return true;
     const q = pfSearchQuery.trim().toLowerCase();
     return p.title.toLowerCase().includes(q)
       || p.studentName.toLowerCase().includes(q)
       || (p.description || '').toLowerCase().includes(q)
       || p.tags.some(t => t.toLowerCase().includes(q))
       || (PORTFOLIO_CATEGORY_LABELS[p.category] || '').toLowerCase().includes(q);
   });

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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // Copy files before clearing input (iOS may invalidate FileList)
    const fileArray = Array.from(files);
    setNewPfVideoFiles(fileArray);
    // Reset input after state is set (allow re-selecting same files)
    requestAnimationFrame(() => {
      if (pfVideoInputRef.current) pfVideoInputRef.current.value = '';
    });
  };

  const startPfVideoUpload = (file: File, portfolioId: string) => {
    setActiveUploads(prev => ({ ...prev, [portfolioId]: { progress: 0, error: null, file } }));
    globalStartUpload(portfolioId, `영상: ${file.name}`);

    const uploadPromise = uploadApi.upload(
      file,
      (pct) => {
        setActiveUploads(prev => prev[portfolioId] ? { ...prev, [portfolioId]: { ...prev[portfolioId], progress: pct } } : prev);
        globalUpdateProgress(portfolioId, pct);
      },
      'portfolios',
      'portfolio',
      portfolioId,
      (phase, pct) => {
        globalUpdatePhase(portfolioId, phase, pct);
        if (phase === 'compressing') {
          setActiveUploads(prev => prev[portfolioId] ? { ...prev, [portfolioId]: { ...prev[portfolioId], progress: null } } : prev);
        }
      },
    );
    uploadAbortRefs.current[portfolioId] = () => uploadPromise.abort();

    uploadPromise.then(async (result) => {
      try {
        const updated = await portfolioApi.update(portfolioId, { videoUrl: result.url });
        setPortfolios(prev => prev.map(p => p.id === portfolioId ? updated : p));
        toast.success('영상이 포트폴리오에 저장되었습니다.');
      } catch {
        toast.error('영상은 업로드되었지만 포트폴리오 연결에 실패했습니다.');
      }
      setActiveUploads(prev => { const n = { ...prev }; delete n[portfolioId]; return n; });
      delete uploadAbortRefs.current[portfolioId];
      globalFinishUpload(portfolioId);
    }).catch((err: any) => {
      const errorMsg = err.message || '영상 업로드에 실패했습니다.';
      setActiveUploads(prev => prev[portfolioId] ? { ...prev, [portfolioId]: { ...prev[portfolioId], error: errorMsg } } : prev);
      delete uploadAbortRefs.current[portfolioId];
      globalFinishUpload(portfolioId);
      toast.error(errorMsg);
    });
  };

  const handleRetryUpload = (portfolioId: string) => {
    const entry = activeUploads[portfolioId];
    if (entry?.error && entry.file) {
      startPfVideoUpload(entry.file, portfolioId);
    }
  };

  const handleCancelUpload = (portfolioId?: string) => {
    if (portfolioId) {
      uploadAbortRefs.current[portfolioId]?.();
      setActiveUploads(prev => { const n = { ...prev }; delete n[portfolioId]; return n; });
    } else {
      // Cancel all
      Object.values(uploadAbortRefs.current).forEach(abort => abort?.());
    }
  };

  const handleCreatePortfolio = async () => {
    const titles = newPfTitles.map(t => t.trim()).filter(Boolean);
    const files = newPfVideoFiles;

    if (titles.length === 0) {
      toast.error('제목을 입력해주세요.');
      return;
    }

    try {
      const practiceGroup =
        newPfPracticeGroup === '__new__'
          ? newPfPracticeGroupCustom.trim() || undefined
          : newPfPracticeGroup || undefined;

      if (pfUploadMode === 'single' || files.length <= 1) {
        // === Single portfolio (one or multiple videos in one portfolio) ===
        const newPf = await portfolioApi.create({
          title: titles[0],
          description: newPfDesc,
          videoUrl: undefined,
          category: newPfCategory || 'other',
          tags: newPfTags.split(',').map(t => t.trim()).filter(Boolean),
          practiceGroup,
        });
        setPortfolios(prev => [...prev, newPf]);

        setIsPortfolioModalOpen(false);
        setNewPfTitles(['']); setNewPfDesc(''); setNewPfCategory('other'); setNewPfTags('');
        setNewPfVideoFiles([]); setPfUploadMode('individual');
        setNewPfPracticeGroup(''); setNewPfPracticeGroupCustom('');

        if (files.length > 0) {
          // First video → main videoUrl via startPfVideoUpload
          startPfVideoUpload(files[0], newPf.id);
          // Additional videos → portfolio_videos via addVideo after first upload completes
          if (files.length > 1) {
            const additionalFiles = files.slice(1);
            // Upload remaining in background
            (async () => {
              for (const file of additionalFiles) {
                try {
                  const result = await uploadApi.upload(file, undefined, 'portfolios', 'portfolio', newPf.id);
                  await portfolioApi.addVideo(newPf.id, result.url);
                } catch { /* individual failure, continue */ }
              }
              const updated = await portfolioApi.get(newPf.id);
              setPortfolios(prev => prev.map(p => p.id === newPf.id ? updated : p));
            })();
          }
          toast.success(`포트폴리오 등록! 영상 ${files.length}개 업로드 중...`);
        } else {
          toast.success('포트폴리오가 등록되었습니다.');
        }
      } else {
        // === Individual portfolios per video ===
        if (titles.length > 1 && titles.length !== files.length) {
          toast.error(`제목은 1개 또는 영상 수(${files.length}개)와 같아야 합니다.`);
          return;
        }

        const createdPfs: PortfolioItem[] = [];
        for (let i = 0; i < files.length; i++) {
          const title = titles.length === 1 ? `${titles[0]} (${i + 1})` : titles[i];
          const newPf = await portfolioApi.create({
            title,
            description: newPfDesc,
            videoUrl: undefined,
            category: newPfCategory || 'other',
            tags: newPfTags.split(',').map(t => t.trim()).filter(Boolean),
            practiceGroup,
          });
          createdPfs.push(newPf);
        }

        setPortfolios(prev => [...prev, ...createdPfs]);
        setIsPortfolioModalOpen(false);
        setNewPfTitles(['']); setNewPfDesc(''); setNewPfCategory('other'); setNewPfTags('');
        setNewPfVideoFiles([]); setPfUploadMode('individual');
        setNewPfPracticeGroup(''); setNewPfPracticeGroupCustom('');

        files.forEach((file, i) => {
          startPfVideoUpload(file, createdPfs[i].id);
        });
        toast.success(`포트폴리오 ${files.length}개 등록! 영상 업로드 중...`);
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

  const handleSaveJournal = async () => {
    if (!journalTitle.trim() || !journalContent.trim()) return;
    setIsJournalSaving(true);
    try {
      // Upload attachment if selected
      let attachUrl = journalAttachmentUrl || undefined;
      if (journalAttachmentFile && !attachUrl) {
        setIsJournalAttachmentUploading(true);
        try {
          const result = await uploadApi.upload(journalAttachmentFile, undefined, 'journals');
          attachUrl = result.url;
        } catch {
          toast.error('파일 업로드에 실패했습니다.');
          setIsJournalSaving(false);
          setIsJournalAttachmentUploading(false);
          return;
        }
        setIsJournalAttachmentUploading(false);
      }

      if (editingJournalId) {
        await portfolioApi.updateJournal(editingJournalId, { title: journalTitle, content: journalContent, attachment_url: attachUrl });
      } else {
        await portfolioApi.createJournal(journalTitle, journalContent, attachUrl);
      }
      setJournalTitle('');
      setJournalContent('');
      setJournalAttachmentFile(null);
      setJournalAttachmentUrl('');
      setEditingJournalId(null);
      setIsJournalModalOpen(false);
      toast.success(editingJournalId ? '연습일지가 수정되었습니다.' : '연습일지가 등록되었습니다.');
      loadJournalFeed();
    } catch { toast.error('연습일지 저장에 실패했습니다.'); }
    finally { setIsJournalSaving(false); }
  };

  const handleDeleteJournal = async (journalId: string) => {
    try {
      await portfolioApi.deleteJournal(journalId);
      setJournalFeed(prev => prev.filter(j => (j.id as string) !== journalId));
      toast.success('연습일지가 삭제되었습니다.');
    } catch { toast.error('연습일지 삭제에 실패했습니다.'); }
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
    setNewEventRegStart(''); setNewEventRegEnd('');
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (ev: CompetitionEvent) => {
    setEditingEvent(ev);
    setNewEventTitle(ev.title);
    setNewEventDate(ev.date);
    setNewEventLocation(ev.location || '');
    setNewEventDesc(ev.description || '');
    setNewEventRegStart(ev.registrationStart || '');
    setNewEventRegEnd(ev.registrationEnd || '');
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
        registrationStart: newEventRegStart || undefined,
        registrationEnd: newEventRegEnd || undefined,
      });
      setEvents([...events, newEvent]);
      setIsEventModalOpen(false);
      setNewEventTitle(''); setNewEventDate(''); setNewEventLocation(''); setNewEventDesc('');
      setNewEventRegStart(''); setNewEventRegEnd('');
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
        registrationStart: newEventRegStart || undefined,
        registrationEnd: newEventRegEnd || undefined,
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
    { id: 'journal', label: '연습일지' },
    { id: 'competition', label: '대회·행사' },
  ];

  const filteredEvents = events.filter(e => {
    if (!eventSearchQuery.trim()) return true;
    const q = eventSearchQuery.trim().toLowerCase();
    return e.title.toLowerCase().includes(q)
      || (e.location || '').toLowerCase().includes(q)
      || (e.description || '').toLowerCase().includes(q);
  });
  const upcomingEvents = filteredEvents.filter(e => e.status === 'upcoming' || e.status === 'ongoing');
  const pastEvents = filteredEvents.filter(e => e.status === 'completed');

  // --- Event Calendar Logic ---
  const eventCalYear = eventCalDate.getFullYear();
  const eventCalMonth = eventCalDate.getMonth();
  const eventCalDaysInMonth = new Date(eventCalYear, eventCalMonth + 1, 0).getDate();
  const eventCalFirstDay = new Date(eventCalYear, eventCalMonth, 1).getDay();

  const handleEventPrevMonth = () => setEventCalDate(new Date(eventCalYear, eventCalMonth - 1, 1));
  const handleEventNextMonth = () => setEventCalDate(new Date(eventCalYear, eventCalMonth + 1, 1));
  const handleEventToday = () => {
    const t = new Date();
    setEventCalDate(t);
    setEventSelectedDate(t.toISOString().split('T')[0]);
  };

  // Build a map of dateStr -> event info for the calendar
  const eventDateMap = (() => {
    const map: Record<string, { events: CompetitionEvent[]; regOpen: boolean; regEnding: boolean; eventDay: boolean }> = {};
    const todayStr = new Date().toISOString().split('T')[0];
    for (const ev of events) {
      // Mark the event date
      const evDateStr = ev.date?.split('T')[0];
      if (evDateStr) {
        if (!map[evDateStr]) map[evDateStr] = { events: [], regOpen: false, regEnding: false, eventDay: true };
        else map[evDateStr].eventDay = true;
        map[evDateStr].events.push(ev);
      }
      // Mark registration period dates
      if (ev.registrationStart && ev.registrationEnd) {
        const start = new Date(ev.registrationStart);
        const end = new Date(ev.registrationEnd);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().split('T')[0];
          if (!map[ds]) map[ds] = { events: [], regOpen: true, regEnding: false, eventDay: false };
          else map[ds].regOpen = true;
          if (!map[ds].events.includes(ev)) map[ds].events.push(ev);
          // Mark last 3 days as "ending"
          const daysLeft = Math.ceil((end.getTime() - d.getTime()) / 86400000);
          if (daysLeft <= 3) map[ds].regEnding = true;
        }
      }
    }
    return map;
  })();

  // Events for the selected calendar date
  const selectedDateEvents = eventSelectedDate ? (eventDateMap[eventSelectedDate]?.events || []) : [];

  const renderEventCalendarDays = () => {
    const days = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < eventCalFirstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 md:h-20 bg-slate-50/30 border border-slate-50"></div>);
    }

    for (let d = 1; d <= eventCalDaysInMonth; d++) {
      const dateStr = `${eventCalYear}-${String(eventCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const info = eventDateMap[dateStr];
      const isSelected = eventSelectedDate === dateStr;
      const isToday = dateStr === todayStr;

      days.push(
        <div
          key={d}
          onClick={() => setEventSelectedDate(dateStr === eventSelectedDate ? null : dateStr)}
          className={`h-16 md:h-20 border border-slate-50 p-1 relative cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-brand-50 ring-1 ring-brand-200 z-10' : info?.regOpen ? (info.regEnding ? 'bg-red-50/40' : 'bg-green-50/40') : 'bg-white'}`}
        >
          <div className={`text-xs font-bold mb-1 ${isToday ? 'text-white bg-brand-500 w-6 h-6 rounded-full flex items-center justify-center' : isSelected ? 'text-brand-600' : 'text-slate-700'}`}>
            {d}
          </div>
          <div className="flex flex-wrap gap-0.5 content-start">
            {info?.eventDay && (
              <div className="w-2 h-2 rounded-full bg-brand-500" title="행사일" />
            )}
            {info?.regOpen && !info?.eventDay && (
              <div className={`w-2 h-2 rounded-full ${info.regEnding ? 'bg-red-400' : 'bg-green-400'}`} title="접수기간" />
            )}
            {info?.regOpen && info?.eventDay && (
              <div className={`w-2 h-2 rounded-full ${info.regEnding ? 'bg-red-400' : 'bg-green-400'}`} title="접수기간" />
            )}
          </div>
          {/* Show event count on larger screens */}
          {info && info.events.length > 0 && (
            <div className="hidden md:block text-[10px] text-slate-500 truncate mt-0.5 leading-tight">
              {info.events[0].title.slice(0, 6)}{info.events.length > 1 ? ` +${info.events.length - 1}` : ''}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

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
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Subject filter pills */}
            <div className="flex gap-2 flex-wrap flex-1 min-w-0">
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
            {isStaff && (
              <button
                onClick={handleOpenCreateEval}
                className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                평가 작성
              </button>
            )}
          </div>

          {/* Student filter + Search (staff only) */}
          {isStaff && (
            <div className="flex flex-wrap gap-3">
              <select
                value={evalStudentFilter}
                onChange={e => setEvalStudentFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 min-w-[140px]"
              >
                <option value="all">전체 학생</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="relative flex-1 min-w-[200px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  value={evalSearchQuery}
                  onChange={e => setEvalSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500"
                  placeholder="학생, 기간, 코멘트 검색..."
                />
                {evalSearchQuery && (
                  <button onClick={() => setEvalSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          )}

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
              <p className="font-medium">{evalSearchQuery || evalStudentFilter !== 'all' ? '검색 결과가 없습니다.' : '아직 평가 기록이 없습니다.'}</p>
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
                onClick={() => { setNewPfTitles(['']); setNewPfDesc(''); setNewPfCategory('other'); setNewPfTags(''); setNewPfVideoFiles([]); setPfUploadMode('individual'); setIsPortfolioModalOpen(true); }}
                className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                영상 업로드
              </button>
            )}
          </div>

          {/* Student filter + Search (staff only) */}
          {isStaff && (
            <div className="flex flex-wrap gap-3">
              <select
                value={pfStudentFilter}
                onChange={e => setPfStudentFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 min-w-[140px]"
              >
                <option value="all">전체 학생</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="relative flex-1 min-w-[200px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  value={pfSearchQuery}
                  onChange={e => setPfSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500"
                  placeholder="제목, 학생, 태그 검색..."
                />
                {pfSearchQuery && (
                  <button onClick={() => setPfSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* === Grid View (existing behavior) === */}
          {portfolioView === 'grid' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myPortfolios.map(pf => (
                  <div
                    key={pf.id}
                    onClick={() => { setSelectedPortfolioId(pf.id); setCommentTimestamp(null); setCurrentVideoIdx(0); }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                  >
                    {/* Video Thumbnail Placeholder */}
                    <div className="aspect-video bg-slate-100 relative flex items-center justify-center overflow-hidden">
                      {pf.videoUrl ? (() => {
                        const thumbBase = pf.videoUrl.replace(/\.(mp4|mov|webm)$/i, '.thumb.jpg');
                        const thumbUrl = thumbBase.startsWith('/') ? `${API_URL}${thumbBase}` : thumbBase;
                        return (
                          <>
                            <img
                              src={thumbUrl}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <div className="relative w-14 h-14 rounded-full bg-black/30 flex items-center justify-center group-hover:bg-brand-500/80 transition-colors">
                              <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          </>
                        );
                      })() : activeUploads[pf.id]?.error ? (
                        <div className="flex flex-col items-center gap-2 text-red-400 w-full px-6" onClick={(e) => e.stopPropagation()}>
                          <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                          <span className="text-xs font-medium text-red-500">업로드 실패</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRetryUpload(pf.id); }}
                            className="text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-full"
                          >
                            다시 시도
                          </button>
                        </div>
                      ) : activeUploads[pf.id] ? (
                        <div className="flex flex-col items-center gap-2 text-slate-400 w-full px-6">
                          <svg className="w-6 h-6 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                          {activeUploads[pf.id].progress !== null ? (
                            <div className="w-full flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-brand-600">{activeUploads[pf.id].progress}%</span>
                              <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${activeUploads[pf.id].progress}%` }} />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancelUpload(pf.id); }}
                                className="text-xs font-medium text-red-400 hover:text-red-600 mt-1"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-medium">영상 압축/업로드 중</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-300" onClick={(e) => e.stopPropagation()}>
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          <span className="text-xs font-medium">영상없음</span>
                          {isStudent && pf.studentId === user.id && (
                            <label className="text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-full cursor-pointer">
                              영상 업로드
                              <input
                                type="file"
                                className="hidden"
                                accept="video/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) startPfVideoUpload(file, pf.id);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                          <span className="text-xs text-slate-300">10분 이내</span>
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
                  <p className="font-medium">{pfSearchQuery || pfStudentFilter !== 'all' ? '검색 결과가 없습니다.' : '아직 등록된 포트폴리오가 없습니다.'}</p>
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
                              onClick={() => { setSelectedPortfolioId(pf.id); setCommentTimestamp(null); setCurrentVideoIdx(0); }}
                              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group shrink-0 w-56"
                            >
                              {/* Thumbnail */}
                              <div className="aspect-video bg-slate-100 relative flex items-center justify-center overflow-hidden">
                                {pf.videoUrl && (
                                  <img
                                    src={(() => { const t = pf.videoUrl.replace(/\.(mp4|mov|webm)$/i, '.thumb.jpg'); return t.startsWith('/') ? `${API_URL}${t}` : t; })()}
                                    alt=""
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                )}
                                <div className="relative w-10 h-10 rounded-full bg-black/30 flex items-center justify-center group-hover:bg-brand-500/80 transition-colors">
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

      {/* === JOURNAL TAB === */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          {/* Header: filter + write button */}
          <div className="flex items-center justify-between">
            {isStaff ? (
              <select
                value={journalStudentFilter}
                onChange={e => setJournalStudentFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand-500 bg-white"
              >
                <option value="all">전체 학생</option>
                {allUsers.filter(u => u.role === UserRole.STUDENT).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : <div />}
            {isStudent && (
              <button
                onClick={() => { setEditingJournalId(null); setJournalTitle(''); setJournalContent(''); setIsJournalModalOpen(true); }}
                className="flex items-center gap-1.5 bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-violet-600 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                일지 쓰기
              </button>
            )}
          </div>

          {journalFeedLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : journalFeed.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <p className="text-sm">아직 작성된 연습일지가 없습니다.</p>
              {isStudent && <p className="text-xs mt-1">오늘의 연습을 기록해보세요!</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {journalFeed.map((j: Record<string, unknown>) => {
                const id = j.id as string;
                const studentName = (j.studentName || j.student_name) as string;
                const studentId = (j.studentId || j.student_id) as string;
                const title = j.title as string;
                const content = j.content as string;
                const createdAt = (j.createdAt || j.created_at) as string;
                const attachmentUrl = (j.attachmentUrl || j.attachment_url) as string | undefined;
                const canEdit = studentId === user.id || user.role !== UserRole.STUDENT;

                return (
                  <div key={id} onClick={() => setSelectedJournal(j)} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isStaff && <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">{studentName}</span>}
                        <span className="text-xs text-slate-400">{new Date(createdAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingJournalId(id); setJournalTitle(title); setJournalContent(content); setJournalAttachmentUrl(attachmentUrl || ''); setJournalAttachmentFile(null); setIsJournalModalOpen(true); }}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >수정</button>
                          <button
                            onClick={() => handleDeleteJournal(id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >삭제</button>
                        </div>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">{title}</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{content}</p>
                    {attachmentUrl && (() => {
                      const fullUrl = attachmentUrl.startsWith('/') ? `${API_URL}${attachmentUrl}` : attachmentUrl;
                      const ext = attachmentUrl.split('.').pop()?.toLowerCase() || '';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                      return (
                        <div className="mt-2">
                          {isImage ? (
                            <img src={fullUrl} alt="첨부" className="rounded-lg max-h-48 object-cover" />
                          ) : (
                            <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:text-violet-600 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                              첨부파일 보기
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Journal Detail Modal */}
      {selectedJournal && (() => {
        const sj = selectedJournal;
        const sjStudentName = (sj.studentName || sj.student_name) as string;
        const sjTitle = sj.title as string;
        const sjContent = sj.content as string;
        const sjCreatedAt = (sj.createdAt || sj.created_at) as string;
        const sjAttachment = (sj.attachmentUrl || sj.attachment_url) as string | undefined;

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedJournal(null)}>
            <div role="dialog" aria-modal="true" className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedJournal(null)} aria-label="닫기" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              {isStaff && <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">{sjStudentName}</span>}
              <h3 className="text-xl font-bold text-slate-800 mt-2 mb-2">{sjTitle}</h3>
              <span className="text-xs text-slate-400">{new Date(sjCreatedAt).toLocaleDateString('ko-KR')}</span>
              <div className="mt-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{sjContent}</div>
              {sjAttachment && (() => {
                const fullUrl = sjAttachment.startsWith('/') ? `${API_URL}${sjAttachment}` : sjAttachment;
                const ext = sjAttachment.split('.').pop()?.toLowerCase() || '';
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                return (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {isImage ? (
                      <img src={fullUrl} alt="첨부" className="rounded-xl max-h-64 object-cover w-full" />
                    ) : (
                      <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-500 hover:text-violet-600 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        첨부파일 보기
                      </a>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Journal Write/Edit Modal */}
      {isJournalModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsJournalModalOpen(false)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setIsJournalModalOpen(false)} aria-label="닫기" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-800 mb-6">{editingJournalId ? '연습일지 수정' : '연습일지 쓰기'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">제목</label>
                <input
                  value={journalTitle}
                  onChange={e => setJournalTitle(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-violet-500"
                  placeholder="예: 셰익스피어 독백 연습"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">내용</label>
                <textarea
                  value={journalContent}
                  onChange={e => setJournalContent(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-violet-500 resize-none"
                  rows={6}
                  placeholder="오늘 연습한 내용, 느낀 점, 어려웠던 부분 등을 자유롭게 적어보세요."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">사진/파일 첨부 (선택)</label>
                {journalAttachmentFile || journalAttachmentUrl ? (
                  <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-2.5">
                    <svg className="w-4 h-4 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    <span className="text-xs font-medium text-violet-700 truncate flex-1">{journalAttachmentFile?.name || '첨부파일'}</span>
                    <button onClick={() => { setJournalAttachmentFile(null); setJournalAttachmentUrl(''); }} className="text-xs text-red-400 hover:text-red-600 shrink-0">삭제</button>
                  </div>
                ) : (
                  <label className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-violet-300 transition-colors">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    <span className="text-xs font-bold text-slate-500">사진 또는 파일 선택</span>
                    <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={e => { const f = e.target.files?.[0]; if (f) setJournalAttachmentFile(f); }} />
                  </label>
                )}
              </div>
              <button
                onClick={handleSaveJournal}
                disabled={!journalTitle.trim() || !journalContent.trim() || isJournalSaving || isJournalAttachmentUploading}
                className="w-full bg-violet-500 text-white py-3 rounded-xl font-bold hover:bg-violet-600 transition-colors shadow-lg shadow-violet-200 disabled:opacity-50"
              >
                {isJournalAttachmentUploading ? '파일 업로드 중...' : isJournalSaving ? '저장 중...' : editingJournalId ? '수정하기' : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === COMPETITION TAB === */}
      {activeTab === 'competition' && (
        <div className="space-y-4">
          {/* Header: search + view toggle + add */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[160px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                value={eventSearchQuery}
                onChange={e => setEventSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500"
                placeholder="행사명, 장소 검색..."
              />
              {eventSearchQuery && (
                <button onClick={() => setEventSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <div className="flex bg-slate-100 rounded-lg p-0.5 shrink-0">
              <button onClick={() => setEventViewMode('calendar')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${eventViewMode === 'calendar' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>
                달력
              </button>
              <button onClick={() => setEventViewMode('list')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${eventViewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>
                목록
              </button>
            </div>
            {isStaff && (
              <button
                onClick={handleOpenCreateEvent}
                className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                행사 등록
              </button>
            )}
          </div>

          {/* Calendar Legend */}
          {eventViewMode === 'calendar' && (
            <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-500 inline-block" /> 행사일</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> 접수기간</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> 마감임박</span>
            </div>
          )}

          {/* Calendar View */}
          {eventViewMode === 'calendar' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {/* Month navigation */}
              <div className="flex items-center justify-between p-3 border-b border-slate-100">
                <button onClick={handleEventPrevMonth} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800">{eventCalYear}년 {eventCalMonth + 1}월</h3>
                  <button onClick={handleEventToday} className="text-xs text-brand-500 hover:text-brand-600 font-bold px-2 py-0.5 rounded bg-brand-50">오늘</button>
                </div>
                <button onClick={handleEventNextMonth} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              {/* Day headers */}
              <div className="grid grid-cols-7">
                {['일','월','화','수','목','금','토'].map(day => (
                  <div key={day} className="text-center text-xs font-bold text-slate-400 py-2 border-b border-slate-50">{day}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {renderEventCalendarDays()}
              </div>
            </div>
          )}

          {/* Selected date events (calendar mode) */}
          {eventViewMode === 'calendar' && eventSelectedDate && (
            <div>
              <h3 className="font-bold text-sm text-slate-500 mb-3">{eventSelectedDate} 일정</h3>
              {selectedDateEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateEvents.map(ev => {
                    const evDateStr = ev.date?.split('T')[0];
                    const isEventDay = evDateStr === eventSelectedDate;
                    const isRegDay = ev.registrationStart && ev.registrationEnd && eventSelectedDate >= ev.registrationStart && eventSelectedDate <= ev.registrationEnd;
                    return (
                      <div key={ev.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800">{ev.title}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                              <span>{ev.location}</span>
                              {isEventDay && <span className="text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-bold">행사일</span>}
                              {isRegDay && <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-bold">접수기간</span>}
                            </div>
                            {(ev.registrationStart || ev.registrationEnd) && (
                              <p className="text-xs text-slate-500 mt-1">접수: {ev.registrationStart || '?'} ~ {ev.registrationEnd || '?'}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isStaff && (
                              <>
                                <button onClick={() => handleOpenEditEvent(ev)} className="text-xs text-slate-400 hover:text-brand-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center">수정</button>
                                <button onClick={() => setDeleteEventId(ev.id)} className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center">삭제</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">이 날짜에 등록된 일정이 없습니다.</p>
              )}
            </div>
          )}

          {/* List View */}
          {eventViewMode === 'list' && (
            <div className="space-y-6">
              {/* Upcoming */}
              {upcomingEvents.length > 0 && (
                <div>
                  <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-3">다가오는 대회·행사</h3>
                  <div className="space-y-4">
                    {upcomingEvents.map(ev => {
                      const total = ev.checklist.length;
                      const done = ev.checklist.filter(c => c.completed).length;
                      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                      const daysToEvent = Math.max(0, Math.ceil((new Date(ev.date).getTime() - Date.now()) / 86400000));

                      // 접수기간 상태 계산
                      const today = new Date().toISOString().split('T')[0];
                      const regStart = ev.registrationStart;
                      const regEnd = ev.registrationEnd;
                      const hasRegPeriod = regStart || regEnd;
                      let regStatus: 'before' | 'open' | 'closed' = 'before';
                      let daysToRegEnd = 0;
                      let daysToRegStart = 0;
                      if (regStart && regEnd) {
                        if (today < regStart) { regStatus = 'before'; daysToRegStart = Math.ceil((new Date(regStart).getTime() - Date.now()) / 86400000); }
                        else if (today <= regEnd) { regStatus = 'open'; daysToRegEnd = Math.ceil((new Date(regEnd).getTime() - Date.now()) / 86400000); }
                        else { regStatus = 'closed'; }
                      } else if (regEnd) {
                        if (today <= regEnd) { regStatus = 'open'; daysToRegEnd = Math.ceil((new Date(regEnd).getTime() - Date.now()) / 86400000); }
                        else { regStatus = 'closed'; }
                      }

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
                              {hasRegPeriod && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-slate-500">접수: {regStart || '?'} ~ {regEnd || '?'}</span>
                                  {regStatus === 'before' && <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">접수시작 D-{daysToRegStart}</span>}
                                  {regStatus === 'open' && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${daysToRegEnd <= 3 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>{daysToRegEnd === 0 ? '오늘 마감!' : `마감 D-${daysToRegEnd}`}</span>}
                                  {regStatus === 'closed' && <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">접수마감</span>}
                                </div>
                              )}
                              {ev.description && <p className="text-sm text-slate-500 mt-2">{ev.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isStaff && (
                                <>
                                  <button onClick={() => handleOpenEditEvent(ev)} className="text-xs text-slate-400 hover:text-brand-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center">수정</button>
                                  <button onClick={() => setDeleteEventId(ev.id)} className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center">삭제</button>
                                </>
                              )}
                              <span className="bg-brand-100 text-brand-600 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">D-{daysToEvent}</span>
                            </div>
                          </div>

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

                          <div className="space-y-2">
                            {ev.checklist.map(item => (
                              <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                <input type="checkbox" checked={item.completed} onChange={() => handleToggleChecklist(ev.id, item.id)} className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500 border-gray-300" />
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
                            <p className="text-xs text-slate-400">
                              {ev.date} • {ev.location}
                              {(ev.registrationStart || ev.registrationEnd) && (
                                <span className="ml-2">| 접수: {ev.registrationStart || '?'} ~ {ev.registrationEnd || '?'}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isStaff && (
                              <button onClick={() => setDeleteEventId(ev.id)} className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center">삭제</button>
                            )}
                            <span className="bg-green-100 text-green-600 text-xs font-bold px-2 py-1 rounded-full">완료</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredEvents.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <p className="font-medium">{eventSearchQuery ? '검색 결과가 없습니다.' : '등록된 대회/행사가 없습니다.'}</p>
                </div>
              )}
            </div>
          )}

          {/* Calendar mode: no events at all */}
          {eventViewMode === 'calendar' && !eventSelectedDate && events.length === 0 && (
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

            {/* Video Player — swipe for multiple videos */}
            {(() => {
              // Combine legacy videoUrl + portfolio_videos into single list
              const allVideos: { url: string; id?: string }[] = [];
              if (selectedPortfolio.videoUrl) {
                allVideos.push({ url: selectedPortfolio.videoUrl });
              }
              for (const v of (selectedPortfolio.videos || [])) {
                if (!selectedPortfolio.videoUrl || v.videoUrl !== selectedPortfolio.videoUrl) {
                  allVideos.push({ url: v.videoUrl, id: v.id });
                }
              }
              const safeIdx = Math.min(currentVideoIdx, Math.max(allVideos.length - 1, 0));
              const currentVideo = allVideos[safeIdx];

              return (
                <div className="mb-4">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
                    {currentVideo ? (
                      <>
                        <video
                          ref={videoRef}
                          key={currentVideo.url}
                          src={currentVideo.url.startsWith('/') ? `${API_URL}${currentVideo.url}` : currentVideo.url}
                          controls
                          className="w-full h-full object-contain"
                          preload="metadata"
                        />
                        {/* Navigation arrows */}
                        {allVideos.length > 1 && (
                          <>
                            {safeIdx > 0 && (
                              <button onClick={() => setCurrentVideoIdx(safeIdx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                              </button>
                            )}
                            {safeIdx < allVideos.length - 1 && (
                              <button onClick={() => setCurrentVideoIdx(safeIdx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </button>
                            )}
                          </>
                        )}
                      </>
                    ) : activeUploads[selectedPortfolio.id] && !activeUploads[selectedPortfolio.id].error ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-3">
                        <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                        <span className="text-sm">업로드 중... {activeUploads[selectedPortfolio.id].progress !== null ? `${activeUploads[selectedPortfolio.id].progress}%` : ''}</span>
                        <button onClick={() => handleCancelUpload(selectedPortfolio.id)} className="text-xs text-red-300 hover:text-red-400 mt-1">취소</button>
                      </div>
                    ) : activeUploads[selectedPortfolio.id]?.error ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-red-300 gap-3">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                        <span className="text-sm">{activeUploads[selectedPortfolio.id].error}</span>
                        <button onClick={() => handleRetryUpload(selectedPortfolio.id)} className="text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 px-4 py-1.5 rounded-full">다시 시도</button>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-3">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        <span className="text-sm">영상이 없습니다</span>
                      </div>
                    )}
                  </div>
                  {/* Dot indicators + add button */}
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {allVideos.length > 1 && allVideos.map((_, i) => (
                      <button key={i} onClick={() => setCurrentVideoIdx(i)} className={`w-2 h-2 rounded-full transition-colors ${i === safeIdx ? 'bg-brand-500' : 'bg-slate-300'}`} />
                    ))}
                    {(isStudent && selectedPortfolio.studentId === user.id || user.role !== UserRole.STUDENT) && (
                      <label className="ml-2 flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 cursor-pointer font-bold">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        영상 추가
                        <input type="file" className="hidden" accept="video/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && selectedPortfolio) {
                            // Upload then add to portfolio videos
                            const uploadPromise = uploadApi.upload(file, undefined, 'portfolios', 'portfolio', selectedPortfolio.id);
                            uploadPromise.then(async (result) => {
                              await portfolioApi.addVideo(selectedPortfolio.id, result.url);
                              // Refresh portfolio data
                              const updated = await portfolioApi.get(selectedPortfolio.id);
                              setPortfolios(prev => prev.map(p => p.id === selectedPortfolio.id ? updated : p));
                              toast.success('영상이 추가되었습니다.');
                            }).catch(() => toast.error('영상 추가에 실패했습니다.'));
                          }
                        }} />
                      </label>
                    )}
                  </div>
                </div>
              );
            })()}

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
              <div className="space-y-2">
                {commentTimestamp != null && (
                  <div className="flex items-center gap-2">
                    <span className="bg-brand-100 text-brand-600 text-xs font-bold px-2 py-0.5 rounded-md">
                      {formatTimestamp(commentTimestamp)}
                    </span>
                    <button onClick={() => setCommentTimestamp(null)} className="text-xs text-slate-400 hover:text-slate-600">삭제</button>
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
              {/* Video files (multiple) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">영상 파일 <span className="text-red-400">*</span></label>
                <input ref={pfVideoInputRef} type="file" className="hidden" accept="video/*" multiple onChange={handlePfVideoUpload} />
                {newPfVideoFiles.length > 0 ? (
                  <div className="space-y-2">
                    {newPfVideoFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 p-2.5">
                        <svg className="w-4 h-4 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        <span className="text-xs font-medium text-brand-700 truncate flex-1">{f.name}</span>
                        <span className="text-[10px] text-brand-400">{(f.size / 1024 / 1024).toFixed(0)}MB</span>
                      </div>
                    ))}
                    <button onClick={() => setNewPfVideoFiles([])} className="text-xs text-red-400 hover:text-red-600">전체 삭제</button>
                  </div>
                ) : (
                  <button
                    onClick={() => pfVideoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-brand-300 transition-colors"
                  >
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <span className="text-xs font-bold text-slate-500">클릭하여 영상을 선택하세요 (여러 개 가능)</span>
                  </button>
                )}
                <p className="text-xs text-slate-400 mt-1">10분 이내 영상 권장 (최대 1.5GB) · 여러 영상 동시 선택 가능</p>
              </div>

              {/* Upload mode toggle (only when 2+ videos) */}
              {newPfVideoFiles.length > 1 && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 mb-2">영상 {newPfVideoFiles.length}개 업로드 방식</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPfUploadMode('single')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors ${pfUploadMode === 'single' ? 'bg-brand-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300'}`}
                    >
                      하나의 포트폴리오에 모아서
                    </button>
                    <button
                      onClick={() => setPfUploadMode('individual')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors ${pfUploadMode === 'individual' ? 'bg-brand-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300'}`}
                    >
                      영상별 따로 생성
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {pfUploadMode === 'single'
                      ? '제목 1개 + 영상 여러 개가 하나의 포트폴리오에 들어갑니다.'
                      : '영상마다 개별 포트폴리오가 생성됩니다. (자동 번호 부여)'}
                  </p>
                </div>
              )}

              {/* Titles */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-500">제목 <span className="text-red-400">*</span></label>
                  {pfUploadMode === 'individual' && newPfVideoFiles.length > 1 && newPfTitles.length === 1 && (
                    <button
                      onClick={() => setNewPfTitles(newPfVideoFiles.map((_, i) => newPfTitles[0] ? `${newPfTitles[0]} (${i + 1})` : ''))}
                      className="text-[10px] text-brand-500 hover:text-brand-600 font-bold"
                    >영상별 제목 설정</button>
                  )}
                  {pfUploadMode === 'individual' && newPfTitles.length > 1 && (
                    <button
                      onClick={() => setNewPfTitles([newPfTitles[0] || ''])}
                      className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                    >하나로 합치기</button>
                  )}
                </div>
                {newPfTitles.length === 1 ? (
                  <input
                    value={newPfTitles[0]}
                    onChange={e => setNewPfTitles([e.target.value])}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
                    placeholder={newPfVideoFiles.length > 1 ? '공통 제목 (자동 번호 부여)' : '예: 햄릿 독백 연기'}
                  />
                ) : (
                  <div className="space-y-2">
                    {newPfTitles.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-5 text-center shrink-0">{i + 1}</span>
                        <input
                          value={t}
                          onChange={e => setNewPfTitles(prev => prev.map((p, j) => j === i ? e.target.value : p))}
                          className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 text-sm"
                          placeholder={newPfVideoFiles[i]?.name || `제목 ${i + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {newPfVideoFiles.length > 1 && newPfTitles.length === 1 && (
                  <p className="text-xs text-slate-400 mt-1">영상 {newPfVideoFiles.length}개에 같은 제목이 자동 번호와 함께 적용됩니다.</p>
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
                <label htmlFor="input-event-date" className="block text-xs font-bold text-slate-500 mb-1">행사/시험 날짜 <span className="text-red-400">*</span></label>
                <input id="input-event-date" type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                <p className="text-xs font-bold text-amber-700">접수기간 (선택)</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label htmlFor="input-event-reg-start" className="block text-xs text-slate-500 mb-1">접수 시작</label>
                    <input id="input-event-reg-start" type="date" value={newEventRegStart} onChange={e => setNewEventRegStart(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-brand-500 text-sm" />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="input-event-reg-end" className="block text-xs text-slate-500 mb-1">접수 마감</label>
                    <input id="input-event-reg-end" type="date" value={newEventRegEnd} onChange={e => setNewEventRegEnd(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-brand-500 text-sm" />
                  </div>
                </div>
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
