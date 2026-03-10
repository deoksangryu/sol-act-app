
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DietLog, User, UserRole } from '../types';
import { dietApi, uploadApi, API_URL } from '../services/api';
import toast from 'react-hot-toast';
import { useDataRefresh } from '../services/useWebSocket';
import { ConfirmDialog } from './ConfirmDialog';
import { formatDateKo, formatTimeKo, formatDateWeekdayKo } from '../services/dateUtils';
import { useAppData } from '../services/AppContext';

/** 로컬 날짜를 YYYY-MM-DD 형식으로 반환 */
function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 로컬 날짜/시간을 ISO-like 문자열로 반환 (UTC 변환 방지) */
function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

interface DietProps {
  user: User;
}

export const Diet: React.FC<DietProps> = ({ user }) => {
  const [logs, setLogs] = useState<DietLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // View State — staff defaults to full feed
  const isStaffUser = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>(isStaffUser ? 'list' : 'calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Form State
  const [newMeal, setNewMeal] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newMealType, setNewMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comment State
  const [commentingLogId, setCommentingLogId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // Edit/Delete State
  const [editingLog, setEditingLog] = useState<DietLog | null>(null);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);

  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;

  // Student filter & search (staff only)
  const { allUsers } = useAppData();
  const students = allUsers.filter(u => u.role === UserRole.STUDENT);
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load diet logs from API
  const loadData = useCallback(() => {
    dietApi.list(isStaff ? {} : { studentId: user.id }).then(setLogs).catch(console.error).finally(() => setLoading(false));
  }, [user.id, isStaff]);

  useEffect(() => { loadData(); }, [loadData]);

  useDataRefresh('diet', loadData);

  // ESC key handler for modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) { setIsModalOpen(false); return; }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen]);

  // --- Calendar Logic ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
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

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 md:h-20 bg-slate-50/30 border border-slate-50"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLogs = logs
        .filter(l => studentFilter === 'all' || l.studentId === studentFilter)
        .filter(l => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.trim().toLowerCase();
          return (l.description || '').toLowerCase().includes(q)
            || (l.studentName || '').toLowerCase().includes(q)
            || (l.teacherComment || '').toLowerCase().includes(q);
        })
        .filter(l => toLocalDateStr(new Date(l.date)) === dateStr);
      const isSelected = selectedDate === dateStr;
      const totalCalories = dayLogs.reduce((sum, log) => sum + (log.calories || 0), 0);

      days.push(
        <div
          key={d}
          onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
          className={`h-16 md:h-20 border border-slate-50 p-1 relative cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-green-50 ring-1 ring-green-200 z-10' : 'bg-white'}`}
        >
          <div className={`text-xs font-bold mb-1 ${isSelected ? 'text-green-600' : 'text-slate-700'}`}>
            {d}
          </div>

          {/* Indicators */}
          {dayLogs.length > 0 && (
            <div className="flex flex-col gap-0.5">
               <div className="flex flex-wrap gap-0.5">
                {dayLogs.map(l => (
                    <div key={l.id} className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                ))}
               </div>
               <p className="hidden md:block text-xs text-slate-400 mt-1 font-medium">{totalCalories} kcal</p>
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  // Filter Logic
  const filteredLogs = logs
    .filter(l => studentFilter === 'all' || l.studentId === studentFilter)
    .filter(l => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (l.description || '').toLowerCase().includes(q)
        || (l.studentName || '').toLowerCase().includes(q)
        || (l.teacherComment || '').toLowerCase().includes(q);
    })
    .filter(l => {
      if (viewMode === 'calendar' && selectedDate) {
        return toLocalDateStr(new Date(l.date)) === selectedDate;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMeal = async () => {
    if (!newMeal.trim() && !selectedFile) return;
    setIsAnalyzing(true);
    try {
      // Upload image file first if selected
      let imageUrl: string | undefined;
      if (selectedFile) {
        try {
          const uploaded = await uploadApi.upload(selectedFile, undefined, 'diet');
          imageUrl = uploaded.url;
        } catch {
          toast.error('이미지 업로드에 실패했습니다.');
          setIsAnalyzing(false);
          return;
        }
      }

      // Analyze based on description only (no base64 to avoid large request body)
      let calories = 0;
      let advice = '';
      if (newMeal.trim()) {
        try {
          const analysis = await dietApi.analyze({ description: newMeal });
          calories = analysis.calories;
          advice = analysis.advice;
        } catch {
          // Analysis may fail, continue without it
        }
      }

      let logDate = new Date();
      if (selectedDate) {
        logDate = new Date(selectedDate + 'T12:00:00');
        const now = new Date();
        logDate.setHours(now.getHours(), now.getMinutes());
      }

      const newLog = await dietApi.create({
        studentId: user.id,
        date: toLocalISOString(logDate),
        mealType: newMealType,
        description: newMeal || '사진으로 기록된 식단',
        imageUrl,
      });
      setLogs([newLog, ...logs]);
      setNewMeal('');
      setSelectedImage(null);
      setSelectedFile(null);
      setIsModalOpen(false);
      toast.success('식단이 기록되었습니다.');
    } catch { toast.error('식단 기록에 실패했습니다.'); }
    finally { setIsAnalyzing(false); }
  };

  const handleOpenModal = () => {
    setEditingLog(null);
    setNewMeal('');
    setNewMealType('lunch');
    setSelectedImage(null);
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (log: DietLog) => {
    setEditingLog(log);
    setNewMeal(log.description);
    setNewMealType(log.mealType as any);
    setSelectedImage(log.imageUrl ? (log.imageUrl.startsWith('/') ? `${API_URL}${log.imageUrl}` : log.imageUrl) : null);
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleEditMeal = async () => {
    if (!editingLog) return;
    if (!newMeal.trim() && !selectedFile && !selectedImage) return;
    setIsAnalyzing(true);
    try {
      let imageUrl = editingLog.imageUrl;
      if (selectedFile) {
        try {
          const uploaded = await uploadApi.upload(selectedFile, undefined, 'diet');
          imageUrl = uploaded.url;
        } catch {
          toast.error('이미지 업로드에 실패했습니다.');
          setIsAnalyzing(false);
          return;
        }
      } else if (!selectedImage) {
        imageUrl = undefined as any;
      }

      const updated = await dietApi.update(editingLog.id, {
        mealType: newMealType,
        description: newMeal || editingLog.description,
        imageUrl,
      });
      setLogs(logs.map(l => l.id === editingLog.id ? { ...l, ...updated } : l));
      setIsModalOpen(false);
      setEditingLog(null);
      toast.success('식단이 수정되었습니다.');
    } catch { toast.error('식단 수정에 실패했습니다.'); }
    finally { setIsAnalyzing(false); }
  };

  const handleDeleteLog = async () => {
    if (!deleteLogId) return;
    try {
      await dietApi.delete(deleteLogId);
      setLogs(logs.filter(l => l.id !== deleteLogId));
      setDeleteLogId(null);
      toast.success('식단이 삭제되었습니다.');
    } catch { toast.error('식단 삭제에 실패했습니다.'); }
  };

  const handleSaveComment = async (logId: string) => {
    try {
      await dietApi.update(logId, { teacherComment: commentText });
      setLogs(logs.map(l => l.id === logId ? { ...l, teacherComment: commentText } : l));
      setCommentingLogId(null);
      setCommentText('');
      toast.success('코멘트가 저장되었습니다.');
    } catch {
      toast.error('코멘트 저장에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">로딩 중...</div>
      </div>
    );
  }

  // --- Reusable Log Card ---
  const renderLogCard = (log: DietLog) => (
    <div key={log.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow overflow-hidden animate-fade-in-up">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
            log.mealType === 'breakfast' ? 'bg-brand-100 text-brand-700' :
            log.mealType === 'lunch' ? 'bg-green-100 text-green-700' :
            log.mealType === 'dinner' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
          }`}>
            {log.mealType === 'breakfast' ? '아침' : log.mealType === 'lunch' ? '점심' : log.mealType === 'dinner' ? '저녁' : '간식'}
          </span>
          {isStaff && log.studentName && (
            <span className="text-xs font-bold text-slate-500">{log.studentName}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isStaff && log.studentId === user.id && (
            <>
              <button onClick={() => handleOpenEditModal(log)} className="text-xs text-slate-400 hover:text-brand-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center">수정</button>
              <button onClick={() => setDeleteLogId(log.id)} className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center">삭제</button>
            </>
          )}
          <span className="text-xs text-slate-400 ml-1">
            {formatDateKo(log.date)} {formatTimeKo(log.date)}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {log.imageUrl && (
          <div className="shrink-0 w-full md:w-40 h-40 rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
            <img src={log.imageUrl.startsWith('/') ? `${API_URL}${log.imageUrl}` : log.imageUrl} alt="Meal" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 text-lg mb-1">{log.description}</h3>
          {log.calories && (
            <p className="text-slate-500 font-medium text-sm mb-3">
              약 <span className="text-slate-800 font-bold">{log.calories}</span> kcal
            </p>
          )}
          {log.aiAdvice && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-3 items-start">
              <div className="mt-0.5 shrink-0">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-xs text-slate-600 leading-snug">{log.aiAdvice}</p>
            </div>
          )}
        </div>
      </div>

      {isStaff && (
        <div className="mt-4 pt-4 border-t border-slate-50">
          <div className="flex justify-end">
            <button onClick={() => {
              if (commentingLogId === log.id) {
                setCommentingLogId(null);
              } else {
                setCommentingLogId(log.id);
                setCommentText(log.teacherComment || '');
              }
            }} className="text-xs text-brand-500 font-bold hover:underline">
              {log.teacherComment ? '코멘트 수정' : '코멘트 남기기'}
            </button>
          </div>
          {log.teacherComment && commentingLogId !== log.id && (
            <div className="mt-2 bg-blue-50 border border-blue-100 p-3 rounded-lg">
              <p className="text-xs text-blue-600"><span className="font-bold">선생님 코멘트:</span> {log.teacherComment}</p>
            </div>
          )}
          {commentingLogId === log.id && (
            <div className="mt-2 space-y-2">
              <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg resize-none h-16 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" placeholder="코멘트를 입력하세요..." />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setCommentingLogId(null)} className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium">취소</button>
                <button onClick={() => handleSaveComment(log.id)} className="text-xs px-3 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors font-medium">저장</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isStaff && log.teacherComment && (
        <div className="mt-4 pt-4 border-t border-slate-50">
          <div className="mt-2 bg-blue-50 border border-blue-100 p-3 rounded-lg">
            <p className="text-xs text-blue-600"><span className="font-bold">선생님 코멘트:</span> {log.teacherComment}</p>
          </div>
        </div>
      )}
    </div>
  );

  // ===== Staff Full Feed Layout =====
  if (isStaff) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Filter Bar */}
        <div className="shrink-0 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <select
              value={studentFilter}
              onChange={e => setStudentFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none"
            >
              <option value="all">전체 학생</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="식단 내용, 학생 이름으로 검색..."
                className="w-full text-sm border border-slate-200 rounded-lg pl-10 pr-3 py-2 bg-white focus:border-green-400 focus:ring-1 focus:ring-green-400 outline-none"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{filteredLogs.length}건</span>
          </div>
        </div>

        {/* Full Feed */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {filteredLogs.length > 0 ? filteredLogs.map(renderLogCard) : (
            <div className="text-center py-16 text-slate-400">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <p className="font-medium">{searchQuery || studentFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 식단 기록이 없습니다.'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== Student Calendar Layout =====
  return (
    <div className="grid md:grid-cols-3 gap-4 md:gap-6 h-full min-h-0">

      {/* LEFT COLUMN: Calendar / List Toggle */}
      <div className={`md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full ${selectedDate || viewMode === 'list' ? 'hidden md:flex' : 'flex'}`}>

        {/* Header Controls */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-800">식단 캘린더</h2>
            <button
              onClick={handleOpenModal}
              className="text-xs flex items-center gap-1 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-green-50 hover:text-green-500 hover:border-green-200 transition-colors shadow-sm"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span className="font-bold">식단 기록</span>
            </button>
          </div>

          <div className="bg-slate-200/50 p-1 rounded-xl flex text-xs font-bold">
            <button
              onClick={() => { setViewMode('calendar'); setSelectedDate(null); }}
              className={`flex-1 py-2.5 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              달력 보기
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 py-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              목록 보기
            </button>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {viewMode === 'calendar' ? (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-4 px-2 mt-2">
                        <button onClick={handlePrevMonth} aria-label="이전 달" className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="text-center cursor-pointer hover:bg-slate-50 px-3 py-2 rounded-lg" onClick={handleToday}>
                            <h3 className="text-sm font-bold text-slate-800">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h3>
                            {selectedDate && <p className="text-xs text-green-500">선택됨: {selectedDate}</p>}
                        </div>
                        <button onClick={handleNextMonth} aria-label="다음 달" className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
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
                    <div className="mt-4 px-2 text-center">
                        <p className="text-xs text-slate-400">날짜를 선택하여 식단 기록을 확인하세요.</p>
                    </div>
                </div>
            ) : (
                <div className="p-2 space-y-2">
                     {filteredLogs.map(log => (
                         <div key={log.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                             <div className="flex justify-between text-xs mb-1">
                                 <span className="font-bold text-slate-700">{formatDateKo(log.date)}</span>
                                 <span className="text-slate-400">{log.mealType}</span>
                             </div>
                             <p className="text-sm text-slate-800 line-clamp-1">{log.description}</p>
                             {isStaff && log.studentName && (
                               <p className="text-xs text-slate-400 mt-1">{log.studentName}</p>
                             )}
                         </div>
                     ))}
                     {filteredLogs.length === 0 && (
                       <div className="text-center py-8 text-slate-400 text-xs">
                         {searchQuery || studentFilter !== 'all' ? '검색 결과가 없습니다.' : '기록된 식단이 없습니다.'}
                       </div>
                     )}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT COLUMN: Daily Feed / Details */}
      <div className={`md:col-span-2 bg-slate-50/50 rounded-2xl md:border border-slate-100 overflow-hidden flex flex-col h-full ${selectedDate ? 'flex' : viewMode === 'list' ? 'flex' : 'hidden md:flex'}`}>

         {/* Mobile Header for Detail View */}
         <div className="md:hidden p-4 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0">
            <button onClick={() => { setSelectedDate(null); if (viewMode === 'list') setViewMode('calendar'); }} aria-label="뒤로 가기" className="p-2 -ml-2 text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h3 className="font-bold text-slate-800">
                {selectedDate ? `${selectedDate} 식단` : '전체 식단 목록'}
            </h3>
         </div>

         {/* Feed Content */}
         <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-h-0">
             {viewMode === 'calendar' && !selectedDate ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400">
                     <svg className="w-16 h-16 mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                     <p className="font-medium">날짜를 선택하면 상세 식단이 표시됩니다.</p>
                 </div>
             ) : (
                <>
                    {/* Header for Desktop */}
                    <div className="hidden md:flex justify-between items-center mb-2">
                        <h3 className="font-bold text-xl text-slate-800">
                            {selectedDate ? `${formatDateWeekdayKo(selectedDate)} 식단` : '전체 식단'}
                        </h3>
                        {selectedDate && (
                            <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm">
                                총 {filteredLogs.reduce((sum, l) => sum + (l.calories || 0), 0)} kcal
                            </span>
                        )}
                    </div>

                    {filteredLogs.length > 0 ? filteredLogs.map(renderLogCard) : (
                        <div className="text-center py-12 text-slate-400">
                            <p>기록된 식단이 없습니다.</p>
                            <p className="text-xs mt-1">오늘 무엇을 드셨나요? 기록해보세요!</p>
                        </div>
                    )}
                </>
             )}
         </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md p-5 md:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setIsModalOpen(false)}
              aria-label="닫기"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-2">
                {editingLog ? '식단 수정' : selectedDate ? `${selectedDate} 식단 기록` : '오늘의 식단 기록'}
            </h3>

            {/* Meal Type Selector */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar scroll-hint">
                {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
                    <button
                        key={type}
                        onClick={() => setNewMealType(type as any)}
                        className={`px-4 py-2.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-colors ${
                            newMealType === type
                            ? 'bg-green-500 text-white shadow-md'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        {type === 'breakfast' ? '아침' : type === 'lunch' ? '점심' : type === 'dinner' ? '저녁' : '간식'}
                    </button>
                ))}
            </div>

            {/* Image Upload Area */}
            <div className="mb-4">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageSelect}
              />
              {selectedImage ? (
                <div className="relative rounded-xl overflow-hidden h-48 border border-slate-200 group">
                  <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setSelectedImage(null)}
                      aria-label="이미지 삭제"
                      className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 backdrop-blur-md"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:bg-slate-50 hover:border-slate-400 transition-all"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-xs font-medium">사진 추가하기</span>
                </button>
              )}
            </div>

            <textarea
              value={newMeal}
              onChange={(e) => setNewMeal(e.target.value)}
              placeholder="예: 현미밥 반 공기, 닭가슴살 100g, 김치 조금"
              className="w-full p-4 rounded-xl border border-slate-200 h-24 resize-none outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 mb-4 text-sm text-slate-600 placeholder:text-slate-300"
            />

            <div className="flex gap-3 mt-2">
              <button
                onClick={editingLog ? handleEditMeal : handleAddMeal}
                disabled={isAnalyzing}
                className="w-full py-3.5 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-200 disabled:opacity-70 flex justify-center items-center gap-2 text-sm"
              >
                {isAnalyzing ? (
                   <>
                     <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     AI 분석 중...
                   </>
                ) : editingLog ? '수정하기' : '기록하기'}
              </button>
            </div>
            <p className="text-xs text-center text-slate-400 mt-4">
              AI가 사진과 설명을 분석하여 칼로리와 영양 조언을 제공합니다.
            </p>
          </div>
        </div>
      )}

      {deleteLogId && (
        <ConfirmDialog
          title="식단 삭제"
          message="이 식단 기록을 삭제하시겠습니까?"
          variant="danger"
          confirmLabel="삭제"
          onConfirm={handleDeleteLog}
          onCancel={() => setDeleteLogId(null)}
        />
      )}
    </div>
  );
};
