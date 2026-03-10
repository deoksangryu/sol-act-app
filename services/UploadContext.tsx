import React, { createContext, useContext, useState, useCallback } from 'react';

interface UploadEntry {
  id: string;
  label: string;
  progress: number; // 0-100
}

interface UploadContextType {
  uploads: UploadEntry[];
  isUploading: boolean;
  startUpload: (id: string, label: string) => void;
  updateProgress: (id: string, progress: number) => void;
  finishUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType>({
  uploads: [],
  isUploading: false,
  startUpload: () => {},
  updateProgress: () => {},
  finishUpload: () => {},
});

export const useUpload = () => useContext(UploadContext);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);

  const startUpload = useCallback((id: string, label: string) => {
    setUploads(prev => [...prev.filter(u => u.id !== id), { id, label, progress: 0 }]);
  }, []);

  const updateProgress = useCallback((id: string, progress: number) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, progress } : u));
  }, []);

  const finishUpload = useCallback((id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  return (
    <UploadContext.Provider value={{ uploads, isUploading: uploads.length > 0, startUpload, updateProgress, finishUpload }}>
      {children}
    </UploadContext.Provider>
  );
};
