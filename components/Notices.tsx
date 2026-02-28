import React from 'react';
import { User } from '../types';

interface NoticesProps {
  user: User;
}

export const Notices: React.FC<NoticesProps> = ({ user }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">공지사항</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className="flex justify-between items-start mb-2">
               <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                 중요
               </span>
               <span className="text-xs text-slate-400">2023.10.{20-i}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 group-hover:text-orange-500 transition-colors">
              {i === 1 ? '10월 정기 모의 평가 안내' : i === 2 ? '겨울방학 특강 수강신청' : '연습실 사용 규정 변경 안내'}
            </h3>
            <p className="text-slate-500 text-sm mt-2 line-clamp-2">
              안녕하세요, 뮤즈 아카데미입니다. 다가오는 {i === 1 ? '모의 평가' : '시즌'} 관련하여 안내 말씀 드립니다. 자세한 내용은...
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};