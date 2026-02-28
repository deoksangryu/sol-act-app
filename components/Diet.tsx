
import React, { useState, useRef, useEffect } from 'react';
import { DietLog, User, UserRole } from '../types';
import { analyzeDiet } from '../services/gemini';
import toast from 'react-hot-toast';

interface DietProps {
  user: User;
}

const MOCK_DIET_LOGS: DietLog[] = [
  {
    id: 'd1',
    studentId: 's1',
    studentName: '김배우',
    date: new Date().toISOString(),
    mealType: 'lunch',
    description: '닭가슴살 샐러드, 고구마 1개',
    calories: 450,
    aiAdvice: '단백질 섭취가 좋습니다. 드레싱 양만 조절하면 완벽해요!',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'd2',
    studentId: 's1',
    studentName: '김배우',
    date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    mealType: 'dinner',
    description: '현미밥, 된장찌개, 생선구이',
    calories: 600,
    aiAdvice: '나트륨 섭취에 조금 더 신경 써주세요.',
  }
];

export const Diet: React.FC<DietProps> = ({ user }) => {
  const [logs, setLogs] = useState<DietLog[]>(() => {
    const saved = localStorage.getItem('muse_diet');
    return saved ? JSON.parse(saved) : MOCK_DIET_LOGS;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // View State
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Form State
  const [newMeal, setNewMeal] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newMealType, setNewMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;

  useEffect(() => {
    localStorage.setItem('muse_diet', JSON.stringify(logs));
  }, [logs]);

  // --- Calendar Logic ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
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

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 md:h-20 bg-slate-50/30 border border-slate-50"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayLogs = logs.filter(l => l.date.startsWith(dateStr));
      const isSelected = selectedDate === dateStr;
      const totalCalories = dayLogs.reduce((sum, log) => sum + (log.calories || 0), 0);

      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
          className={`h-14 md:h-20 border border-slate-50 p-1 relative cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-green-50 ring-1 ring-green-200 z-10' : 'bg-white'}`}
        >
          <div className={`text-[10px] md:text-xs font-bold mb-1 ${isSelected ? 'text-green-600' : 'text-slate-700'}`}>
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
               <p className="hidden md:block text-[9px] text-slate-400 mt-1 font-medium">{totalCalories} kcal</p>
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  // Filter Logic
  const filteredLogs = logs.filter(l => {
    if (viewMode === 'calendar' && selectedDate) {
      return l.date.startsWith(selectedDate);
    }
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMeal = async () => {
    if (!newMeal.trim() && !selectedImage) return;

    setIsAnalyzing(true);
    try {
        const analysis = await analyzeDiet(newMeal, selectedImage || undefined);

        // Use selected date for the log, or now if not selected
        let logDate = new Date();
        if (selectedDate) {
            logDate = new Date(selectedDate);
            // Set to current time but on selected date
            const now = new Date();
            logDate.setHours(now.getHours(), now.getMinutes());
        }

        const newLog: DietLog = {
            id: Date.now().toString(),
            studentId: user.id,
            studentName: user.name,
            date: logDate.toISOString(),
            mealType: newMealType,
            description: newMeal || '사진으로 기록된 식단',
            calories: analysis.calories,
            aiAdvice: analysis.advice,
            imageUrl: selectedImage || undefined
        };

        setLogs([newLog, ...logs]);
        setNewMeal('');
        setSelectedImage(null);
        setIsModalOpen(false);
        toast.success('식단이 기록되었습니다. 🥗');
    } catch(e) {
        toast.error('식단 분석 중 오류가 발생했습니다.');
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleOpenModal = () => {
    setNewMeal('');
    setSelectedImage(null);
    setIsModalOpen(true);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6 h-full min-h-0">
      
      {/* LEFT COLUMN: Calendar / List Toggle */}
      <div className={`md:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full ${selectedDate || viewMode === 'list' ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Header Controls */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-800">식단 캘린더</h2>
            {!isStaff && (
                <button 
                onClick={handleOpenModal}
                className="text-xs flex items-center gap-1 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-green-50 hover:text-green-500 hover:border-green-200 transition-colors shadow-sm"
                >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="font-bold">식단 기록</span>
                </button>
            )}
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
                        <button onClick={handlePrevMonth} className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="text-center cursor-pointer hover:bg-slate-50 px-3 py-1 rounded-lg" onClick={handleToday}>
                            <h3 className="text-sm font-bold text-slate-800">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h3>
                            {selectedDate && <p className="text-[10px] text-green-500">선택됨: {selectedDate}</p>}
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
                    <div className="mt-4 px-2 text-center">
                        <p className="text-[10px] text-slate-400">날짜를 선택하여 식단 기록을 확인하세요.</p>
                    </div>
                </div>
            ) : (
                <div className="p-2 space-y-2">
                     {filteredLogs.map(log => (
                         <div key={log.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                             <div className="flex justify-between text-xs mb-1">
                                 <span className="font-bold text-slate-700">{new Date(log.date).toLocaleDateString()}</span>
                                 <span className="text-slate-400">{log.mealType}</span>
                             </div>
                             <p className="text-sm text-slate-800 line-clamp-1">{log.description}</p>
                         </div>
                     ))}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT COLUMN: Daily Feed / Details */}
      <div className={`md:col-span-2 bg-slate-50/50 rounded-2xl md:border border-slate-100 overflow-hidden flex flex-col h-full ${selectedDate ? 'flex' : viewMode === 'list' ? 'flex' : 'hidden md:flex'}`}>
         
         {/* Mobile Header for Detail View */}
         <div className="md:hidden p-4 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0">
            <button onClick={() => { setSelectedDate(null); if (viewMode === 'list') setViewMode('calendar'); }} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
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
                            {selectedDate ? `${new Date(selectedDate).toLocaleDateString('ko-KR', { weekday: 'long', month: 'long', day: 'numeric' })} 식단` : '전체 식단'}
                        </h3>
                        {selectedDate && (
                            <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm">
                                총 {filteredLogs.reduce((sum, l) => sum + (l.calories || 0), 0)} kcal
                            </span>
                        )}
                    </div>

                    {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                        <div key={log.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow overflow-hidden animate-fade-in-up">
                            <div className="flex justify-between items-start mb-3">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                                log.mealType === 'breakfast' ? 'bg-orange-100 text-orange-700' :
                                log.mealType === 'lunch' ? 'bg-green-100 text-green-700' :
                                log.mealType === 'dinner' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                                {log.mealType === 'breakfast' ? '아침' : log.mealType === 'lunch' ? '점심' : log.mealType === 'dinner' ? '저녁' : '간식'}
                            </span>
                            <span className="text-xs text-slate-400">
                                {new Date(log.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            </div>
                            
                            <div className="flex flex-col md:flex-row gap-4">
                                {log.imageUrl && (
                                <div className="shrink-0 w-full md:w-32 h-32 rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                                    <img src={log.imageUrl} alt="Meal" className="w-full h-full object-cover" />
                                </div>
                                )}
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-800 text-lg mb-1">{log.description}</h3>
                                    
                                    {log.calories && (
                                        <p className="text-slate-500 font-medium text-sm mb-3">
                                        🔥 약 <span className="text-slate-800 font-bold">{log.calories}</span> kcal
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
                            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400">{log.studentName}</span>
                                <button className="text-xs text-orange-500 font-bold hover:underline">코멘트 남기기</button>
                            </div>
                            )}
                        </div>
                    )) : (
                        <div className="text-center py-12 text-slate-400">
                            <p>기록된 식단이 없습니다.</p>
                            {!isStaff && <p className="text-xs mt-1">오늘 무엇을 드셨나요? 기록해보세요!</p>}
                        </div>
                    )}
                </>
             )}
         </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <h3 className="text-xl font-bold text-slate-800 mb-2">
                {selectedDate ? `${selectedDate} 식단 기록` : '오늘의 식단 기록'}
            </h3>
            
            {/* Meal Type Selector */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
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
                onClick={handleAddMeal}
                disabled={isAnalyzing}
                className="w-full py-3.5 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-200 disabled:opacity-70 flex justify-center items-center gap-2 text-sm"
              >
                {isAnalyzing ? (
                   <>
                     <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     AI 분석 중...
                   </>
                ) : '기록하기'}
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-4">
              AI가 사진과 설명을 분석하여 칼로리와 영양 조언을 제공합니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
