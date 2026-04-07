import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { noticeApi } from '../services/api';
import { Notice } from '../types';
import { useDataRefresh } from '../services/useWebSocket';
import { formatDateKo } from '../services/dateUtils';
import { ConfirmDialog } from './ConfirmDialog';
import toast from 'react-hot-toast';
import { useAppData } from '../services/AppContext';

interface NoticesProps {
  user: User;
}

export const Notices: React.FC<NoticesProps> = ({ user }) => {
  const { classes } = useAppData();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImportant, setNewImportant] = useState(false);
  const [newClassId, setNewClassId] = useState('');
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [deleteNoticeId, setDeleteNoticeId] = useState<string | null>(null);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const selectedNotice = notices.find(n => n.id === selectedNoticeId);

  const loadData = useCallback(() => {
    return noticeApi.list().then(setNotices).catch((err) => {
      console.error('Failed to load notices:', err);
      toast.error(err.message || '공지사항을 불러오지 못했습니다.');
    });
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  useDataRefresh('notices', loadData);

  // ESC key handler for modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreateOpen) { setIsCreateOpen(false); setEditingNotice(null); return; }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isCreateOpen]);

  const handleCreateNotice = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      // Teachers must select a class
      if (user.role === UserRole.TEACHER && !newClassId) {
        toast.error('클래스를 선택해주세요.');
        return;
      }
      await noticeApi.create({
        title: newTitle,
        content: newContent,
        important: newImportant,
        author: user.name,
        classId: newClassId || undefined,
      });
      toast.success('공지사항이 작성되었습니다.');
      setIsCreateOpen(false);
      setNewTitle(''); setNewClassId('');
      setNewContent('');
      setNewImportant(false);
      await loadData();
    } catch (error) {
      console.error('Failed to create notice:', error);
      toast.error('공지사항 작성에 실패했습니다.');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingNotice(null);
    setNewTitle(''); setNewContent(''); setNewImportant(false); setNewClassId('');
    setIsCreateOpen(true);
  };

  const handleOpenEditModal = (notice: Notice) => {
    setEditingNotice(notice);
    setNewTitle(notice.title);
    setNewContent(notice.content);
    setNewImportant(notice.important || false);
    setNewClassId(notice.classId || '');
    setIsCreateOpen(true);
  };

  const handleUpdateNotice = async () => {
    if (!editingNotice || !newTitle.trim() || !newContent.trim()) return;
    try {
      await noticeApi.update(editingNotice.id, {
        title: newTitle,
        content: newContent,
        isImportant: newImportant,
        classId: newClassId || undefined,
      });
      toast.success('공지사항이 수정되었습니다.');
      setIsCreateOpen(false);
      setEditingNotice(null);
      await loadData();
    } catch { toast.error('공지사항 수정에 실패했습니다.'); }
  };

  const handleDeleteNotice = async () => {
    if (!deleteNoticeId) return;

    try {
      await noticeApi.delete(deleteNoticeId);
      toast.success('공지사항이 삭제되었습니다.');
      setDeleteNoticeId(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete notice:', error);
      toast.error('공지사항 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">공지사항</h2>
        {user.role !== UserRole.STUDENT && (
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-brand-500 text-white text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors"
          >
            공지 작성
          </button>
        )}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-slate-300 border-t-brand-400 rounded-full animate-spin mx-auto"></div></div>
        ) : notices.length > 0 ? notices.map((notice) => (
          <div key={notice.id} onClick={() => setSelectedNoticeId(notice.id)} className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5 items-center mb-2">
                 {notice.important && (
                   <span className="bg-brand-100 text-brand-600 text-xs font-bold px-2 py-0.5 rounded-full">중요</span>
                 )}
                 {notice.classId && (
                   <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                     {classes.find(c => c.id === notice.classId)?.name || notice.classId}
                   </span>
                 )}
                 <span className="text-xs text-slate-400 ml-auto">{formatDateKo(notice.date)}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 group-hover:text-brand-500 transition-colors truncate">{notice.title}</h3>
              <p className="text-slate-500 text-sm mt-2 line-clamp-2">{notice.content}</p>
            </div>
            {user.role !== UserRole.STUDENT && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenEditModal(notice); }}
                  className="text-xs text-slate-400 hover:text-brand-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                >수정</button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteNoticeId(notice.id); }}
                  className="text-xs text-slate-400 hover:text-red-500 font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                >삭제</button>
              </div>
            )}
          </div>
        )) : (
          <div className="p-8 text-center text-slate-400">등록된 공지사항이 없습니다.</div>
        )}
      </div>

      {/* Create Notice Modal */}
      {isCreateOpen && user.role !== UserRole.STUDENT && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setIsCreateOpen(false); setEditingNotice(null); }}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editingNotice ? '공지사항 수정' : '공지사항 작성'}</h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="input-notice-title" className="block text-sm font-bold text-slate-700 mb-2">제목 <span className="text-red-400">*</span></label>
                <input
                  id="input-notice-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="공지사항 제목을 입력하세요"
                />
              </div>

              <div>
                <label htmlFor="input-notice-content" className="block text-sm font-bold text-slate-700 mb-2">내용 <span className="text-red-400">*</span></label>
                <textarea
                  id="input-notice-content"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="공지사항 내용을 입력하세요"
                  rows={5}
                />
              </div>

              <div>
                <label htmlFor="input-notice-target" className="block text-sm font-bold text-slate-700 mb-2">대상</label>
                <select
                  id="input-notice-target"
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-brand-500"
                >
                  {user.role === UserRole.DIRECTOR && <option value="">전체 공지 (학원)</option>}
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="important"
                  checked={newImportant}
                  onChange={(e) => setNewImportant(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="important" className="text-sm font-medium text-slate-700">중요 공지</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setNewTitle('');
                  setNewContent('');
                  setNewImportant(false);
                }}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={editingNotice ? handleUpdateNotice : handleCreateNotice}
                className="flex-1 px-4 py-2 bg-brand-500 text-white text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors"
              >
                {editingNotice ? '수정' : '작성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedNoticeId(null)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedNoticeId(null)} aria-label="닫기" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex flex-wrap gap-1.5 items-center mb-3">
              {selectedNotice.important && <span className="bg-brand-100 text-brand-600 text-xs font-bold px-2 py-0.5 rounded-full">중요</span>}
              {selectedNotice.classId && (
                <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {classes.find(c => c.id === selectedNotice.classId)?.name || selectedNotice.classId}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{selectedNotice.title}</h3>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-400">{selectedNotice.author}</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400">{formatDateKo(selectedNotice.date)}</span>
            </div>
            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedNotice.content}</div>
          </div>
        </div>
      )}

      {deleteNoticeId && (
        <ConfirmDialog
          title="공지사항 삭제"
          message="이 공지사항을 삭제하시겠습니까?"
          variant="danger"
          confirmLabel="삭제"
          onConfirm={handleDeleteNotice}
          onCancel={() => setDeleteNoticeId(null)}
        />
      )}
    </div>
  );
};
