import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { uploadFileUri } from './upload';
import type { UploadResult, UploadOpts, PickedMedia } from './upload';

interface UploadEntry { id: number; label: string; progress: number }

interface UploadCtx {
  uploads: UploadEntry[];
  /** 전역 진행 HUD에 표시되며 업로드 완료 시 결과를 반환 */
  upload: (label: string, media: PickedMedia, opts?: UploadOpts) => Promise<UploadResult>;
}

const Ctx = createContext<UploadCtx | null>(null);

export function useUploads(): UploadCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUploads must be used within UploadProvider');
  return c;
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const idRef = useRef(0);

  const upload = useCallback(async (label: string, media: PickedMedia, opts: UploadOpts = {}) => {
    const id = ++idRef.current;
    setUploads((u) => [...u, { id, label, progress: 0 }]);
    try {
      return await uploadFileUri(media, {
        ...opts,
        onProgress: (p) => setUploads((u) => u.map((e) => (e.id === id ? { ...e, progress: p } : e))),
      });
    } finally {
      setUploads((u) => u.filter((e) => e.id !== id));
    }
  }, []);

  return <Ctx.Provider value={{ uploads, upload }}>{children}</Ctx.Provider>;
}
