import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { noticeApi } from '../services/api';
import { Notice } from '../types';
import { useDataRefresh } from '../services/useWebSocket';
import { formatDateKo } from '../services/dateUtils';

interface NoticesProps {
  user: User;
}

export const Notices: React.FC<NoticesProps> = ({ user }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    return noticeApi.list().then(setNotices).catch(console.error);
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  useDataRefresh('notices', loadData);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">공지사항</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-slate-300 border-t-brand-400 rounded-full animate-spin mx-auto"></div></div>
        ) : notices.length > 0 ? notices.map((notice) => (
          <div key={notice.id} className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className="flex justify-between items-start mb-2">
               {notice.important && (
                 <span className="bg-brand-100 text-brand-600 text-[10px] font-bold px-2 py-0.5 rounded-full">중요</span>
               )}
               <span className="text-xs text-slate-400">{formatDateKo(notice.date)}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 group-hover:text-brand-500 transition-colors truncate">{notice.title}</h3>
            <p className="text-slate-500 text-sm mt-2 line-clamp-2">{notice.content}</p>
          </div>
        )) : (
          <div className="p-8 text-center text-slate-400">등록된 공지사항이 없습니다.</div>
        )}
      </div>
    </div>
  );
};
