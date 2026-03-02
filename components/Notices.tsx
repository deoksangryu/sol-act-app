import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { noticeApi } from '../services/api';
import { Notice } from '../types';
import { useDataRefresh } from '../services/useWebSocket';
import { formatDateKo } from '../services/dateUtils';
import { ConfirmDialog } from './ConfirmDialog';
import toast from 'react-hot-toast';

interface NoticesProps {
  user: User;
}

export const Notices: React.FC<NoticesProps> = ({ user }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImportant, setNewImportant] = useState(false);
  const [deleteNoticeId, setDeleteNoticeId] = useState<string | null>(null);

  const loadData = useCallback(() => {
    return noticeApi.list().then(setNotices).catch(console.error);
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  useDataRefresh('notices', loadData);

  const handleCreateNotice = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      await noticeApi.create({
        title: newTitle,
        content: newContent,
        isImportant: newImportant,
        authorId: user.id,
        authorName: user.name,
      });
      toast.success('공지사항이 작성되었습니다.');
      setIsCreateOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewImportant(false);
      await loadData();
    } catch (error) {
      console.error('Failed to create notice:', error);
      toast.error('공지사항 작성에 실패했습니다.');
    }
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
        {user.role === UserRole.DIRECTOR && (
          <button
            onClick={() => setIsCreateOpen(true)}
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
          <div key={notice.id} className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-2">
                 {notice.important && (
                   <span className="bg-brand-100 text-brand-600 text-[10px] font-bold px-2 py-0.5 rounded-full">중요</span>
                 )}
                 <span className="text-xs text-slate-400">{formatDateKo(notice.date)}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 group-hover:text-brand-500 transition-colors truncate">{notice.title}</h3>
              <p className="text-slate-500 text-sm mt-2 line-clamp-2">{notice.content}</p>
            </div>
            {user.role === UserRole.DIRECTOR && (
              <button
                onClick={() => setDeleteNoticeId(notice.id)}
                className="text-red-500 hover:text-red-700 transition-colors font-bold text-lg leading-none mt-1 shrink-0"
                title="삭제"
              >
                ×
              </button>
            )}
          </div>
        )) : (
          <div className="p-8 text-center text-slate-400">등록된 공지사항이 없습니다.</div>
        )}
      </div>

      {/* Create Notice Modal */}
      {isCreateOpen && user.role === UserRole.DIRECTOR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">공지사항 작성</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">제목</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="공지사항 제목을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">내용</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="공지사항 내용을 입력하세요"
                  rows={5}
                />
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
                onClick={handleCreateNotice}
                className="flex-1 px-4 py-2 bg-brand-500 text-white text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors"
              >
                작성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteNoticeId !== null}
        title="공지사항 삭제"
        message="이 공지사항을 삭제하시겠습니까?"
        onConfirm={handleDeleteNotice}
        onCancel={() => setDeleteNoticeId(null)}
        isDangerous
      />
    </div>
  );
};
