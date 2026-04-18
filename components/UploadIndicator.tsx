import React from 'react';
import { useUpload } from '../services/UploadContext';

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}초`;
  return `${Math.floor(seconds / 60)}분 ${Math.ceil(seconds % 60)}초`;
}

export const UploadIndicator: React.FC = () => {
  const { uploads } = useUpload();
  if (uploads.length === 0) return null;

  return (
    <>
      {/* Semi-transparent overlay to discourage leaving */}
      <div className="fixed inset-0 bg-black/20 z-40 pointer-events-none" />

      {/* Upload status panel */}
      <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 space-y-2">
        {/* Keep screen warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          <span className="text-xs text-amber-700 font-medium">화면을 유지해주세요! 앱을 나가면 업로드가 중단됩니다.</span>
        </div>

        {uploads.map(u => {
          const isCompressing = u.phase === 'compressing';

          // Calculate speed and ETA
          let speedText = '';
          let etaText = '';
          let sizeText = '';
          if (u.fileSize) {
            sizeText = formatSize(u.fileSize);
            if (u.startedAt && u.progress > 0 && !isCompressing) {
              const elapsed = (Date.now() - u.startedAt) / 1000;
              const bytesUploaded = u.fileSize * u.progress / 100;
              const speed = bytesUploaded / elapsed;
              speedText = `${formatSize(speed)}/s`;
              const remaining = (u.fileSize - bytesUploaded) / speed;
              if (remaining > 0 && remaining < 3600) {
                etaText = formatEta(remaining);
              }
            }
          }

          return (
            <div key={u.id} className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 animate-fade-in">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-4 h-4 border-2 border-slate-300 rounded-full animate-spin shrink-0 ${isCompressing ? 'border-t-purple-500' : 'border-t-brand-500'}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-700 truncate block">{u.label}</span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {isCompressing ? '서버 압축 중...' : (
                      <>
                        업로드 중{sizeText ? ` · ${sizeText}` : ''}
                        {speedText ? ` · ${speedText}` : ''}
                        {etaText ? ` · 약 ${etaText} 남음` : ''}
                      </>
                    )}
                  </span>
                </div>
                <span className={`text-xs font-bold ml-auto ${isCompressing ? 'text-purple-600' : 'text-brand-600'}`}>{u.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isCompressing ? 'bg-purple-500' : 'bg-brand-500'}`}
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
