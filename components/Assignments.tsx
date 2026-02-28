
import React, { useState, useEffect } from 'react';
import { Assignment, User, UserRole } from '../types';
import { analyzeMonologue } from '../services/gemini';
import toast from 'react-hot-toast';

interface AssignmentsProps {
  user: User;
}

const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: 'a1',
    title: '햄릿 독백 분석',
    description: '3막 1장 "죽느냐 사느냐" 독백을 분석하고 감정선을 서술하세요.',
    dueDate: '2023-10-25',
    studentId: 's1',
    studentName: '김배우',
    status: 'pending'
  },
  {
    id: 'a2',
    title: '자유 연기 영상 제출',
    description: '준비한 자유 연기 영상을 촬영하여 제출하세요. (2분 이내)',
    dueDate: '2023-10-28',
    studentId: 's1',
    studentName: '김배우',
    status: 'submitted',
    submissionText: '영상 링크 첨부합니다: youtube.com/short_link',
    submissionFileUrl: 'video.mp4'
  },
  {
    id: 'a3',
    title: '발성 연습 일지',
    description: '일주일간의 호흡 훈련 기록을 제출하세요.',
    dueDate: '2023-10-24',
    studentId: 's1',
    studentName: '김배우',
    status: 'graded',
    submissionText: '매일 아침 30분씩 훈련했습니다.',
    grade: 'A',
    feedback: '성실함이 보입니다. 아주 좋아요!'
  }
];

