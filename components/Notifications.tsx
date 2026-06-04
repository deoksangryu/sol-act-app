import React from 'react';
import { Notification, ViewState } from '../types';
import { formatDateTimeShortKo } from '../services/dateUtils';
import { TOSS } from '../services/category';

interface NotificationsProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onNavigate?: (view: ViewState) => void;
}

/** 알림 메시지에서 이동할 탭을 추론 (Notification에 별도 타깃 필드가 없으므로 키워드 기반) */
function inferView(message: string): ViewState | null {
  if (/영상|포트폴리오/.test(message)) return 'video';
  if (/과제/.test(message)) return 'assignments';
  if (/식단/.test(message)) return 'diet';
  if (/음원|음악/.test(message)) return 'music';
  if (/일지|수업|출석|출결/.test(message)) return 'classes';
  return null;
}

// 카테고리별 아이콘 칩 색 (프로토타입 sNf와 동일 매핑)
const CAT: Record<string, { icon: string; bg: string; fg: string }> = {
  video: { icon: 'ti-video', bg: TOSS.blueBg, fg: TOSS.blue },
  assignments: { icon: 'ti-checklist', bg: TOSS.warnBg, fg: TOSS.warn },
  diet: { icon: 'ti-salad', bg: TOSS.successBg, fg: TOSS.success },
  music: { icon: 'ti-headphones', bg: TOSS.purpleBg, fg: TOSS.purple },
  classes: { icon: 'ti-school', bg: TOSS.blueBg, fg: TOSS.blue },
};

/** 프로토타입 sNf — 전체화면 알림 (카테고리 아이콘 칩 + 미읽음 배경 + 파랑 점 + 하단 '모두 읽음') */
export const Notifications: React.FC<NotificationsProps> = ({ notifications, onClose, onMarkAllRead, onNavigate }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#fff', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', flexShrink: 0, paddingTop: 'calc(8px + env(safe-area-inset-top))' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', display: 'flex' }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 22, color: TOSS.ink }} />
      </button>
      <span style={{ fontSize: 16, fontWeight: 600, color: TOSS.ink }}>알림</span>
    </div>

    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
      {notifications.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: TOSS.faint, fontSize: 13 }}>새로운 알림이 없어요</div>
      ) : notifications.map((n) => {
        const view = inferView(n.message);
        const c = (view && CAT[view]) || CAT.classes;
        return (
          <div
            key={n.id}
            onClick={() => { if (view && onNavigate) onNavigate(view); }}
            style={{ display: 'flex', gap: 12, padding: '14px 20px', alignItems: 'flex-start', cursor: view ? 'pointer' : 'default', background: n.read ? '#fff' : TOSS.blueBg }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 13, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`ti ${c.icon}`} style={{ fontSize: 20, color: c.fg }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: n.read ? 500 : 600, color: TOSS.ink, lineHeight: 1.45 }}>{n.message}</div>
                {!n.read && <div style={{ width: 7, height: 7, borderRadius: 999, background: TOSS.blue, marginTop: 5, flexShrink: 0 }} />}
              </div>
              <div style={{ fontSize: 11, color: TOSS.faint, marginTop: 4 }}>{formatDateTimeShortKo(n.date)}</div>
            </div>
          </div>
        );
      })}
    </div>

    {notifications.some((n) => !n.read) && (
      <div style={{ padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', flexShrink: 0 }}>
        <button onClick={onMarkAllRead} style={{ width: '100%', background: TOSS.surf, color: TOSS.ink, border: 'none', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>모두 읽음 표시</button>
      </div>
    )}
  </div>
);
