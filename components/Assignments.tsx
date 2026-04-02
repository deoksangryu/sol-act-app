
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Assignment, User, UserRole, ClassInfo } from '../types';
import { assignmentApi, uploadApi, API_URL, type UploadPhase } from '../services/api';
import toast from 'react-hot-toast';
import { useDataRefresh } from '../services/useWebSocket';
import { ConfirmDialog } from './ConfirmDialog';
import { useUpload } from '../services/UploadContext';
import { useAppData } from '../services/AppContext';

function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const VIDEO_EXTS = ['.mp4', '.mov', '.webm'];
function isVideoUrl(url: string): boolean {
  return VIDEO_EXTS.some(ext => url.toLowerCase().endsWith(ext));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

const GRADE_OPTIONS = ['S', 'A', 'B', 'C', 'D'];
const GRADE_COLORS: Record<string, string> = {
  S: 'bg-yellow-400 text-yellow-900',
  A: 'bg-green-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-brand-500 text-white',
  D: 'bg-red-500 text-white',
};

interface AssignmentsProps {
  user: User;
}

export const Assignments: React.FC<AssignmentsProps> = ({ user }) => {
  const { allUsers, classes } = useAppData();
  const { startUpload: globalStartUpload, updateProgress: globalUpdateProgress, updatePhase: globalUpdatePhase, finishUpload: globalFinishUpload } = useUpload();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('uploading');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks assignment ID pending a background file upload (async pattern)
  const pendingFileAssignmentIdRef = useRef<string | null>(null);

  // Grading state (for staff)
  const [gradeValue, setGradeValue] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [isGrading, setIsGrading] = useState(false);

  // View Mode State
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Filter State (for staff)
  const [filterStudentId, setFilterStudentId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');

  // Create/Edit Assignment State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [assignTarget, setAssignTarget] = useState<'student' | 'class'>('student');
  const [newClassId, setNewClassId] = useState('');

  // Attachment State (teacher file for assignment)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Delete Assignment State
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(null);

  // Attachment fullscreen preview (image only; PDF opens in new tab)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const selectedAssignment = assignments.find(a => a.id === selectedId);

  const isStudent = user.role === UserRole.STUDENT;
  const isStaff = !isStudent;

  // Reset grading state when selecting a different assignment
  useEffect(() => {
    if (selectedAssignment) {
      setGradeValue(selectedAssignment.grade || '');
      setFeedbackText(selectedAssignment.feedback || '');
    }
    setUploadFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  }, [selectedId]);

  // Load assignments from API
  const loadData = useCallback(() => {
    const params: any = {};
    if (isStudent) {
      params.studentId = user.id;
    } else {
      if (filterStudentId) params.studentId = filterStudentId;
      if (filterTeacherId) params.assignedBy = filterTeacherId;
    }
    return assignmentApi.list(params).then(setAssignments).catch((err) => {
      console.error('Failed to load assignments:', err);
      toast.error(err.message || '과제를 불러오지 못했습니다.');
    });
  }, [user.id, filterStudentId, filterTeacherId, isStudent]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  useDataRefresh('assignments', loadData);

  // ESC key handler for modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreateModalOpen) { setIsCreateModalOpen(false); setEditingAssignment(null); return; }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isCreateModalOpen]);

  // Warn before page close when upload is in progress
  useEffect(() => {
    if (!isUploading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isUploading]);

  // --- Calendar Logic ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(toLocalDateStr(today));
  };

  const renderCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 md:h-20 bg-slate-50/30 border border-slate-50"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayAssignments = assignments.filter(a => a.dueDate?.startsWith(dateStr));
      const isSelected = selectedDate === dateStr;
      const hasAssignments = dayAssignments.length > 0;
      const allCompleted = hasAssignments && dayAssignments.every(a => a.status === 'submitted' || a.status === 'graded');

      days.push(
        <div
          key={d}
          onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
          className={`h-16 md:h-20 border border-slate-50 p-1 relative cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-brand-50 ring-1 ring-brand-200 z-10' : 'bg-white'}`}
        >
          <div className={`text-xs font-bold mb-1 ${isSelected ? 'text-brand-600' : 'text-slate-700'}`}>
            {d}
          </div>
          <div className="flex flex-wrap gap-1 content-start">
            {dayAssignments.map(a => (
              <div
                key={a.id}
                className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                  a.status === 'graded' ? 'bg-green-500' :
                  a.status === 'submitted' ? 'bg-blue-400' : 'bg-brand-400'
                }`}
                title={a.title}
              />
            ))}
          </div>
          {allCompleted && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-80 pointer-events-none">
              <div className="w-8 h-8 md:w-12 md:h-12 border-2 border-green-500 rounded-full flex items-center justify-center -rotate-12">
                 <div className="text-[6px] md:text-[8px] font-black text-green-600 uppercase text-center leading-none">
                   Very<br/>Good
                 </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const filteredAssignments = assignments.filter(a => {
    if (viewMode === 'calendar' && selectedDate) {
      return a.dueDate?.startsWith(selectedDate);
    }
    return true;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadProgress(0);
  };

  const handleRemoveFile = () => {
    setUploadFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (id: string) => {
    try {
      // Submit immediately (without waiting for file upload)
      const submitted = await assignmentApi.submit(id, {
        submissionText: submissionText || '(파일 첨부 중)',
        submissionFileUrl: undefined,
      });
      setAssignments(prev => prev.map(a => a.id === id ? submitted : a));
      setSubmissionText('');
      toast.success('과제가 제출되었습니다.');

      // If a file was selected, upload it in the background and patch when done
      if (uploadFile) {
        const fileToUpload = uploadFile;
        setUploadFile(null);
        setUploadProgress(0);
        setIsUploading(true);
        pendingFileAssignmentIdRef.current = id;
        globalStartUpload(id, `파일 업로드: ${fileToUpload.name}`);

        // Pass target_type + target_id so server patches DB directly on upload completion
        // This ensures the file URL is saved even if the client disconnects before the patch call
        uploadApi.upload(fileToUpload, (pct) => { setUploadProgress(pct); globalUpdateProgress(id, pct); }, 'assignments', 'assignment', id, (phase, pct) => {
          setUploadPhase(phase);
          globalUpdatePhase(id, phase, pct);
        }).then(async (result) => {
          const pendingId = pendingFileAssignmentIdRef.current;
          if (pendingId) {
            pendingFileAssignmentIdRef.current = null;
            const patched = await assignmentApi.patchFile(pendingId, result.url);
            setAssignments(prev => prev.map(a => a.id === pendingId ? patched : a));
            toast.success('파일이 과제에 첨부되었습니다.');
          }
        }).catch((err: any) => {
          toast.error(err.message || '파일 업로드에 실패했습니다.');
          pendingFileAssignmentIdRef.current = null;
        }).finally(() => {
          setIsUploading(false);
          setUploadProgress(0);
          globalFinishUpload(id);
        });
      }
    } catch {
      toast.error('과제 제출에 실패했습니다.');
    }
  };

  const handleGrade = async (id: string) => {
    if (!gradeValue || !feedbackText.trim()) {
      toast.error('등급과 피드백을 모두 입력해주세요.');
      return;
    }
    setIsGrading(true);
    try {
      const updated = await assignmentApi.grade(id, { grade: gradeValue, feedback: feedbackText });
      setAssignments(prev => prev.map(a => a.id === id ? updated : a));
      toast.success('채점이 완료되었습니다.');
    } catch {
      toast.error('채점에 실패했습니다.');
    } finally {
      setIsGrading(false);
    }
  };

  const handleCreateAssignment = async () => {
    if (!newTitle.trim()) return;
    if (assignTarget === 'student' && !newStudentId) return;
    if (assignTarget === 'class' && !newClassId) return;
    try {
      // Upload attachment first if selected
      let uploadedAttachmentUrl = attachmentUrl;
      if (attachmentFile && !attachmentUrl) {
        setIsAttachmentUploading(true);
        try {
          const result = await uploadApi.upload(attachmentFile, undefined, 'assignments');
          uploadedAttachmentUrl = result.url;
        } catch {
          toast.error('첨부파일 업로드에 실패했습니다.');
          setIsAttachmentUploading(false);
          return;
        }
        setIsAttachmentUploading(false);
      }

      const payload: any = {
        title: newTitle,
        description: newDesc || '추가 설명 없음',
        dueDate: newDate || toLocalDateStr(new Date()),
        attachmentUrl: uploadedAttachmentUrl || undefined,
      };
      if (assignTarget === 'class') {
        payload.classId = newClassId;
      } else {
        payload.studentId = newStudentId;
      }
      const newAsgns = await assignmentApi.create(payload);
      setAssignments([...newAsgns, ...assignments]);
      setIsCreateModalOpen(false);
      setNewTitle(''); setNewDesc(''); setNewDate(''); setNewStudentId(''); setNewClassId('');
      setAttachmentFile(null); setAttachmentUrl('');
      toast.success(`과제가 ${newAsgns.length}명에게 등록되었습니다.`);
    } catch { toast.error('과제 등록에 실패했습니다.'); }
  };

  const handleOpenCreateModal = () => {
    setEditingAssignment(null);
    setNewTitle(''); setNewDesc(''); setNewDate(''); setNewStudentId(''); setNewClassId('');
    setAttachmentFile(null); setAttachmentUrl('');
    setAssignTarget('student');
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (a: Assignment) => {
    setEditingAssignment(a);
    setNewTitle(a.title);
    setNewDesc(a.description || '');
    setNewDate(a.dueDate || '');
    setNewStudentId(a.studentId || '');
    setIsCreateModalOpen(true);
  };

  const handleUpdateAssignment = async () => {
    if (!editingAssignment || !newTitle.trim()) return;
    try {
      const updated = await assignmentApi.update(editingAssignment.id, {
        title: newTitle,
        description: newDesc || '추가 설명 없음',
        dueDate: newDate || editingAssignment.dueDate,
      });
      setAssignments(prev => prev.map(a => a.id === editingAssignment.id ? updated : a));
      setIsCreateModalOpen(false);
      setEditingAssignment(null);
      toast.success('과제가 수정되었습니다.');
    } catch { toast.error('과제 수정에 실패했습니다.'); }
  };

  const handleDeleteAssignment = async () => {
    if (!deleteAssignmentId) return;
    try {
      await assignmentApi.delete(deleteAssignmentId);
      setAssignments(prev => prev.filter(a => a.id !== deleteAssignmentId));
      if (selectedId === deleteAssignmentId) setSelectedId(null);
      setDeleteAssignmentId(null);
      toast.success('과제가 삭제되었습니다.');
    } catch { toast.error('과제 삭제에 실패했습니다.'); }
  };

  const handleAiFeedback = async () => {
    if (!selectedAssignment?.submissionText) return;
    setIsAnalyzing(true);
    try {
      const result = await assignmentApi.analyze(selectedAssignment.id);
      setAssignments(prev => prev.map(a =>
        a.id === selectedId ? { ...a, aiAnalysis: result.aiAnalysis } : a
      ));
      toast.success('AI 분석이 완료되었습니다.');
    } catch { toast.error('AI 분석 중 오류가 발생했습니다.'); }
    finally { setIsAnalyzing(false); }
  };

  // Render file attachment area for submitted assignments
  const renderFileAttachment = (fileUrl: string) => {
    const fullUrl = `${API_URL}${fileUrl}`;
    if (isVideoUrl(fileUrl)) {
      return (
        <div className="mt-3">
          <video
            src={fullUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[400px] rounded-xl bg-black"
          />
        </div>
      );
    }
    // Non-video file — show download link
    const filename = fileUrl.split('/').pop() || '첨부파일';
    return (
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 text-xs text-blue-500 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        {filename.length > 30 ? filename.slice(0, 30) + '...' : filename}
      </a>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-4 md:gap-6 h-full min-h-0">
      {/* Left Column: Calendar/List Toggle + Content */}
      <div className={`md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full ${selectedId ? 'hidden md:flex' : 'flex'}`}>

        {/* Header Controls */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-800">과제 관리</h2>
            {isStaff && (
              <button
                onClick={handleOpenCreateModal}
                className="text-xs flex items-center gap-1 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-brand-50 hover:text-brand-500 hover:border-brand-200 transition-colors shadow-sm"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="font-bold">과제 부여</span>
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="bg-slate-200/50 p-1 rounded-xl flex text-xs font-bold">
            <button
              onClick={() => { setViewMode('calendar'); setSelectedDate(null); }}
              className={`flex-1 py-2.5 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              달력 보기
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 py-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              목록 보기
            </button>
          </div>

          {/* Filter Dropdowns for Staff */}
          {isStaff && (
            <div className="flex gap-2 items-center">
              <select
                value={filterStudentId}
                onChange={(e) => setFilterStudentId(e.target.value)}
                className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg flex-1"
              >
                <option value="">전체 학생</option>
                {allUsers.filter(u => u.role === UserRole.STUDENT).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {user.role === UserRole.DIRECTOR && (
                <select
                  value={filterTeacherId}
                  onChange={(e) => setFilterTeacherId(e.target.value)}
                  className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg flex-1"
                >
                  <option value="">전체 선생님</option>
                  {allUsers.filter(u => u.role === UserRole.TEACHER).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

          {/* CALENDAR VIEW */}
          {viewMode === 'calendar' && (
            <div className="p-2 animate-fade-in">
              <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={handlePrevMonth} className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="text-center cursor-pointer hover:bg-slate-50 px-3 py-1 rounded-lg" onClick={handleToday}>
                  <h3 className="text-sm font-bold text-slate-800">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h3>
                  {selectedDate && <p className="text-xs text-brand-500">선택됨: {selectedDate}</p>}
                </div>
                <button onClick={handleNextMonth} className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-7 mb-1 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                  <div key={day} className="text-xs font-bold text-slate-400 uppercase">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 bg-slate-100 gap-px border border-slate-100 rounded-lg overflow-hidden">
                {renderCalendarDays()}
              </div>

              <div className="mt-4 px-2 flex justify-between items-center text-xs text-slate-400">
                <div className="flex gap-2">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-brand-400"></div>진행중</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>완료</span>
                </div>
                {selectedDate && (
                  <button onClick={() => setSelectedDate(null)} className="text-slate-500 hover:text-brand-500 underline">
                    전체 보기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* LIST (Filtered) */}
          <div className={`p-2 space-y-2 ${viewMode === 'calendar' ? 'border-t border-slate-100 bg-slate-50/50 flex-1 min-h-0' : ''}`}>
             {viewMode === 'calendar' && <h4 className="px-2 pt-2 text-xs font-bold text-slate-500">{selectedDate ? `${selectedDate} 과제` : '전체 과제 목록'}</h4>}

             {filteredAssignments.length > 0 ? filteredAssignments.map(a => (
              <div
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${
                  selectedId === a.id
                    ? 'bg-brand-50 border-brand-200 ring-1 ring-brand-200'
                    : 'bg-white border-transparent hover:bg-slate-50 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${
                    a.status === 'submitted' ? 'bg-blue-100 text-blue-600' :
                    a.status === 'graded' ? 'bg-green-100 text-green-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {a.status === 'submitted' ? '제출완료' : a.status === 'graded' ? '채점완료' : '미제출'}
                  </span>
                  <span className="text-xs text-slate-400">{a.dueDate}</span>
                </div>
                <h3 className="font-bold text-slate-700 text-sm truncate">{a.title}</h3>
                {isStaff && <p className="text-xs text-slate-400 mt-1">{a.studentName}</p>}
                {isStudent && a.status === 'pending' && (
                  <div className="mt-2 flex items-center gap-1.5 text-brand-500">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <span className="text-xs font-bold">탭하여 제출하기</span>
                  </div>
                )}
              </div>
            )) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                해당 날짜에 과제가 없습니다.
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Right Column: Detail View */}
      <div className={`md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full ${selectedId ? 'flex' : 'hidden md:flex'}`}>
        {selectedAssignment ? (
          <div className="flex flex-col h-full animate-fade-in min-h-0">
            <div className="p-6 border-b border-slate-100 flex items-start gap-4 shrink-0">
               <button
                  onClick={() => setSelectedId(null)}
                  className="md:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
               >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
               </button>

               <div className="flex-1">
                  <div className="flex justify-between items-start">
                     <div>
                        <h2 className="text-xl font-bold text-slate-800">{selectedAssignment.title}</h2>
                        <p className="text-slate-500 mt-2 text-sm leading-relaxed">{selectedAssignment.description}</p>
                     </div>
                     <div className="text-right shrink-0">
                        <span className="block text-xs font-bold text-slate-400">마감일</span>
                        <span className="block text-sm font-bold text-brand-500">{selectedAssignment.dueDate}</span>
                     </div>
                  </div>

                  {/* 선생님 첨부자료 미리보기 */}
                  {selectedAssignment.attachmentUrl && (() => {
                    const url = selectedAssignment.attachmentUrl.startsWith('/') ? `${API_URL}${selectedAssignment.attachmentUrl}` : selectedAssignment.attachmentUrl;
                    const ext = url.split('.').pop()?.toLowerCase() || '';
                    const isPdf = ext === 'pdf';
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                    return (
                      <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          <span className="text-xs font-medium text-slate-500">첨부 자료</span>
                        </div>
                        {isPdf ? (
                          <div className="relative cursor-pointer" onClick={() => window.open(url, '_blank', 'noopener')}>
                            <iframe
                              src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
                              className="w-full h-96 pointer-events-none"
                              style={{ userSelect: 'none' }}
                            />
                            <div className="absolute inset-0" />
                            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">터치하여 크게 보기</div>
                          </div>
                        ) : isImage ? (
                          <div className="cursor-pointer" onClick={() => setFullscreenImage(url)}>
                            <img
                              src={url}
                              alt="첨부 자료"
                              className="w-full max-h-96 object-contain"
                              draggable={false}
                              style={{ userSelect: 'none', WebkitUserDrag: 'none' } as any}
                            />
                            <div className="text-center py-1 bg-slate-50 text-xs text-slate-400">터치하여 크게 보기</div>
                          </div>
                        ) : (
                          <div className="p-4 text-center text-sm text-slate-400">
                            첨부파일이 있습니다 (미리보기 미지원 형식)
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {isStaff && selectedAssignment.status === 'pending' && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleOpenEditModal(selectedAssignment)}
                        className="text-xs text-slate-400 hover:text-brand-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >수정</button>
                      <button
                        onClick={() => setDeleteAssignmentId(selectedAssignment.id)}
                        className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >삭제</button>
                    </div>
                  )}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Submission Area — Student pending */}
              <div>
                <h3 className="font-bold text-sm text-slate-700 mb-2">제출 내용</h3>
                {selectedAssignment.status === 'pending' && !isStaff ? (
                  <div className="space-y-3">
                    <textarea
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm resize-none h-32"
                      placeholder="과제 내용을 입력하거나 메모를 남겨주세요..."
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                    />

                    {/* File Upload Area */}
                    {!uploadFile ? (
                      <label className="flex items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-brand-300 transition-colors">
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".mp4,.mov,.webm,.mp3,.m4a,.wav,.pdf,.jpg,.jpeg,.png"
                          onChange={handleFileSelect}
                        />
                        <div className="text-center">
                          <svg className="w-8 h-8 text-slate-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          <span className="text-xs text-slate-500 block">파일 첨부 (영상/문서)</span>
                          <span className="text-xs text-slate-400">MP4, MOV, WebM, MP3, M4A, WAV, PDF, JPG, PNG</span>
                          <span className="text-xs text-slate-300 block mt-0.5">영상은 10분 이내 권장 (최대 1.5GB)</span>
                        </div>
                      </label>
                    ) : (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-5 h-5 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {isVideoUrl(uploadFile.name) ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              )}
                            </svg>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate">{uploadFile.name}</p>
                              <p className="text-xs text-slate-400">{formatFileSize(uploadFile.size)}</p>
                            </div>
                          </div>
                          {!isUploading && (
                            <button onClick={handleRemoveFile} aria-label="파일 삭제" className="p-1 text-slate-400 hover:text-red-500 shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                        {/* Upload progress bar */}
                        {isUploading && (
                          <div className="mt-2">
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-brand-400 to-brand-500 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <p className="text-xs text-brand-500 font-bold mt-1 text-right">{uploadProgress}%</p>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => handleSubmit(selectedAssignment.id)}
                      disabled={!submissionText.trim() && !uploadFile}
                      className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-md shadow-brand-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      과제 제출하기
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                    {selectedAssignment.submissionText && (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {selectedAssignment.submissionText}
                      </p>
                    )}
                    {!selectedAssignment.submissionText && !selectedAssignment.submissionFileUrl && (
                      <p className="text-sm text-slate-400">아직 제출된 내용이 없습니다.</p>
                    )}

                    {/* Video player or file link */}
                    {selectedAssignment.submissionFileUrl
                      ? renderFileAttachment(selectedAssignment.submissionFileUrl)
                      : pendingFileAssignmentIdRef.current === selectedAssignment.id && isUploading ? (
                        <div className="mt-3 flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            <span>
                              {uploadPhase === 'compressing'
                                ? '영상 최적화 중... 완료될 때까지 앱을 유지해주세요'
                                : `파일 업로드 중 ${uploadProgress}% — 완료될 때까지 앱을 유지해주세요`}
                            </span>
                          </div>
                          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-300 ${uploadPhase === 'compressing' ? 'bg-purple-500' : 'bg-brand-500'}`} style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : isStudent && selectedAssignment.status === 'submitted' ? (
                        <div className="mt-3">
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".mp4,.mov,.webm,.mp3,.m4a,.wav,.pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file || !selectedAssignment) return;
                              if (fileInputRef.current) fileInputRef.current.value = '';
                              setIsUploading(true);
                              setUploadProgress(0);
                              pendingFileAssignmentIdRef.current = selectedAssignment.id;
                              globalStartUpload(selectedAssignment.id, `파일 업로드: ${file.name}`);
                              uploadApi.upload(file, (pct) => { setUploadProgress(pct); globalUpdateProgress(selectedAssignment.id, pct); }, 'assignments', 'assignment', selectedAssignment.id, (phase, pct) => {
                                setUploadPhase(phase);
                                globalUpdatePhase(selectedAssignment.id, phase, pct);
                              }).then(async (result) => {
                                const pendingId = pendingFileAssignmentIdRef.current;
                                if (pendingId) {
                                  pendingFileAssignmentIdRef.current = null;
                                  const patched = await assignmentApi.patchFile(pendingId, result.url);
                                  setAssignments(prev => prev.map(a => a.id === pendingId ? patched : a));
                                  toast.success('파일이 과제에 첨부되었습니다.');
                                }
                              }).catch((err: any) => {
                                toast.error(err.message || '파일 업로드에 실패했습니다.');
                                pendingFileAssignmentIdRef.current = null;
                              }).finally(() => {
                                setIsUploading(false);
                                setUploadProgress(0);
                                globalFinishUpload(selectedAssignment.id);
                              });
                            }}
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 text-xs text-brand-500 bg-brand-50 px-3 py-2 rounded-lg hover:bg-brand-100 transition-colors font-bold"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            파일 첨부하기
                          </button>
                        </div>
                      ) : null
                    }

                    {/* Stamp for completed */}
                    {(selectedAssignment.status === 'graded' || selectedAssignment.status === 'submitted') && (
                       <div className="absolute top-2 right-2 opacity-20">
                          <div className={`border-2 ${selectedAssignment.status === 'graded' ? 'border-green-500 text-green-500' : 'border-blue-500 text-blue-500'} rounded-full p-2 w-16 h-16 flex items-center justify-center -rotate-12`}>
                            <span className="text-xs font-black uppercase text-center">
                              {selectedAssignment.status === 'graded' ? 'GRADED' : 'DONE'}
                            </span>
                          </div>
                       </div>
                    )}
                  </div>
                )}
              </div>

              {/* Grade & Feedback Display — for graded assignments */}
              {selectedAssignment.status === 'graded' && selectedAssignment.grade && (
                <div className="animate-fade-in">
                  <h3 className="font-bold text-sm text-slate-700 mb-2">채점 결과</h3>
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${GRADE_COLORS[selectedAssignment.grade] || 'bg-slate-300 text-white'}`}>
                        {selectedAssignment.grade}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-500">등급</p>
                        <p className="text-sm font-bold text-slate-800">{selectedAssignment.grade} 등급</p>
                      </div>
                    </div>
                    {selectedAssignment.feedback && (
                      <div className="bg-white p-3 rounded-lg border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 mb-1">선생님 피드백</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedAssignment.feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Grading Panel — staff only, for submitted assignments */}
              {isStaff && selectedAssignment.status === 'submitted' && (
                <div className="animate-fade-in">
                  <h3 className="font-bold text-sm text-slate-700 mb-2">채점하기</h3>
                  <div className="bg-brand-50 p-4 rounded-xl border border-brand-100 space-y-4">
                    {/* Grade buttons */}
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-2">등급 선택</p>
                      <div className="flex gap-2">
                        {GRADE_OPTIONS.map(g => (
                          <button
                            key={g}
                            onClick={() => setGradeValue(g)}
                            className={`w-10 h-10 rounded-full font-black text-sm transition-all ${
                              gradeValue === g
                                ? `${GRADE_COLORS[g]} ring-2 ring-offset-2 ring-brand-300 scale-110`
                                : 'bg-white border border-slate-200 text-slate-500 hover:border-brand-300'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Feedback */}
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1">피드백</p>
                      <textarea
                        className="w-full p-3 rounded-xl border border-brand-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm resize-none h-24 bg-white"
                        placeholder="학생에게 전달할 피드백을 입력하세요..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                      />
                    </div>

                    <button
                      onClick={() => handleGrade(selectedAssignment.id)}
                      disabled={isGrading || !gradeValue || !feedbackText.trim()}
                      className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-md shadow-brand-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGrading ? '채점 중...' : '채점 완료'}
                    </button>
                  </div>
                </div>
              )}

              {/* AI Feedback Section */}
              {(selectedAssignment.status !== 'pending' || isStaff) && (
                 <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        AI 코칭 분석
                      </h3>
                      {!selectedAssignment.aiAnalysis && (
                        <button
                          onClick={handleAiFeedback}
                          disabled={isAnalyzing}
                          className="text-xs bg-purple-100 text-purple-600 px-3 py-1 rounded-full hover:bg-purple-200 transition-colors disabled:opacity-50"
                        >
                          {isAnalyzing ? '분석 중...' : 'AI 분석 요청'}
                        </button>
                      )}
                    </div>

                    {selectedAssignment.aiAnalysis && (
                      <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
                        {selectedAssignment.aiAnalysis}
                      </div>
                    )}
                 </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 bg-slate-50/30">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
               <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            </div>
            <p className="font-medium text-slate-500">목록에서 과제를 선택해주세요.</p>
            <p className="text-xs mt-1">왼쪽 목록이나 달력에서 확인할 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => { setIsCreateModalOpen(false); setEditingAssignment(null); }}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md p-5 md:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
             <button
               onClick={() => setIsCreateModalOpen(false)}
               aria-label="닫기"
               className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

             <h3 className="text-xl font-bold text-slate-800 mb-2">{editingAssignment ? '과제 수정' : '새 과제 부여'}</h3>
             <p className="text-xs text-slate-500 mb-6">{editingAssignment ? '과제 내용을 수정합니다.' : '학생 또는 반 전체에 과제를 부여합니다.'}</p>

             <div className="space-y-4">
                {/* Target selector: student or class */}
                {!editingAssignment && (
                  <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold">
                    <button
                      onClick={() => { setAssignTarget('student'); setNewClassId(''); }}
                      className={`flex-1 py-2.5 rounded-lg transition-all ${assignTarget === 'student' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
                    >개별 학생</button>
                    <button
                      onClick={() => { setAssignTarget('class'); setNewStudentId(''); }}
                      className={`flex-1 py-2.5 rounded-lg transition-all ${assignTarget === 'class' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
                    >반 전체</button>
                  </div>
                )}
                <div>
                   {assignTarget === 'class' && !editingAssignment ? (
                     <>
                       <label htmlFor="input-assignment-class" className="block text-xs font-bold text-slate-500 mb-1">반 선택 <span className="text-red-400">*</span></label>
                       <select
                         id="input-assignment-class"
                         value={newClassId}
                         onChange={(e) => setNewClassId(e.target.value)}
                         className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 transition-colors"
                       >
                         <option value="">반을 선택하세요</option>
                         {classes.map(c => (
                           <option key={c.id} value={c.id}>{c.name} ({c.studentIds.length}명)</option>
                         ))}
                       </select>
                     </>
                   ) : (
                     <>
                       <label htmlFor="input-assignment-student" className="block text-xs font-bold text-slate-500 mb-1">학생 선택 <span className="text-red-400">*</span></label>
                       <select
                         id="input-assignment-student"
                         value={newStudentId}
                         onChange={(e) => setNewStudentId(e.target.value)}
                         disabled={!!editingAssignment}
                         className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                       >
                         <option value="">학생을 선택하세요</option>
                         {allUsers.filter(u => u.role === UserRole.STUDENT).map(u => (
                           <option key={u.id} value={u.id}>{u.name}</option>
                         ))}
                       </select>
                     </>
                   )}
                </div>
                <div>
                   <label htmlFor="input-assignment-title" className="block text-xs font-bold text-slate-500 mb-1">과제명 <span className="text-red-400">*</span></label>
                   <input
                     id="input-assignment-title"
                     value={newTitle}
                     onChange={(e) => setNewTitle(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 transition-colors"
                     placeholder="예: 3막 2장 독백 연습"
                   />
                </div>
                <div>
                   <label htmlFor="input-assignment-date" className="block text-xs font-bold text-slate-500 mb-1">마감 기한 <span className="text-red-400">*</span></label>
                   <input
                     id="input-assignment-date"
                     type="date"
                     value={newDate}
                     onChange={(e) => setNewDate(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 transition-colors"
                   />
                </div>
                <div>
                   <label htmlFor="input-assignment-desc" className="block text-xs font-bold text-slate-500 mb-1">상세 내용 (선택)</label>
                   <textarea
                     id="input-assignment-desc"
                     value={newDesc}
                     onChange={(e) => setNewDesc(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 transition-colors resize-none h-24"
                     placeholder="과제에 대한 상세 설명을 입력하세요."
                   />
                </div>

                {/* 첨부파일 (선생님이 과제에 자료 첨부) */}
                {!editingAssignment && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">자료 첨부 (선택)</label>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp3,.m4a,.wav"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setAttachmentFile(f); setAttachmentUrl(''); }
                      e.target.value = '';
                    }}
                  />
                  {attachmentFile ? (
                    <div className="flex items-center gap-2 p-3 bg-brand-50 border border-brand-200 rounded-xl">
                      <svg className="w-4 h-4 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <span className="text-sm text-brand-700 truncate flex-1">{attachmentFile.name}</span>
                      <button onClick={() => { setAttachmentFile(null); setAttachmentUrl(''); }} className="text-xs text-red-400 hover:text-red-600 shrink-0">삭제</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => attachmentInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-brand-300 transition-colors"
                    >
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      <span className="text-xs text-slate-500">대본, 문서 등 자료 첨부</span>
                    </button>
                  )}
                  <p className="text-xs text-slate-400 mt-1">학생은 열람만 가능하며 다운로드할 수 없습니다</p>
                </div>
                )}

                <button
                  onClick={editingAssignment ? handleUpdateAssignment : handleCreateAssignment}
                  disabled={(!editingAssignment && assignTarget === 'student' && !newStudentId) || (!editingAssignment && assignTarget === 'class' && !newClassId) || !newTitle.trim() || isAttachmentUploading}
                  className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAttachmentUploading ? '파일 업로드 중...' : editingAssignment ? '수정하기' : '등록하기'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Fullscreen image preview modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center"
          onClick={() => setFullscreenImage(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img
            src={fullscreenImage}
            alt="첨부 자료"
            className="max-w-full max-h-full object-contain p-4"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            style={{ userSelect: 'none', WebkitUserDrag: 'none' } as any}
          />
        </div>
      )}

      {deleteAssignmentId && (
        <ConfirmDialog
          title="과제 삭제"
          message="이 과제를 삭제하시겠습니까? 제출된 내용도 함께 삭제됩니다."
          variant="danger"
          confirmLabel="삭제"
          onConfirm={handleDeleteAssignment}
          onCancel={() => setDeleteAssignmentId(null)}
        />
      )}
    </div>
  );
};
