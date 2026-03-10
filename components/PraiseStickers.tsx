
import React, { useState, useEffect, useCallback } from 'react';
import { PraiseSticker, User, UserRole } from '../types';
import { praiseStickerApi } from '../services/api';
import { useAppData } from '../services/AppContext';
import { useDataRefresh } from '../services/useWebSocket';
import toast from 'react-hot-toast';

interface PraiseStickersProps {
  user: User;
}

const STICKER_EMOJIS = [
  { emoji: '⭐', label: '스타' },
  { emoji: '🏆', label: '우승' },
  { emoji: '💪', label: '노력' },
  { emoji: '🎭', label: '연기' },
  { emoji: '🎵', label: '음악' },
  { emoji: '💃', label: '무용' },
  { emoji: '❤️', label: '사랑' },
  { emoji: '🔥', label: '열정' },
  { emoji: '👏', label: '박수' },
  { emoji: '🌟', label: '빛나는' },
  { emoji: '🎯', label: '목표달성' },
  { emoji: '📈', label: '성장' },
];

export const PraiseStickers: React.FC<PraiseStickersProps> = ({ user }) => {
  const [stickers, setStickers] = useState<PraiseSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('⭐');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [studentFilter, setStudentFilter] = useState<string>('all');

  const isStaff = user.role === UserRole.TEACHER || user.role === UserRole.DIRECTOR;
  const { allUsers } = useAppData();
  const students = allUsers.filter(u => u.role === UserRole.STUDENT);

  const loadData = useCallback(() => {
    praiseStickerApi.list()
      .then(setStickers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useDataRefresh('praise_stickers', loadData);

  const handleSend = async () => {
    if (!selectedStudentId || !message.trim()) {
      toast.error('학생과 메시지를 입력해주세요.');
      return;
    }
    setSending(true);
    try {
      const newSticker = await praiseStickerApi.create({
        recipientId: selectedStudentId,
        emoji: selectedEmoji,
        message: message.trim(),
      });
      setStickers(prev => [newSticker, ...prev]);
      setShowSendModal(false);
      setSelectedStudentId('');
      setMessage('');
      setSelectedEmoji('⭐');
      toast.success('칭찬스티커를 보냈습니다!');
    } catch {
      toast.error('스티커 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const filteredStickers = stickers.filter(s =>
    studentFilter === 'all' || s.recipientId === studentFilter
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-4">
        {isStaff && (
          <>
            <select
              value={studentFilter}
              onChange={e => setStudentFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none"
            >
              <option value="all">전체 학생</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors text-sm font-bold shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              칭찬스티커 보내기
            </button>
          </>
        )}
        <span className="text-xs text-slate-400 font-medium ml-auto">{filteredStickers.length}개</span>
      </div>

      {/* Sticker List */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {filteredStickers.length > 0 ? filteredStickers.map(sticker => (
          <div key={sticker.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow">
            <div className="flex gap-4 items-start">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-100 flex items-center justify-center text-3xl">
                {sticker.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-slate-800">{sticker.recipientName}</span>
                  <span className="text-xs text-slate-400">에게</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{sticker.message}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {sticker.senderName} 선생님 · {new Date(sticker.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-4">⭐</div>
            <p className="font-medium">{isStaff ? '아직 보낸 칭찬스티커가 없습니다.' : '아직 받은 칭찬스티커가 없습니다.'}</p>
            {isStaff && <p className="text-xs mt-1">학생들에게 칭찬스티커를 보내보세요!</p>}
          </div>
        )}
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowSendModal(false)}>
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md p-5 md:p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowSendModal(false)}
              aria-label="닫기"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-4">칭찬스티커 보내기</h3>

            {/* Student Select */}
            <label className="block text-xs font-bold text-slate-500 mb-1">학생 선택</label>
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-3 mb-4 bg-white focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none"
            >
              <option value="">학생을 선택하세요</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Emoji Select */}
            <label className="block text-xs font-bold text-slate-500 mb-2">아이콘 선택</label>
            <div className="grid grid-cols-6 gap-2 mb-4">
              {STICKER_EMOJIS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                    selectedEmoji === emoji
                      ? 'bg-brand-50 ring-2 ring-brand-400 scale-105'
                      : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-xs text-slate-500">{label}</span>
                </button>
              ))}
            </div>

            {/* Message */}
            <label className="block text-xs font-bold text-slate-500 mb-1">응원 메시지</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="예: 오늘 연기 정말 감동적이었어요! 계속 이렇게 열심히 해봐요!"
              className="w-full p-3 rounded-xl border border-slate-200 h-24 resize-none outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 text-sm text-slate-600 placeholder:text-slate-300 mb-4"
            />

            {/* Preview */}
            {selectedStudentId && message.trim() && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-100 rounded-xl p-3 mb-4">
                <p className="text-xs text-slate-500 mb-1">미리보기</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedEmoji}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{students.find(s => s.id === selectedStudentId)?.name}에게</p>
                    <p className="text-xs text-slate-600">{message}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={sending || !selectedStudentId || !message.trim()}
              className="w-full py-3.5 rounded-xl bg-brand-500 text-white font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200 disabled:opacity-50 text-sm"
            >
              {sending ? '보내는 중...' : '스티커 보내기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
