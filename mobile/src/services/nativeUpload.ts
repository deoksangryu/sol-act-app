// 영상/파일 업로드 브리지.
// 네이티브 백그라운드 모듈이 있으면 진짜 백그라운드 업로드(앱 닫혀도 완료 + 오디오보존 압축),
// 없으면(Expo Go / 미빌드) 기존 포그라운드 업로드(expo-file-system)로 자동 폴백.
import * as NativeUpload from '../../modules/native-upload';
import { uploadFileUri, type PickedMedia, type UploadOpts, type UploadResult } from './upload';
import { API_URL } from './api';
import { getToken } from './storage';

export type { PickedMedia, UploadOpts, UploadResult } from './upload';
export { addProgressListener, addCompleteListener } from '../../modules/native-upload';

/** 이 빌드가 진짜 백그라운드 업로드(네이티브 모듈)를 지원하는지 */
export function backgroundUploadAvailable(): boolean {
  return NativeUpload.isAvailable();
}

export interface MediaUploadResult {
  /** true면 백그라운드 큐에 등록됨(완료는 이벤트+서버패치로 별도 도착), false면 즉시 완료(result 有) */
  background: boolean;
  id?: string;
  result?: UploadResult;
}

/**
 * 미디어 업로드. 백그라운드 모듈이 있으면 enqueue(즉시 반환), 없으면 포그라운드 업로드.
 * 레코드-먼저-패치 패턴: 먼저 대상 레코드를 만들고 targetType/targetId를 넘기면,
 * 앱이 닫혀도 서버가 업로드 도착 시 파일 URL을 레코드에 패치한다.
 */
export async function uploadMedia(
  media: PickedMedia,
  opts: UploadOpts & { displayName?: string; compress?: boolean } = {},
): Promise<MediaUploadResult> {
  if (NativeUpload.isAvailable()) {
    const token = getToken() || '';
    const { id } = await NativeUpload.enqueueUpload({
      fileUri: media.uri,
      apiUrl: API_URL,
      token,
      subfolder: opts.subfolder || 'portfolios',
      targetType: opts.targetType,
      targetId: opts.targetId,
      displayName: opts.displayName || media.filename,
      compress: opts.compress ?? true,
    });
    return { background: true, id };
  }
  // 폴백: 포그라운드 업로드(앱 열려있는 동안). 진행률은 opts.onProgress로.
  const result = await uploadFileUri(media, opts);
  return { background: false, result };
}
