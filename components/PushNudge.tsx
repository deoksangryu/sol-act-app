import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { registerPushSubscription } from '../services/api';
import { registerNativePush, getNativePushStatus } from '../services/nativePush';
import { TOSS } from '../services/category';

type Status = 'loading' | 'granted' | 'denied' | 'prompt' | 'unsupported';

/**
 * 알림 켜기 넛지 배너. 권한이 granted/unsupported면 아무것도 렌더하지 않는다.
 * - prompt(미결정): "알림 켜기" 버튼 → 권한 요청 팝업.
 * - denied(차단): 기기 설정 안내 + "다시 확인".
 * 네이티브(iOS/Android)·웹 모두 지원. 재배포 불필요(권한 요청 API는 기존 앱에 존재).
 */
export const PushNudge: React.FC<{ reason?: string }> = ({ reason }) => {
  const [status, setStatus] = useState<Status>('loading');
  const platform: 'ios' | 'android' | 'web' =
    Capacitor.isNativePlatform() ? (Capacitor.getPlatform() === 'ios' ? 'ios' : 'android') : 'web';

  const refresh = useCallback(async () => {
    if (Capacitor.isNativePlatform()) { setStatus(await getNativePushStatus()); return; }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return;
    }
    // Web Notification API는 'default'를 반환(=미결정) → 우리 상태 모델의 'prompt'로 매핑
    setStatus(Notification.permission === 'default' ? 'prompt' : Notification.permission);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await registerNativePush();
        const s = await getNativePushStatus();
        setStatus(s);
        if (s === 'granted') toast.success('알림이 켜졌어요');
        else if (s === 'denied') toast.error('알림이 차단되어 있어요. 아래 안내대로 켜주세요.');
        return;
      }
      await registerPushSubscription(true);
      const s: Status = Notification.permission === 'default' ? 'prompt' : Notification.permission;
      setStatus(s);
      if (s === 'granted') toast.success('알림이 켜졌어요');
      else if (s === 'denied') toast.error('알림이 차단되어 있어요. 아래 안내대로 켜주세요.');
    } catch {
      toast.error('알림 설정에 실패했어요');
    }
  };

  if (status === 'loading' || status === 'granted' || status === 'unsupported') return null;

  const deniedGuide =
    platform === 'ios' ? '아이폰 [설정] → [알림] → SOL-ACT → "알림 허용"을 켜주세요.'
    : platform === 'android' ? '[설정] → [앱] → SOL-ACT → [알림] → "허용"으로 바꿔주세요.'
    : '브라우저 주소창의 자물쇠(사이트 설정) → [알림] → "허용"으로 바꿔주세요.';

  const msg = reason || '알림을 켜면 선생님 피드백과 계획 리마인더를 받을 수 있어요.';

  return (
    <div style={{ margin: '6px 20px 4px', background: TOSS.blueBg, borderRadius: 12, padding: '12px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <i className="ti ti-bell" style={{ fontSize: 20, color: TOSS.blue, marginTop: 1, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: TOSS.ink, lineHeight: 1.5 }}>{msg}</div>
          {status === 'denied' && (
            <div style={{ fontSize: 12, color: TOSS.sub, marginTop: 6, lineHeight: 1.5 }}>{deniedGuide}</div>
          )}
          <div style={{ marginTop: 9 }}>
            {status === 'prompt' ? (
              <button onClick={enable}
                style={{ background: TOSS.blue, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                알림 켜기
              </button>
            ) : (
              <button onClick={refresh}
                style={{ background: '#fff', color: TOSS.blue, border: `1px solid ${TOSS.blue}`, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                다시 확인
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
