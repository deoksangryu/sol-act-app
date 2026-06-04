/**
 * Native video upload via Capacitor plugin.
 * Falls back to web upload if not running in native app.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import toast from 'react-hot-toast';

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
  // iOS: 진짜 백그라운드(URLSessionConfiguration.background)로 큐에 등록만 하고 즉시 반환
  backgroundUpload(options: {
    fileUri: string;
    apiUrl: string;
    token: string;
    subfolder?: string;
    targetType?: string;
    targetId?: string;
    displayName?: string;
  }): Promise<{ enqueued: boolean }>;
  isAvailable(): Promise<{ available: boolean }>;
  addListener(event: string, callback: (data: any) => void): Promise<{ remove: () => void }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
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
 * 진짜 백그라운드 업로드 (fire-and-forget).
 * 호출 전에 대상 레코드(포트폴리오/과제)를 먼저 만들고 그 id를 targetId로 넘기면,
 * 업로드 완료 시 서버가 그 레코드에 파일 URL을 자동 패치한다(앱이 닫혀도 OK).
 *  - iOS: OS 관리 background URLSession (앱 종료돼도 이어서 완료)
 *  - Android: 포그라운드 서비스 (앱 백그라운드/종료돼도 이어서 완료)
 * 네이티브가 아니면 false 를 반환 → 호출측이 웹(포그라운드) 업로드로 폴백.
 */
export async function nativeBackgroundUpload(
  file: File,
  apiUrl: string,
  token: string,
  opts: { subfolder?: string; targetType?: string; targetId?: string; displayName?: string },
): Promise<boolean> {
  if (!isNativeUploadAvailable()) return false;
  try {
    const { available } = await NativeUpload.isAvailable();
    if (!available) return false;
  } catch {
    return false;
  }
  try { await NativeUpload.requestNotificationPermission(); } catch { /* ignore */ }

  let fileUri: string;
  try {
    fileUri = await saveFileForNative(file);
  } catch (e) {
    console.warn('Failed to save file for native background upload:', e);
    return false;
  }

  const base = {
    fileUri, apiUrl, token,
    subfolder: opts.subfolder || 'portfolios',
    targetType: opts.targetType,
    targetId: opts.targetId,
  };

  try {
    if (Capacitor.getPlatform() === 'ios') {
      await NativeUpload.backgroundUpload({ ...base, displayName: opts.displayName });
    } else {
      // Android: 포그라운드 서비스가 백그라운드로 끝까지 처리 — 완료를 기다리지 않음(fire-and-forget)
      // 단, 앱 실행 중 업로드가 실패하면(promise reject) 즉시 토스트로 알림(앱이 닫혀 있으면 OS 알림이 대신 표시)
      NativeUpload.compressAndUpload(base).catch(() => {
        toast.error('영상 업로드에 실패했어요. 다시 시도해 주세요.');
      });
    }
    return true;
  } catch (e) {
    console.warn('Native background upload failed to enqueue:', e);
    return false;
  }
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

  // Request notification permission (first time only)
  try { await NativeUpload.requestNotificationPermission(); } catch { /* ignore */ }

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
