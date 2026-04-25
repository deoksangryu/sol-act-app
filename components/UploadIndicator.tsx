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

const PHASE_CONFIG = {
  client_compressing: {
    label: '영상 최적화 중...',
    detail: '용량을 줄여 더 빠르게 업로드합니다',
    color: 'text-violet-600',
    barColor: 'bg-violet-500',
    spinColor: 'border-t-violet-500',
    showProgress: true,
  },
  uploading: {
    label: '업로드 중',
    detail: '',
    color: 'text-brand-600',
    barColor: 'bg-brand-500',
    spinColor: 'border-t-brand-500',
    showProgress: true,
  },
  compressing: {
    label: '서버에서 처리 중...',
    detail: '업로드 완료! 영상을 최적화하고 있습니다',
    color: 'text-purple-600',
    barColor: 'bg-purple-500',
    spinColor: 'border-t-purple-500',
    showProgress: true,
  },
};

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
          <span className="text-xs text-amber-700 font-medium">화면을 유지해주세요! 앱을 나가면 중단됩니다.</span>
        </div>

        {uploads.map(u => {
          const cfg = PHASE_CONFIG[u.phase] || PHASE_CONFIG.uploading;

          // Calculate speed and ETA for upload phase
          let speedText = '';
          let etaText = '';
          let sizeText = '';
          if (u.fileSize && u.phase === 'uploading') {
            sizeText = formatSize(u.fileSize);
            if (u.startedAt && u.progress > 0) {
              const elapsed = (Date.now() - u.startedAt) / 1000;
              const bytesUploaded = u.fileSize * u.progress / 100;
              const speed = bytesUploaded / elapsed;
              if (speed > 0) {
                speedText = `${formatSize(speed)}/s`;
                const remaining = (u.fileSize - bytesUploaded) / speed;
                if (remaining > 0 && remaining < 3600) {
                  etaText = formatEta(remaining);
                }
              }
            }
          }

          const detailLine = u.phase === 'uploading'
            ? [sizeText, speedText, etaText ? `약 ${etaText} 남음` : ''].filter(Boolean).join(' · ')
            : cfg.detail;

          return (
            <div key={u.id} className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 animate-fade-in">
              <div className="flex items-center gap-2 mb-1.5">
                {/* Spinner with phase-specific pulse for compression */}
                <div className={`w-5 h-5 border-2 border-slate-200 rounded-full animate-spin shrink-0 ${cfg.spinColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 truncate">{u.label}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                    {u.phase === 'client_compressing' && (
                      <span className="text-[10px] text-slate-300 animate-pulse">●</span>
                    )}
                  </div>
                  {detailLine && (
                    <span className="text-[10px] text-slate-400 block mt-0.5">{detailLine}</span>
                  )}
                </div>
                <span className={`text-sm font-bold ml-auto ${cfg.color}`}>{u.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${cfg.barColor} ${u.phase === 'client_compressing' ? 'animate-pulse' : ''}`}
                  style={{ width: `${Math.max(u.progress, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
