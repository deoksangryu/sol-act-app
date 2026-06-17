/**
 * 네이티브 푸시(FCM=Android / APNs=iOS) 등록.
 *
 * 웹푸시(registerPushSubscription)와 별개. Capacitor WKWebView/WebView에는 Web Push API가
 * 없으므로, 네이티브 앱에서는 이 경로로 OS 푸시 토큰을 받아 백엔드에 저장한다.
 *
 * 실제 발송이 켜지려면 백엔드에 FCM/APNs 자격증명이 설정돼야 한다(docs/PUSH_NOTIFICATIONS.md).
 * 자격증명 전이라도 토큰 등록 자체는 동작하며, 미지원 환경에서는 조용히 무동작한다.
 */
import { Capacitor } from '@capacitor/core';
import { pushApi } from './api';

let registered = false;
let lastToken: string | null = null;

export async function registerNativePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return; // 네이티브 앱에서만
  if (registered) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;

    await PushNotifications.addListener('registration', async (token) => {
      lastToken = token.value;
      try {
        await pushApi.saveDeviceToken(token.value, Capacitor.getPlatform());
      } catch (e) {
        console.warn('device token 저장 실패:', e);
      }
    });
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('네이티브 푸시 등록 오류:', err);
    });

    await PushNotifications.register();
    registered = true;
  } catch (e) {
    console.warn('registerNativePush 실패:', e);
  }
}

/**
 * 네이티브 푸시 권한 상태 조회(팝업 없이 현재 상태만).
 * 웹(비네이티브)에서는 'unsupported' 반환 → 호출측이 Web Push 경로로 분기.
 */
export async function getNativePushStatus(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    // receive: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
    if (perm.receive === 'granted') return 'granted';
    if (perm.receive === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unsupported';
  }
}

export async function unregisterNativePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (lastToken) await pushApi.removeDeviceToken(lastToken);
  } catch { /* ignore */ }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
  } catch { /* ignore */ }
  registered = false;
  lastToken = null;
}
