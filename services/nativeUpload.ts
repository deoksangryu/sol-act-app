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
 * Save a File to the app's temporary directory and return the file:// path.
 * This gives native code a real file path instead of a blob URL.
 */
async function saveFileForNative(file: File): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');

  // Read file as base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Write to temp file
  const fileName = `upload_${Date.now()}_${file.name}`;
  const result = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache,
  });

  return result.uri;
}

/**
 * Upload a video file using native compression + background upload.
 * Only works in Capacitor native app. Returns null if not available.
 */
export async function nativeCompressAndUpload(
  file: File,
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

  // Save file to native-accessible path
  let fileUri: string;
  try {
    fileUri = await saveFileForNative(file);
  } catch (e) {
    console.warn('Failed to save file for native upload:', e);
    return null;
  }

  // Listen for progress events
  let progressListener: any = null;
  if (options?.onProgress) {
    progressListener = await NativeUpload.addListener('uploadProgress', (data: any) => {
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
    // Clean up temp file
    try {
      const { Filesystem } = await import('@capacitor/filesystem');
      await Filesystem.deleteFile({ path: fileUri });
    } catch { /* ignore */ }
  }
}
