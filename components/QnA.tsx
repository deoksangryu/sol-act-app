
import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, Question, Answer } from '../types';
import { qnaApi } from '../services/api';
import toast from 'react-hot-toast';
import { useDataRefresh } from '../services/useWebSocket';

interface QnAProps {
  user: User;
}

export const QnA: React.FC<QnAProps> = ({ user }) => {
  const isTeacher = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Create Form State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // Answer Form State
  const [newAnswer, setNewAnswer] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Load questions from API
  const loadData = useCallback(() => {
    return qnaApi.listQuestions().then(setQuestions).catch(console.error);
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  useDataRefresh('qna', loadData);

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  const handleCreateQuestion = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      const newQ = await qnaApi.createQuestion({ title: newTitle, content: newContent });
      setQuestions([newQ, ...questions]);
      setNewTitle(''); setNewContent('');
      setCurrentView('list');
      toast.success('질문이 등록되었습니다.');
    } catch { toast.error('질문 등록에 실패했습니다.'); }
  };

  const handleAddAnswer = async () => {
    if (!newAnswer.trim() || !selectedQuestionId) return;
    try {
      const answer = await qnaApi.createAnswer(selectedQuestionId, { content: newAnswer });
      setQuestions(prev => prev.map(q =>
        q.id === selectedQuestionId ? { ...q, answers: [...q.answers, answer] } : q
      ));
      setNewAnswer('');
      toast.success('답변이 등록되었습니다.');
    } catch { toast.error('답변 등록에 실패했습니다.'); }
  };

  const handleAiHelp = async () => {
    if (!selectedQuestion) return;
    setIsAiLoading(true);
    try {
      const aiAnswer = await qnaApi.getAiAnswer(selectedQuestion.id);
      setQuestions(prev => prev.map(q =>
        q.id === selectedQuestionId ? { ...q, answers: [...q.answers, aiAnswer] } : q
      ));
      toast.success('AI 답변이 생성되었습니다.');
    } catch { toast.error('AI 답변 생성 중 오류가 발생했습니다.'); }
    finally { setIsAiLoading(false); }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">질의응답</h2>
           <p className="text-sm text-slate-500">연기, 입시, 고민 무엇이든 물어보세요.</p>
        </div>
        {currentView === 'list' && (
          <button
            onClick={() => setCurrentView('create')}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            질문하기
          </button>
        )}
        {currentView !== 'list' && (
          <button
            onClick={() => setCurrentView('list')}
            className="text-slate-500 hover:text-slate-800 font-medium text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            목록으로
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">

        {/* LIST VIEW */}
        {currentView === 'list' && (
          <div className="space-y-4 overflow-y-auto h-full pb-20 pr-1">
            {questions.map((q) => (
              <div
                key={q.id}
                onClick={() => { setSelectedQuestionId(q.id); setCurrentView('detail'); }}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-lg text-slate-800 group-hover:text-brand-500 transition-colors line-clamp-1">{q.title}</h3>
                   {q.answers.length > 0 ? (
                     <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">답변완료</span>
                   ) : (
                     <span className="bg-slate-100 text-slate-400 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">대기중</span>
                   )}
                </div>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4 h-10">{q.content}</p>
                <div className="flex justify-between items-center text-xs text-slate-400 border-t border-slate-50 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600">{q.authorName}</span>
                    <span>•</span>
                    <span>{new Date(q.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      {q.views}
                    </span>
                    <span className="flex items-center gap-1 text-brand-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                      {q.answers.length}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CREATE VIEW */}
        {currentView === 'create' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full flex flex-col">
            <input
              className="w-full text-lg font-bold placeholder:text-slate-300 border-b border-slate-100 pb-3 mb-4 outline-none focus:border-brand-500 transition-colors"
              placeholder="제목을 입력하세요"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <textarea
              className="w-full flex-1 resize-none outline-none text-slate-600 leading-relaxed placeholder:text-slate-300"
              placeholder="궁금한 내용을 자세히 적어주세요..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
            />
            <div className="pt-4 flex justify-end">
              <button
                onClick={handleCreateQuestion}
                className="bg-brand-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all"
              >
                질문 등록하기
              </button>
            </div>
          </div>
        )}

        {/* DETAIL VIEW */}
        {currentView === 'detail' && selectedQuestion && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pb-20 scroll-smooth">
              {/* Question */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                    {selectedQuestion.authorName[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{selectedQuestion.authorName}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(selectedQuestion.date)}</p>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">{selectedQuestion.title}</h3>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedQuestion.content}</p>
              </div>

              {/* AI Banner if no answers or manual trigger */}
              <div className="flex justify-between items-center px-2 mb-2">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">답변 {selectedQuestion.answers.length}</h4>
                {isTeacher && (
                  <button
                    onClick={handleAiHelp}
                    disabled={isAiLoading}
                    className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-full font-bold hover:bg-purple-100 transition-colors flex items-center gap-1"
                  >
                     {isAiLoading ? (
                       <span className="animate-pulse">AI 작성 중...</span>
                     ) : (
                       <>
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                         AI 답변 요청
                       </>
                     )}
                  </button>
                )}
              </div>

              {/* Answers */}
              <div className="space-y-4">
                {selectedQuestion.answers.map((answer) => (
                  <div
                    key={answer.id}
                    className={`p-5 rounded-2xl border ${
                      answer.isAi
                        ? 'bg-purple-50 border-purple-100'
                        : 'bg-white border-slate-100'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {answer.isAi ? (
                          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                            {answer.authorName[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-slate-700">{answer.authorName}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(answer.date)}</p>
                        </div>
                      </div>
                      {!answer.isAi && (answer.authorId === user.id || user.role === UserRole.DIRECTOR) && (
                        <button onClick={async () => {
                          if (!confirm('이 답변을 삭제하시겠습니까?')) return;
                          try {
                            await qnaApi.deleteAnswer(answer.id);
                            setQuestions(prev => prev.map(q => q.id === selectedQuestionId ? { ...q, answers: q.answers.filter(a => a.id !== answer.id) } : q));
                            toast.success('답변이 삭제되었습니다.');
                          } catch { toast.error('답변 삭제에 실패했습니다.'); }
                        }} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                      )}
                    </div>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{answer.content}</p>
                  </div>
                ))}
              </div>

              {/* Answer Input - Teachers only */}
              {isTeacher && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAnswer}
                      onChange={(e) => setNewAnswer(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddAnswer()}
                      placeholder="답변을 입력하세요..."
                      className="flex-1 p-3 border border-slate-200 rounded-xl focus:border-brand-500 outline-none"
                    />
                    <button
                      onClick={handleAddAnswer}
                      className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
                    >
                      답변
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
