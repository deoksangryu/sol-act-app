import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { API_URL, toCamel } from './api';
import { getToken } from './storage';

export interface UploadResult { url: string; filename: string; isVideo: boolean; thumbnailUrl?: string }
export interface UploadOpts {
  subfolder?: string;
  targetType?: string; // portfolio | portfolio_video | assignment | ...
  targetId?: string;
  onProgress?: (pct: number) => void;
}
export interface PickedMedia { uri: string; filename: string; mimeType?: string; durationMs?: number }

// 실제로 영상 파일인지 검증(picker가 videos로 제한하지만 안전망: 타입·MIME·확장자 중 하나라도 영상).
const VIDEO_EXT = /\.(mp4|mov|m4v|3gp|avi|mkv|webm|hevc|qt|ts)$/i;
function isVideoAsset(a: ImagePicker.ImagePickerAsset): boolean {
  return a.type === 'video' || (a.mimeType?.startsWith('video') ?? false) || VIDEO_EXT.test(a.fileName || a.uri || '');
}

/** 라이브러리에서 사진/영상 1개 선택 (권한 요청 포함). 취소 시 null. */
export async function pickMedia(kind: 'image' | 'video', options: Partial<ImagePicker.ImagePickerOptions> = {}): Promise<PickedMedia | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('사진/영상 접근 권한이 필요해요');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'video' ? ['videos'] : ['images'],
    quality: kind === 'image' ? 0.8 : 1,
    ...options,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  if (kind === 'video' && !isVideoAsset(a)) throw new Error('영상 파일만 올릴 수 있어요 (사진·문서는 안 돼요)');
  const ext = kind === 'video' ? 'mp4' : 'jpg';
  return { uri: a.uri, filename: a.fileName || `upload_${Date.now()}.${ext}`, mimeType: a.mimeType ?? undefined, durationMs: a.duration ?? undefined };
}

/** 카메라로 직접 촬영(영상). 권한 요청 포함. 취소 시 null. */
export async function captureVideo(options: Partial<ImagePicker.ImagePickerOptions> = {}): Promise<PickedMedia | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('카메라 접근 권한이 필요해요 (설정에서 허용)');
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    quality: 1,
    videoMaxDuration: 300,
    ...options,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  if (!isVideoAsset(a)) throw new Error('영상만 촬영할 수 있어요');
  return { uri: a.uri, filename: a.fileName || `capture_${Date.now()}.mp4`, mimeType: a.mimeType ?? undefined, durationMs: a.duration ?? undefined };
}

/** 카메라로 사진 촬영. 권한 요청 포함. 취소 시 null. */
export async function captureImage(options: Partial<ImagePicker.ImagePickerOptions> = {}): Promise<PickedMedia | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('카메라 접근 권한이 필요해요 (설정에서 허용)');
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, ...options });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, filename: a.fileName || `capture_${Date.now()}.jpg`, mimeType: a.mimeType ?? undefined };
}

/** 여러 개 선택(영상 다중 업로드용). 취소 시 빈 배열. */
export async function pickMediaMulti(kind: 'image' | 'video', options: Partial<ImagePicker.ImagePickerOptions> = {}): Promise<PickedMedia[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('사진/영상 접근 권한이 필요해요');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'video' ? ['videos'] : ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: kind === 'image' ? 0.8 : 1,
    ...options,
  });
  if (res.canceled || !res.assets?.length) return [];
  const assets = kind === 'video' ? res.assets.filter(isVideoAsset) : res.assets;
  if (kind === 'video' && assets.length === 0) throw new Error('영상 파일만 올릴 수 있어요 (사진·문서는 안 돼요)');
  const ext = kind === 'video' ? 'mp4' : 'jpg';
  return assets.map((a, i) => ({ uri: a.uri, filename: a.fileName || `upload_${Date.now()}_${i}.${ext}`, mimeType: a.mimeType ?? undefined, durationMs: a.duration ?? undefined }));
}

/**
 * 파일을 서버로 스트리밍 multipart 업로드 → /api/upload.
 * 서버가 압축·썸네일을 백그라운드 처리하고, target_type/target_id가 있으면 레코드에 URL 패치.
 */
export async function uploadFileUri(media: PickedMedia, opts: UploadOpts = {}): Promise<UploadResult> {
  const token = getToken();
  const params: Record<string, string> = { subfolder: opts.subfolder || 'assignments' };
  if (opts.targetType) params.target_type = opts.targetType;
  if (opts.targetId) params.target_id = opts.targetId;
  const url = `${API_URL}/api/upload?${new URLSearchParams(params).toString()}`;

  const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const task = FileSystem.createUploadTask(
    url,
    media.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: media.mimeType,
      headers,
    },
    (p) => {
      if (opts.onProgress && p.totalBytesExpectedToSend > 0) {
        opts.onProgress(Math.round((p.totalBytesSent / p.totalBytesExpectedToSend) * 100));
      }
    },
  );

  const res = await task.uploadAsync();
  if (!res) throw new Error('업로드가 취소되었어요');
  if (res.status < 200 || res.status >= 300) {
    let detail = '업로드에 실패했어요';
    try { detail = JSON.parse(res.body).detail || detail; } catch { /* keep default */ }
    throw new Error(detail);
  }
  const data: any = toCamel(JSON.parse(res.body || '{}'));
  return { url: data.url, filename: data.filename, isVideo: !!data.isVideo, thumbnailUrl: data.thumbnailUrl };
}
