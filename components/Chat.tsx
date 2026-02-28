
import React, { useState, useEffect, useRef } from 'react';
import { User, ClassInfo, ChatMessage, UserRole, Subject } from '../types';
import toast from 'react-hot-toast';

interface ChatProps {
  user: User;
  classes: ClassInfo[];
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
  setClasses: (classes: ClassInfo[]) => void;
  allUsers: User[];
}

export const Chat: React.FC<ChatProps> = ({ user, classes, messages, onSendMessage, setClasses, allUsers }) => {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create Class State (for Directors inside Chat)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');

  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const isDirector = user.role === UserRole.DIRECTOR;

  // Filter classes: Directors see all, Teachers see own, Students see enrolled
  const myClasses = classes.filter(c => {
      if (user.role === UserRole.DIRECTOR) return true;
      if (user.role === UserRole.TEACHER) return Object.values(c.subjectTeachers).includes(user.id);
      return c.studentIds.includes(user.id);
  });

  // Auto-select first class if available and none selected
  useEffect(() => {
    if (myClasses.length > 0 && !selectedClassId) {
      // Optional: Auto-select logic could go here
    }
  }, [myClasses.length]); 

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedClassId]);

  const currentClassMessages = messages.filter(m => m.classId === selectedClassId);
  const currentClass = classes.find(c => c.id === selectedClassId);

  const handleSend = () => {
    if (!inputText.trim() || !selectedClassId) return;

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      classId: selectedClassId,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      content: inputText,
      timestamp: new Date().toISOString(),
      avatar: user.avatar
    };

    onSendMessage(newMsg);
    setInputText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLeaveClass = () => {
    if (!currentClass) return;

    if (isStaff) {
      if (confirm('선생님이 채팅방을 나가면 클래스가 삭제됩니다. 계속하시겠습니까?')) {
        setClasses(classes.filter(c => c.id !== currentClass.id));
        setSelectedClassId(null);
        setIsSettingsOpen(false);
        toast.success('클래스 및 채팅방이 삭제되었습니다.');
      }
    } else {
      if (confirm('이 채팅방(클래스)에서 나가시겠습니까?')) {
        const updatedClass = {
          ...currentClass,
          studentIds: currentClass.studentIds.filter(id => id !== user.id)
        };
        setClasses(classes.map(c => c.id === currentClass.id ? updatedClass : c));
        setSelectedClassId(null);
        setIsSettingsOpen(false);
        toast.success('채팅방에서 나갔습니다.');
      }
    }
  };

  const handleInviteUser = (userId: string) => {
    if (!currentClass) return;
    
    if (currentClass.studentIds.includes(userId)) {
      toast.error('이미 참여 중인 사용자입니다.');
      return;
    }

    const updatedClass = {
      ...currentClass,
      studentIds: [...currentClass.studentIds, userId]
    };
    setClasses(classes.map(c => c.id === currentClass.id ? updatedClass : c));
    setIsInviteOpen(false);
    toast.success('사용자를 초대했습니다.');
  };

  const handleCreateClass = () => {
    if (!newClassName.trim()) return;

    const newClass: ClassInfo = {
      id: Date.now().toString(),
      name: newClassName,
      description: newClassDesc || '새로운 채팅방',
      subjectTeachers: {},
      studentIds: [],
      schedule: '일정 미정'
    };
    
    setClasses([...classes, newClass]);
    setSelectedClassId(newClass.id);
    setIsCreateModalOpen(false);
    setNewClassName('');
    setNewClassDesc('');
    toast.success('새 채팅방이 개설되었습니다.');
  };

  return (
    <div className="flex h-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-0">
      
      {/* Sidebar: Class List */}
      <div className={`w-full md:w-80 bg-slate-50 border-r border-slate-100 flex flex-col ${selectedClassId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-200 flex justify-between items-center shrink-0 h-16">
          <h2 className="font-bold text-slate-800">내 채팅방</h2>
          {isDirector && (
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="p-2 bg-white rounded-full text-slate-400 hover:text-orange-500 hover:shadow-sm transition-all"
              title="새 채팅방 만들기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {myClasses.length > 0 ? myClasses.map((c) => {
            const lastMsg = messages.filter(m => m.classId === c.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
            return (
              <div 
                key={c.id}
                onClick={() => { setSelectedClassId(c.id); setIsSettingsOpen(false); }}
                className={`p-3 rounded-xl cursor-pointer transition-colors ${selectedClassId === c.id ? 'bg-white shadow-sm ring-1 ring-orange-100' : 'hover:bg-white hover:shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`font-bold text-sm ${selectedClassId === c.id ? 'text-orange-600' : 'text-slate-700'}`}>{c.name}</h3>
                  {lastMsg && <span className="text-[10px] text-slate-400">{new Date(lastMsg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                </div>
                <p className="text-xs text-slate-500 line-clamp-1 h-4">
                  {lastMsg ? `${lastMsg.senderName}: ${lastMsg.content}` : <span className="text-slate-300">대화 내용이 없습니다.</span>}
                </p>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              참여 중인 채팅방이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col relative ${!selectedClassId ? 'hidden md:flex' : 'flex'}`}>
        {selectedClassId && currentClass ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
               <div className="flex items-center gap-3">
                 <button onClick={() => setSelectedClassId(null)} className="md:hidden text-slate-400 hover:text-slate-600">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                 </button>
                 <div>
                   <h3 className="font-bold text-slate-800">{currentClass.name}</h3>
                   <p className="text-xs text-slate-400">{currentClass.studentIds.length}명 참여 중</p>
                 </div>
               </div>
               <button 
                 onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                 className={`p-2 rounded-full transition-colors ${isSettingsOpen ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'}`}
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 relative">
               {currentClassMessages.map((msg) => {
                 const isMe = msg.senderId === user.id;
                 return (
                   <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      {!isMe && <img src={msg.avatar} alt={msg.senderName} className="w-8 h-8 rounded-full bg-slate-200" />}
                      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                         {!isMe && <span className="text-[10px] text-slate-500 mb-1 ml-1">{msg.senderName}</span>}
                         <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                           isMe 
                             ? 'bg-orange-500 text-white rounded-tr-none shadow-md shadow-orange-100' 
                             : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm'
                         }`}>
                           {msg.content}
                         </div>
                         <span className="text-[10px] text-slate-300 mt-1 px-1">
                           {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </span>
                      </div>
                   </div>
                 );
               })}
               <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
               <div className="flex gap-2">
                 <input 
                   value={inputText}
                   onChange={(e) => setInputText(e.target.value)}
                   onKeyDown={handleKeyPress}
                   className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                   placeholder="메시지를 입력하세요..."
                 />
                 <button 
                   onClick={handleSend}
                   className="bg-orange-500 text-white p-3 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-100"
                 >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9-2zm0 0v-8" /></svg>
                 </button>
               </div>
            </div>

            {/* Settings Panel (Overlay) */}
            {isSettingsOpen && (
              <div className="absolute inset-y-0 right-0 w-full md:w-72 bg-white shadow-2xl border-l border-slate-100 z-10 animate-fade-in-right flex flex-col">
                 <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800">채팅방 정보</h3>
                    <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                 </div>
                 
                 <div className="p-5 flex-1 overflow-y-auto">
                    <div className="mb-6">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Description</h4>
                      <p className="text-sm text-slate-600">{currentClass.description}</p>
                    </div>

                    <div className="mb-6">
                       <div className="flex justify-between items-center mb-3">
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Members ({currentClass.studentIds.length + 1})</h4>
                         {isStaff && (
                           <button 
                             onClick={() => setIsInviteOpen(true)}
                             className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded hover:bg-orange-100"
                           >
                             + 초대
                           </button>
                         )}
                       </div>
                       <div className="space-y-3">
                          {/* Teacher */}
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">T</div>
                             <div>
                               <p className="text-sm font-bold text-slate-700">담당 선생님</p>
                               <p className="text-[10px] text-slate-400">Teacher</p>
                             </div>
                          </div>
                          {/* Students */}
                          {currentClass.studentIds.map(sid => {
                            const student = allUsers.find(u => u.id === sid);
                            return student ? (
                              <div key={sid} className="flex items-center gap-2">
                                <img src={student.avatar} alt={student.name} className="w-8 h-8 rounded-full bg-slate-200" />
                                <div>
                                  <p className="text-sm font-medium text-slate-700">{student.name}</p>
                                  <p className="text-[10px] text-slate-400">Student</p>
                                </div>
                              </div>
                            ) : null;
                          })}
                       </div>
                    </div>
                 </div>

                 <div className="p-5 border-t border-slate-100 bg-slate-50/30">
                    <button 
                      onClick={handleLeaveClass}
                      className="w-full py-2 border border-red-200 text-red-500 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                    >
                      {isStaff ? '채팅방 삭제' : '나가기'}
                    </button>
                 </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
             <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
               <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             </div>
             <p className="font-medium text-slate-500">채팅방을 선택해주세요.</p>
             {isDirector && <p className="text-xs mt-1">또는 새로운 채팅방을 만들어보세요.</p>}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4">
              <h3 className="font-bold text-slate-800 mb-4">대화상대 초대</h3>
              <div className="max-h-60 overflow-y-auto space-y-1 mb-4">
                 {allUsers
                   .filter(u => u.role === UserRole.STUDENT && currentClass && !currentClass.studentIds.includes(u.id))
                   .map(u => (
                     <button 
                       key={u.id}
                       onClick={() => handleInviteUser(u.id)}
                       className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                     >
                       <img src={u.avatar} className="w-8 h-8 rounded-full bg-slate-200" alt={u.name} />
                       <span className="text-sm font-medium text-slate-700">{u.name}</span>
                     </button>
                   ))
                 }
                 {allUsers.filter(u => u.role === UserRole.STUDENT && currentClass && !currentClass.studentIds.includes(u.id)).length === 0 && (
                   <p className="text-center text-xs text-slate-400 py-4">초대할 수 있는 학생이 없습니다.</p>
                 )}
              </div>
              <button onClick={() => setIsInviteOpen(false)} className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">닫기</button>
           </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative">
              <button 
               onClick={() => setIsCreateModalOpen(false)}
               className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <h3 className="text-xl font-bold text-slate-800 mb-6">새 채팅방 개설</h3>
              <div className="space-y-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">채팅방 이름</label>
                   <input 
                     value={newClassName}
                     onChange={(e) => setNewClassName(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500"
                     placeholder="예: 뮤지컬 입시반 공지방"
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 mb-1">설명</label>
                   <textarea 
                     value={newClassDesc}
                     onChange={(e) => setNewClassDesc(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-orange-500 resize-none h-20"
                     placeholder="채팅방에 대한 설명을 입력하세요."
                   />
                 </div>
                 <button 
                   onClick={handleCreateClass}
                   className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 shadow-lg shadow-orange-200 mt-2"
                 >
                   개설하기
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
