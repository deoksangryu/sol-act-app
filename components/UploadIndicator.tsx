import React from 'react';
import { useUpload } from '../services/UploadContext';

export const UploadIndicator: React.FC = () => {
  const { uploads } = useUpload();
  if (uploads.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 space-y-2">
      {uploads.map(u => {
        const isCompressing = u.phase === 'compressing';
        return (
          <div key={u.id} className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-64 animate-fade-in">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-4 h-4 border-2 border-slate-300 rounded-full animate-spin shrink-0 ${isCompressing ? 'border-t-purple-500' : 'border-t-brand-500'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-700 truncate block">{u.label}</span>
                {isCompressing && (
                  <span className="text-[10px] text-purple-500 font-medium">영상 최적화 중...</span>
                )}
              </div>
              <span className={`text-xs font-bold ml-auto ${isCompressing ? 'text-purple-600' : 'text-brand-600'}`}>{u.progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isCompressing ? 'bg-purple-500' : 'bg-brand-500'}`}
                style={{ width: `${u.progress}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
