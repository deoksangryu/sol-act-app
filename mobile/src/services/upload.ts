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
  const ext = kind === 'video' ? 'mp4' : 'jpg';
  return { uri: a.uri, filename: a.fileName || `upload_${Date.now()}.${ext}`, mimeType: a.mimeType ?? undefined, durationMs: a.duration ?? undefined };
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
  const ext = kind === 'video' ? 'mp4' : 'jpg';
  return res.assets.map((a, i) => ({ uri: a.uri, filename: a.fileName || `upload_${Date.now()}_${i}.${ext}`, mimeType: a.mimeType ?? undefined, durationMs: a.duration ?? undefined }));
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
