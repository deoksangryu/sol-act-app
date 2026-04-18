import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type UploadPhase = 'compressing' | 'uploading';

interface UploadEntry {
  id: string;
  label: string;
  progress: number; // 0-100
  phase: UploadPhase;
  fileSize?: number; // bytes
  startedAt?: number; // timestamp
}

interface UploadContextType {
  uploads: UploadEntry[];
  isUploading: boolean;
  startUpload: (id: string, label: string, fileSize?: number) => void;
  updateProgress: (id: string, progress: number) => void;
  updatePhase: (id: string, phase: UploadPhase, progress: number) => void;
  finishUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType>({
  uploads: [],
  isUploading: false,
  startUpload: () => {},
  updateProgress: () => {},
  updatePhase: () => {},
  finishUpload: () => {},
});

export const useUpload = () => useContext(UploadContext);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);

  const startUpload = useCallback((id: string, label: string, fileSize?: number) => {
    setUploads(prev => [...prev.filter(u => u.id !== id), { id, label, progress: 0, phase: 'uploading', fileSize, startedAt: Date.now() }]);
  }, []);

  const updateProgress = useCallback((id: string, progress: number) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, progress } : u));
  }, []);

  const updatePhase = useCallback((id: string, phase: UploadPhase, progress: number) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, phase, progress } : u));
  }, []);

  const finishUpload = useCallback((id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  // Global navigation guard: warn user before leaving during upload
  useEffect(() => {
    if (uploads.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploads.length]);

  return (
    <UploadContext.Provider value={{ uploads, isUploading: uploads.length > 0, startUpload, updateProgress, updatePhase, finishUpload }}>
      {children}
    </UploadContext.Provider>
  );
};
