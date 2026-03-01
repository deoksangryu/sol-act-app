import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Show again after 24 hours
    const dismissedAt = localStorage.getItem('pwa_dismissed_at');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 24 * 60 * 60 * 1000) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);

    if (isIos && isSafari) {
      setShowIosBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosBanner(false);
    localStorage.setItem('pwa_dismissed_at', String(Date.now()));
  };

  if (dismissed) return null;
  if (!deferredPrompt && !showIosBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-8 md:left-auto md:right-8 md:w-80 bg-white rounded-2xl shadow-lg border border-slate-200 p-4 z-50 animate-slide-up">
      <button onClick={handleDismiss} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0">S</div>
        <div>
          <p className="font-bold text-slate-800 text-sm">SOL-ACT 앱 설치</p>
          <p className="text-xs text-slate-500">홈 화면에 추가하여 빠르게 접속하세요</p>
        </div>
      </div>

      {showIosBanner ? (
        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
          <p className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            하단의 <strong>공유 버튼</strong>을 누른 후
          </p>
          <p className="mt-1.5 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <strong>"홈 화면에 추가"</strong>를 선택하세요
          </p>
        </div>
      ) : (
        <button
          onClick={handleInstall}
          className="w-full bg-yellow-400 text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-yellow-500 active:scale-[0.98] transition-all"
        >
          앱 설치하기
        </button>
      )}
    </div>
  );
};
