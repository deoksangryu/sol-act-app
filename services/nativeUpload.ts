/**
 * Native video upload via Capacitor plugin.
 * Falls back to web upload if not running in native app.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import toast from 'react-hot-toast';
import { getVideoDimensions } from './videoMeta';

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
 * 720p 초과(maxDim > 1280) 영상은 현재 네이티브 앱의 압축 과정에서 소리가 빠질 수 있음.
 * 업로드 전 사용자에게 알리고 진행 여부를 확인한다. true=계속, false=취소.
 * (비네이티브 환경/저해상도/비영상 파일은 경고 없이 통과. APK 오디오 패스스루 적용 후엔 제거 가능.)
 */
export async function confirmVideoAudioRisk(files: File | File[]): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  const list = Array.isArray(files) ? files : [files];
  let risky = false;
  for (const f of list) {
    if (!f.type.startsWith('video/')) continue;
    const dim = await getVideoDimensions(f);
    if (dim && Math.max(dim.width, dim.height) > 1280) { risky = true; break; }
  }
  if (!risky) return true;
  return window.confirm(
    '선택한 영상이 고화질(720p 초과)이에요.\n\n' +
    '지금 앱에서는 고화질 영상을 올릴 때 소리가 빠질 수 있어요. ' +
    '폰 카메라 설정에서 동영상 화질을 HD(720p)로 낮춰 다시 촬영하면 소리가 유지돼요.\n\n' +
    '그래도 이대로 올릴까요?'
  );
}

/** Blob 한 조각을 base64 문자열로 (data: 프리픽스 제거). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Save a File to the app's temporary directory and return the file:// path.
 * 큰 영상도 안전하게: 파일 전체를 한 번에 base64로 올리면(예: 300MB→400MB 문자열) 웹뷰가
 * 메모리 부족으로 실패한다(긴 영상이 업로드 시작도 못 하던 원인). 그래서 3MB(=3바이트 배수,
 * base64 경계 안전)씩 잘라 append 로 이어 써서 메모리 사용을 일정하게 유지한다.
 */
async function saveFileForNative(file: File): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const fileName = `upload_${Date.now()}_${file.name}`;
  const CHUNK = 3 * 1024 * 1024; // 3MB — 3의 배수라 조각별 base64에 중간 패딩이 없어 이어붙여도 정확

  let offset = 0;
  let first = true;
  while (offset < file.size) {
    const slice = file.slice(offset, Math.min(offset + CHUNK, file.size));
    const b64 = await blobToBase64(slice);
    if (first) {
      await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Cache });
      first = false;
    } else {
      await Filesystem.appendFile({ path: fileName, data: b64, directory: Directory.Cache });
    }
    offset += CHUNK;
  }
  if (first) {
    // 빈 파일 방어
    await Filesystem.writeFile({ path: fileName, data: '', directory: Directory.Cache });
  }

  // 무결성 검증: 복사본 크기가 원본과 다르면(일부 Android에서 base64 append가 빈/깨진 파일을 만드는 사례)
  // 이 복사본을 버리고 throw → 호출측이 웹(포그라운드) 업로드로 폴백한다(원본 File을 직접 전송).
  try {
    const st = await Filesystem.stat({ path: fileName, directory: Directory.Cache });
    const written = Number((st as any).size) || 0;
    if (file.size > 0 && written !== file.size) {
      try { await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache }); } catch { /* ignore */ }
      throw new Error(`native copy size mismatch: ${written} != ${file.size}`);
    }
  } catch (e) {
    // stat 실패도 신뢰 불가로 간주 → 폴백
    throw e instanceof Error ? e : new Error('native copy verify failed');
  }

  const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
  return uri;
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