export const Assignments: React.FC<AssignmentsProps> = ({ user }) => {
  // Initialize with persisted data if available
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = localStorage.getItem('muse_assignments');
    return saved ? JSON.parse(saved) : MOCK_ASSIGNMENTS;
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // View Mode State
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date()); // For month navigation
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // For filtering

  // Create Assignment State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('');

  const selectedAssignment = assignments.find(a => a.id === selectedId);
  
  const isStudent = user.role === UserRole.STUDENT;
  const isStaff = !isStudent; // Teacher or Director

  // Persist changes
  useEffect(() => {
    localStorage.setItem('muse_assignments', JSON.stringify(assignments));
  }, [assignments]);

  // --- Calendar Logic Start ---
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
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  const renderCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];

    // Empty cells for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 md:h-20 bg-slate-50/30 border border-slate-50"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayAssignments = assignments.filter(a => a.dueDate === dateStr);
      const isSelected = selectedDate === dateStr;
      
      // Check for completion stamp condition (all assignments for this day are submitted/graded)
      const hasAssignments = dayAssignments.length > 0;
      const allCompleted = hasAssignments && dayAssignments.every(a => a.status === 'submitted' || a.status === 'graded');

      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
          className={`h-14 md:h-20 border border-slate-50 p-1 relative cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-orange-50 ring-1 ring-orange-200 z-10' : 'bg-white'}`}
        >
          <div className={`text-[10px] md:text-xs font-bold mb-1 ${isSelected ? 'text-orange-600' : 'text-slate-700'}`}>
            {d}
          </div>
          
          {/* Dots Indicator */}
          <div className="flex flex-wrap gap-1 content-start">
            {dayAssignments.map(a => (
              <div 
                key={a.id} 
                className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                  a.status === 'graded' ? 'bg-green-500' :
                  a.status === 'submitted' ? 'bg-blue-400' : 'bg-orange-400'
                }`} 
                title={a.title}
              />
            ))}
          </div>

          {/* Stamp Effect */}
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
  // --- Calendar Logic End ---

  // Filter List Logic
  const filteredAssignments = assignments.filter(a => {
    if (viewMode === 'calendar' && selectedDate) {
      return a.dueDate === selectedDate;
    }
    return true;
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());


  const handleSubmit = (id: string) => {
    setAssignments(prev => prev.map(a => 
      a.id === id ? { ...a, status: 'submitted', submissionText } : a
    ));
    setSubmissionText('');
    setSelectedId(null);
    toast.success('과제가 성공적으로 제출되었습니다! 🎉');
  };

  const handleCreateAssignment = () => {
    if (!newTitle.trim()) return;

    const newAsgn: Assignment = {
      id: Date.now().toString(),
      title: newTitle,
      description: newDesc || (isStudent ? '구두로 전달받은 과제' : '추가 설명 없음'),
      dueDate: newDate || new Date().toISOString().split('T')[0],
      studentId: isStudent ? user.id : 's1', // Default mock logic
      studentName: isStudent ? user.name : '김배우',
      status: 'pending'
    };

    setAssignments([newAsgn, ...assignments]);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewDate('');
    toast.success('새 과제가 등록되었습니다.');
  };

  const handleAiFeedback = async () => {
    if (!selectedAssignment?.submissionText) return;
    
    setIsAnalyzing(true);
    try {
        const analysis = await analyzeMonologue(selectedAssignment.submissionText);
        setAssignments(prev => prev.map(a => 
            a.id === selectedId ? { ...a, aiAnalysis: analysis } : a
        ));
        toast.success('AI 분석이 완료되었습니다.');
    } catch(e) {
        toast.error('AI 분석 중 오류가 발생했습니다.');
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6 h-full min-h-0">
      {/* Left Column: Calendar/List Toggle + Content */}
      <div className={`md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full ${selectedId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Header Controls */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-800">과제 관리</h2>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs flex items-center gap-1 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-orange-500 hover:border-orange-200 transition-colors shadow-sm"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span className="font-bold">{isStaff ? '과제 부여' : '직접 등록'}</span>
            </button>
          </div>
          
          {/* View Toggle */}
          <div className="bg-slate-200/50 p-1 rounded-xl flex text-xs font-bold">
            <button 
              onClick={() => { setViewMode('calendar'); setSelectedDate(null); }}
              className={`flex-1 py-2.5 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              달력 보기
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 py-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              목록 보기
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          
          {/* CALENDAR VIEW */}
          {viewMode === 'calendar' && (
            <div className="p-2 animate-fade-in">
              {/* Calendar Header */}
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

              {/* Weekday Header */}
              <div className="grid grid-cols-7 mb-1 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                  <div key={day} className="text-[10px] font-bold text-slate-400 uppercase">{day}</div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 bg-slate-100 gap-px border border-slate-100 rounded-lg overflow-hidden">
                {renderCalendarDays()}
              </div>
              
              <div className="mt-4 px-2 flex justify-between items-center text-[10px] text-slate-400">
                <div className="flex gap-2">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400"></div>진행중</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>완료</span>
                </div>
                {selectedDate && (
                  <button onClick={() => setSelectedDate(null)} className="text-slate-500 hover:text-orange-500 underline">
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
                    ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200' 
                    : 'bg-white border-transparent hover:bg-slate-50 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                    a.status === 'submitted' ? 'bg-blue-100 text-blue-600' :
                    a.status === 'graded' ? 'bg-green-100 text-green-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {a.status === 'submitted' ? '제출완료' : a.status === 'graded' ? '채점완료' : '미제출'}
                  </span>
                  <span className="text-xs text-slate-400">{a.dueDate}</span>
                </div>
                <h3 className="font-bold text-slate-700 text-sm">{a.title}</h3>
                {isStaff && <p className="text-xs text-slate-400 mt-1">{a.studentName}</p>}
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
               {/* Mobile Back Button */}
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
                        <span className="block text-sm font-bold text-orange-500">{selectedAssignment.dueDate}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Submission Area */}
              <div>
                <h3 className="font-bold text-sm text-slate-700 mb-2">제출 내용</h3>
                {selectedAssignment.status === 'pending' && !isStaff ? (
                  <div className="space-y-3">
                    <textarea 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none text-sm resize-none h-32"
                      placeholder="과제 내용을 입력하거나 링크를 붙여넣으세요..."
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                    />
                    <div className="flex gap-2">
                       <label className="flex-1 flex items-center justify-center p-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                          <input type="file" className="hidden" />
                          <span className="text-xs text-slate-500">📁 파일 첨부 (영상/문서)</span>
                       </label>
                    </div>
                    <button 
                      onClick={() => handleSubmit(selectedAssignment.id)}
                      className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-md shadow-orange-200"
                    >
                      과제 제출하기
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {selectedAssignment.submissionText || "아직 제출된 내용이 없습니다."}
                    </p>
                    {selectedAssignment.submissionFileUrl && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-blue-500 bg-blue-50 w-fit px-3 py-1.5 rounded-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        첨부파일 확인
                      </div>
                    )}
                    
                    {/* Stamp for completed assignment details */}
                    {(selectedAssignment.status === 'graded' || selectedAssignment.status === 'submitted') && (
                       <div className="absolute top-2 right-2 opacity-20">
                          <div className={`border-2 ${selectedAssignment.status === 'graded' ? 'border-green-500 text-green-500' : 'border-blue-500 text-blue-500'} rounded-full p-2 w-16 h-16 flex items-center justify-center -rotate-12`}>
                            <span className="text-[10px] font-black uppercase text-center">
                              {selectedAssignment.status === 'graded' ? 'GRADED' : 'DONE'}
                            </span>
                          </div>
                       </div>
                    )}
                  </div>
                )}
              </div>

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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
             <button 
               onClick={() => setIsCreateModalOpen(false)}
               className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

             <h3 className="text-xl font-bold text-slate-800 mb-2">새 과제 등록</h3>
             <p className="text-xs text-slate-500 mb-6">
               {isStudent ? '선생님께 구두로 받은 과제나 개인 연습 목표를 기록하세요.' : '학생들에게 새로운 과제를 부여합니다.'}
             </p>

             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">과제명</label>
                   <input 
                     value={newTitle}
                     onChange={(e) => setNewTitle(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500 transition-colors"
                     placeholder="예: 3막 2장 독백 연습"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">마감 기한</label>
                   <input 
                     type="date"
                     value={newDate}
                     onChange={(e) => setNewDate(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500 transition-colors"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">상세 내용 (선택)</label>
                   <textarea 
                     value={newDesc}
                     onChange={(e) => setNewDesc(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500 transition-colors resize-none h-24"
                     placeholder="과제에 대한 상세 설명을 입력하세요."
                   />
                </div>

                <button 
                  onClick={handleCreateAssignment}
                  className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 mt-2"
                >
                  등록하기
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
