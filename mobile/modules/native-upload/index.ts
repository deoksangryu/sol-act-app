// SOL-ACT 진짜 백그라운드 업로드 — Expo 로컬 네이티브 모듈의 JS API.
// iOS: URLSession 백그라운드 세션(앱 닫혀도 OS가 완료). Android: 포그라운드 서비스(dataSync).
// 압축은 신뢰성 우선(오디오 보존 검증 + 실패 시 원본). 백엔드의 record-first-patch(target_type/target_id)로
// 앱이 닫혀도 서버가 파일 URL을 레코드에 패치한다.
//
// Expo Go에는 이 네이티브 모듈이 없으므로 requireNativeModule이 throw → isAvailable()=false로 폴백.
import { requireNativeModule, type EventSubscription } from 'expo-modules-core';

export interface BackgroundUploadOptions {
  /** file:// URI (image picker 결과) */
  fileUri: string;
  /** API 베이스 URL (예: https://sol-act-server.ngrok.app) */
  apiUrl: string;
  /** Bearer 토큰 */
  token: string;
  /** 저장 서브폴더 (portfolios | assignments | ...) */
  subfolder?: string;
  /** 레코드-먼저-패치 대상 종류 (portfolio | portfolio_video | assignment) */
  targetType?: string;
  /** 대상 레코드 id */
  targetId?: string;
  /** 알림/진행 표시용 라벨 */
  displayName?: string;
  /** 영상 압축 여부(기본 true). 압축이 오디오를 잃거나 실패하면 원본 업로드. */
  compress?: boolean;
}

export interface UploadProgressEvent {
  id: string;
  phase: 'compressing' | 'uploading';
  progress: number; // 0..100
}
export interface UploadCompleteEvent {
  id: string;
  ok: boolean;
  url?: string;
  error?: string;
}

interface NativeUploadModuleType {
  isAvailable(): boolean;
  requestPermissions(): Promise<{ notifications: boolean }>;
  enqueueUpload(options: BackgroundUploadOptions): Promise<{ enqueued: boolean; id: string }>;
  addListener(event: string, listener: (payload: any) => void): EventSubscription;
}

let Native: NativeUploadModuleType | null = null;
try {
  Native = requireNativeModule<NativeUploadModuleType>('NativeUpload');
} catch {
  Native = null; // Expo Go / 미빌드 → 폴백
}

/** 네이티브 백그라운드 업로더가 이 빌드에 존재하는지(개발/프로덕션 빌드에서만 true) */
export function isAvailable(): boolean {
  return !!Native;
}

export async function requestPermissions(): Promise<{ notifications: boolean }> {
  if (!Native) return { notifications: false };
  return Native.requestPermissions();
}

/** 진짜 백그라운드 업로드 큐 등록. 즉시 resolve(enqueued). 완료는 이벤트 + 서버 레코드패치. */
export async function enqueueUpload(options: BackgroundUploadOptions): Promise<{ enqueued: boolean; id: string }> {
  if (!Native) throw new Error('NativeUpload 모듈이 없습니다(개발 빌드 필요).');
  return Native.enqueueUpload(options);
}

const noopSub: EventSubscription = { remove() {} };
export function addProgressListener(cb: (e: UploadProgressEvent) => void): EventSubscription {
  return Native ? Native.addListener('uploadProgress', cb) : noopSub;
}
export function addCompleteListener(cb: (e: UploadCompleteEvent) => void): EventSubscription {
  return Native ? Native.addListener('uploadComplete', cb) : noopSub;
}
