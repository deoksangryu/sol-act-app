
import React, { useState, useEffect, useRef } from 'react';
import { User, ClassInfo, ChatMessage, UserRole, Subject } from '../types';
import { chatApi, classApi, resolveFileUrl } from '../services/api';
import { useChatWebSocket } from '../services/useWebSocket';
import { ConfirmDialog } from './ConfirmDialog';
import toast from 'react-hot-toast';
import { formatTimeKo } from '../services/dateUtils';
import { useAppData } from '../services/AppContext';

interface ChatProps {
  user: User;
}

export const Chat: React.FC<ChatProps> = ({ user }) => {
  const { allUsers, classes, setClasses } = useAppData();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastMessageByClass, setLastMessageByClass] = useState<Record<string, ChatMessage>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [leaveConfirm, setLeaveConfirm] = useState<{ classId: string; isStaff: boolean } | null>(null);
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

  // WebSocket for real-time chat (single unified connection)
  const { sendMessage: wsSendMessage } = useChatWebSocket(
    selectedClassId,
    (msg) => {
      setMessages(prev => [...prev, msg]);
      // Update last_read_at since user is actively viewing this class
      if (msg.senderId !== user.id) {
        chatApi.markRead(msg.classId).catch(() => {});
      }
    },
    (classId, msg) => {
      setLastMessageByClass(prev => ({ ...prev, [classId]: msg }));
      // Increment unread if message is from someone else and not in the selected class
      if (msg.senderId !== user.id && classId !== selectedClassId) {
        setUnreadCounts(prev => ({ ...prev, [classId]: (prev[classId] || 0) + 1 }));
      }
    }
  );

  // Load last message previews + unread counts for all classes
  useEffect(() => {
    const ids = myClasses.map(c => c.id);
    if (ids.length === 0) return;
    chatApi.lastMessages(ids).then(map => {
      setLastMessageByClass(prev => ({ ...prev, ...map }));
    }).catch((err) => {
      console.error('Failed to load last messages:', err);
    });
    chatApi.unreadCounts(ids).then(counts => {
      setUnreadCounts(prev => ({ ...prev, ...counts }));
    }).catch((err) => {
      console.error('Failed to load unread counts:', err);
    });
  }, [classes.length]);

  // Fetch messages when selectedClassId changes (merge with WS messages to prevent loss)
  useEffect(() => {
    if (!selectedClassId) { setMessages([]); return; }
    // Mark as read + clear unread badge
    chatApi.markRead(selectedClassId).catch(() => {});
    setUnreadCounts(prev => { const next = { ...prev }; delete next[selectedClassId]; return next; });
    chatApi.list(selectedClassId).then(restMsgs => {
      setMessages(prev => {
        const restIds = new Set(restMsgs.map(m => m.id));
        const wsOnly = prev.filter(m => m.classId === selectedClassId && !restIds.has(m.id));
        return [...restMsgs, ...wsOnly];
      });
      if (restMsgs.length > 0) {
        setLastMessageByClass(prev => ({ ...prev, [selectedClassId]: restMsgs[restMsgs.length - 1] }));
      }
    }).catch((err) => {
      console.error('Failed to load messages:', err);
      toast.error(err.message || '메시지를 불러오지 못했습니다.');
    });
  }, [selectedClassId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedClassId]);

  // ESC key handler for modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreateModalOpen) { setIsCreateModalOpen(false); return; }
        if (isInviteOpen) { setIsInviteOpen(false); return; }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isCreateModalOpen, isInviteOpen]);

  const currentClassMessages = messages;
  const currentClass = classes.find(c => c.id === selectedClassId);

  const handleSend = () => {
    if (!inputText.trim() || !selectedClassId) return;
    wsSendMessage(selectedClassId, inputText);
    setInputText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLeaveClass = () => {
    if (!currentClass) return;
    setLeaveConfirm({ classId: currentClass.id, isStaff });
  };

  const handleLeaveConfirm = async () => {
    if (!leaveConfirm || !currentClass) return;

    try {
      if (leaveConfirm.isStaff) {
        await classApi.delete(currentClass.id);
        setClasses(classes.filter(c => c.id !== currentClass.id));
        setSelectedClassId(null);
        setIsSettingsOpen(false);
        toast.success('클래스 및 채팅방이 삭제되었습니다.');
      } else {
        const newStudentIds = currentClass.studentIds.filter(id => id !== user.id);
        await classApi.update(currentClass.id, { studentIds: newStudentIds });
        const updatedClass = { ...currentClass, studentIds: newStudentIds };
        setClasses(classes.map(c => c.id === currentClass.id ? updatedClass : c));
        setSelectedClassId(null);
        setIsSettingsOpen(false);
        toast.success('채팅방에서 나갔습니다.');
      }
    } catch {
      toast.error('처리에 실패했습니다.');
    }
    setLeaveConfirm(null);
  };

  const handleInviteUser = async (userId: string) => {
    if (!currentClass) return;

    if (currentClass.studentIds.includes(userId)) {
      toast.error('이미 참여 중인 사용자입니다.');
      return;
    }

    try {
      const newStudentIds = [...currentClass.studentIds, userId];
      await classApi.update(currentClass.id, { studentIds: newStudentIds });
      const updatedClass = { ...currentClass, studentIds: newStudentIds };
      setClasses(classes.map(c => c.id === currentClass.id ? updatedClass : c));
      setIsInviteOpen(false);
      toast.success('사용자를 초대했습니다.');
    } catch {
      toast.error('초대에 실패했습니다.');
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    try {
      const newClass = await classApi.create({
        name: newClassName,
        description: newClassDesc || '새로운 채팅방',
        schedule: [],
      });
      setClasses([...classes, newClass]);
      setSelectedClassId(newClass.id);
      setIsCreateModalOpen(false);
      setNewClassName('');
      setNewClassDesc('');
      toast.success('새 채팅방이 개설되었습니다.');
    } catch { toast.error('채팅방 개설에 실패했습니다.'); }
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
              className="p-2 bg-white rounded-full text-slate-400 hover:text-brand-500 hover:shadow-sm transition-all"
              title="새 채팅방 만들기"
              aria-label="새 채팅방 만들기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {myClasses.length > 0 ? myClasses.map((c) => {
            const lastMsg = lastMessageByClass[c.id];
            const unread = unreadCounts[c.id] || 0;
            return (
              <div
                key={c.id}
                onClick={() => { setSelectedClassId(c.id); setIsSettingsOpen(false); }}
                className={`p-3 rounded-xl cursor-pointer transition-colors ${selectedClassId === c.id ? 'bg-white shadow-sm ring-1 ring-brand-100' : 'hover:bg-white hover:shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`font-bold text-sm ${selectedClassId === c.id ? 'text-brand-600' : 'text-slate-700'}`}>{c.name}</h3>
                  <div className="flex items-center gap-1.5">
                    {lastMsg && <span className="text-xs text-slate-400">{formatTimeKo(lastMsg.timestamp)}</span>}
                    {unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-brand-500 text-white text-xs font-bold rounded-full">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
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
                 <button onClick={() => setSelectedClassId(null)} aria-label="뒤로 가기" className="md:hidden text-slate-400 hover:text-slate-600">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                 </button>
                 <div>
                   <h3 className="font-bold text-slate-800">{currentClass.name}</h3>
                   <p className="text-xs text-slate-400">{currentClass.studentIds.length + Object.values(currentClass.subjectTeachers || {}).filter(Boolean).length}명 참여 중</p>
                 </div>
               </div>
               <button
                 onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                 aria-label="채팅방 정보"
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
                      {!isMe && <img src={resolveFileUrl(msg.avatar)} alt={msg.senderName} className="w-8 h-8 rounded-full bg-slate-200" />}
                      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                         {!isMe && <span className="text-xs text-slate-500 mb-1 ml-1">{msg.senderName}</span>}
                         <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                           isMe
                             ? 'bg-brand-500 text-white rounded-tr-none shadow-md shadow-brand-100'
                             : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm'
                         }`}>
                           {msg.content}
                         </div>
                         <span className="text-xs text-slate-300 mt-1 px-1">
                           {formatTimeKo(msg.timestamp)}
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
                   className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition-colors"
                   placeholder="메시지를 입력하세요..."
                 />
                 <button
                   onClick={handleSend}
                   aria-label="메시지 보내기"
                   className="bg-brand-500 text-white p-3 rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-100"
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
                    <button onClick={() => setIsSettingsOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-600">
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
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Members ({currentClass.studentIds.length + Object.values(currentClass.subjectTeachers || {}).filter(Boolean).length})</h4>
                         {isStaff && (
                           <button
                             onClick={() => setIsInviteOpen(true)}
                             className="text-xs font-bold text-brand-500 bg-brand-50 px-3 py-2 rounded-lg hover:bg-brand-100"
                           >
                             + 초대
                           </button>
                         )}
                       </div>
                       <div className="space-y-3">
                          {/* Teachers */}
                          {Object.entries(currentClass.subjectTeachers || {}).map(([subject, teacherId]) => {
                            const teacher = allUsers.find(u => u.id === teacherId);
                            if (!teacher) return null;
                            return (
                              <div key={teacherId} className="flex items-center gap-2">
                                <img src={resolveFileUrl(teacher.avatar)} alt={teacher.name} className="w-8 h-8 rounded-full bg-slate-200" />
                                <div>
                                  <p className="text-sm font-bold text-slate-700">{teacher.name}</p>
                                  <p className="text-xs text-slate-400">선생님 · {subject}</p>
                                </div>
                              </div>
                            );
                          })}
                          {/* Students */}
                          {currentClass.studentIds.map(sid => {
                            const student = allUsers.find(u => u.id === sid);
                            return student ? (
                              <div key={sid} className="flex items-center gap-2">
                                <img src={resolveFileUrl(student.avatar)} alt={student.name} className="w-8 h-8 rounded-full bg-slate-200" />
                                <div>
                                  <p className="text-sm font-medium text-slate-700">{student.name}</p>
                                  <p className="text-xs text-slate-400">Student</p>
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/20 backdrop-blur-sm p-0 md:p-4 animate-fade-in" onClick={() => setIsInviteOpen(false)}>
           <div role="dialog" aria-modal="true" className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-sm p-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                       <img src={resolveFileUrl(u.avatar)} className="w-8 h-8 rounded-full bg-slate-200" alt={u.name} />
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
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-fade-in" onClick={() => setIsCreateModalOpen(false)}>
           <div role="dialog" aria-modal="true" className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-md p-5 md:p-6 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <button
               onClick={() => setIsCreateModalOpen(false)}
               aria-label="닫기"
               className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <h3 className="text-xl font-bold text-slate-800 mb-6">새 채팅방 개설</h3>
              <div className="space-y-4">
                 <div>
                   <label htmlFor="input-chat-name" className="block text-xs font-bold text-slate-500 mb-1">채팅방 이름 <span className="text-red-400">*</span></label>
                   <input
                     id="input-chat-name"
                     value={newClassName}
                     onChange={(e) => setNewClassName(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500"
                     placeholder="예: 뮤지컬 입시반 공지방"
                   />
                 </div>
                 <div>
                   <label htmlFor="input-chat-desc" className="block text-xs font-bold text-slate-500 mb-1">설명</label>
                   <textarea
                     id="input-chat-desc"
                     value={newClassDesc}
                     onChange={(e) => setNewClassDesc(e.target.value)}
                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-brand-500 resize-none h-20"
                     placeholder="채팅방에 대한 설명을 입력하세요."
                   />
                 </div>
                 <button
                   onClick={handleCreateClass}
                   className="w-full bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 shadow-lg shadow-brand-200 mt-2"
                 >
                   개설하기
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Leave Class Confirm Dialog */}
      {leaveConfirm && (
        <ConfirmDialog
          title={leaveConfirm.isStaff ? '채팅방 삭제' : '채팅방 나가기'}
          message={leaveConfirm.isStaff ? '선생님이 채팅방을 나가면 클래스가 삭제됩니다. 계속하시겠습니까?' : '이 채팅방(클래스)에서 나가시겠습니까?'}
          confirmLabel="확인"
          cancelLabel="취소"
          variant={leaveConfirm.isStaff ? 'danger' : 'warning'}
          onConfirm={handleLeaveConfirm}
          onCancel={() => setLeaveConfirm(null)}
        />
      )}
    </div>
  );
};
