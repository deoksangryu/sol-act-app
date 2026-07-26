import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { uploadFileUri } from './upload';
import type { UploadResult, UploadOpts, PickedMedia } from './upload';
import { uploadMedia, backgroundUploadAvailable, addProgressListener, addCompleteListener } from './nativeUpload';

interface UploadEntry { id: number; label: string; progress: number }

interface UploadCtx {
  uploads: UploadEntry[];
  /** 전역 진행 HUD에 표시. 영상은 네이티브 백그라운드(앱 닫혀도 완료)로, 이미지는 포그라운드로. */
  upload: (label: string, media: PickedMedia, opts?: UploadOpts) => Promise<UploadResult>;
}

const Ctx = createContext<UploadCtx | null>(null);

export function useUploads(): UploadCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUploads must be used within UploadProvider');
  return c;
}

const isVideoMedia = (m: PickedMedia): boolean =>
  (m.mimeType?.startsWith('video') ?? false) || /\.(mp4|mov|m4v|3gp|avi|mkv|webm)$/i.test(m.filename);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const idRef = useRef(0);

  const upload = useCallback(async (label: string, media: PickedMedia, opts: UploadOpts = {}): Promise<UploadResult> => {
    const id = ++idRef.current;
    setUploads((u) => [...u, { id, label, progress: 0 }]);

    // 영상 + 네이티브 백그라운드 모듈이 있으면: enqueue 후 즉시 반환. 완료는 서버 record-patch + 이벤트.
    // (레코드는 호출자가 미리 생성했으므로 앱이 닫혀도 서버가 파일 URL을 패치한다.)
    if (isVideoMedia(media) && backgroundUploadAvailable()) {
      const r = await uploadMedia(media, { ...opts, displayName: label });
      if (r.background && r.id) {
        const taskId = r.id;
        const progSub = addProgressListener((e) => {
          if (e.id === taskId) setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: e.progress } : x)));
        });
        const doneSub = addCompleteListener((e) => {
          if (e.id === taskId) {
            setUploads((u) => u.filter((x) => x.id !== id));
            progSub.remove();
            doneSub.remove();
            // 실패면 조용히 사라지지 않게 사용자에게 알림(앱이 포그라운드일 때). 앱이 닫힌 사이
            // 실패는 백엔드 stuck-upload 통지가 벨로 커버한다.
            if (e.ok === false) {
              Alert.alert('업로드 실패', `'${label}' 업로드를 완료하지 못했어요. 네트워크 확인 후 다시 시도해주세요.${e.error ? `\n(${e.error})` : ''}`);
            }
          }
        });
        return { url: '', filename: media.filename, isVideo: true };
      }
      if (r.result) {
        setUploads((u) => u.filter((e) => e.id !== id));
        return r.result;
      }
    }

    // 포그라운드 업로드(이미지 / 네이티브 미탑재 폴백)
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
