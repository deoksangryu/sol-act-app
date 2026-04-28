/**
 * Native video upload via Capacitor plugin.
 * Falls back to web upload if not running in native app.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeUploadPlugin {
  compressAndUpload(options: {
    fileUri: string;
    apiUrl: string;
    token: string;
    subfolder?: string;
    targetType?: string;
    targetId?: string;
  }): Promise<{
    url: string;
    filename: string;
    thumbnailUrl?: string;
    originalSize: number;
    compressedSize: number;
  }>;
  isAvailable(): Promise<{ available: boolean }>;
  addListener(event: string, callback: (data: any) => void): Promise<{ remove: () => void }>;
}

const NativeUpload = registerPlugin<NativeUploadPlugin>('NativeUpload');

/**
 * Check if native upload is available (running in Capacitor native app).
 */
export function isNativeUploadAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Upload a video file using native compression + background upload.
 * Only works in Capacitor native app. Returns null if not available.
 */
export async function nativeCompressAndUpload(
  fileUri: string,
  apiUrl: string,
  token: string,
  options?: {
    subfolder?: string;
    targetType?: string;
    targetId?: string;
    onProgress?: (phase: 'compressing' | 'uploading', pct: number) => void;
  },
): Promise<{ url: string; filename: string; thumbnailUrl?: string } | null> {
  if (!isNativeUploadAvailable()) return null;

  try {
    const { available } = await NativeUpload.isAvailable();
    if (!available) return null;
  } catch {
    return null;
  }

  // Listen for progress events
  let progressListener: any = null;
  if (options?.onProgress) {
    progressListener = await NativeUpload.addListener?.('uploadProgress', (data: any) => {
      options.onProgress!(data.phase, data.progress);
    });
  }

  try {
    const result = await NativeUpload.compressAndUpload({
      fileUri,
      apiUrl,
      token,
      subfolder: options?.subfolder || 'portfolios',
      targetType: options?.targetType,
      targetId: options?.targetId,
    });

    return {
      url: result.url,
      filename: result.filename,
      thumbnailUrl: result.thumbnailUrl,
    };
  } finally {
    progressListener?.remove?.();
  }
}
