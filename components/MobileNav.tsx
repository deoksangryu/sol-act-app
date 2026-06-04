import React from 'react';
import { ViewState } from '../types';

interface MobileNavProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  counts?: Partial<Record<ViewState, number>>;
}

// 프로토타입 하단 5탭 (Tabler 아이콘 그대로) — 역할 무관 동일
const TABS: { id: ViewState; label: string; icon: string }[] = [
  { id: 'classes', label: '수업', icon: 'ti-school' },
  { id: 'assignments', label: '과제', icon: 'ti-checklist' },
  { id: 'video', label: '영상', icon: 'ti-video' },
  { id: 'diet', label: '식단', icon: 'ti-salad' },
  { id: 'music', label: '음악', icon: 'ti-headphones' },
];

const INK = '#191F28';
// 비활성 탭 — 가독성(WCAG AA) 위해 faint(#C4CCD4·1.6:1) 대신 sub(#6B7684·4.6:1).
// 활성(INK + 600 굵기)과의 위계는 색·굵기 차이로 충분히 유지됨.
const SUB = '#6B7684';

const WARN = '#C2410C';

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onChangeView, counts }) => (
  <div style={{ display: 'flex' }}>
    {TABS.map((t) => {
      const on = currentView === t.id;
      const n = counts?.[t.id] || 0;
      return (
        <button
          key={t.id}
          onClick={() => onChangeView(t.id)}
          style={{
            flex: 1, background: 'none', border: 'none', padding: '9px 2px 11px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer',
          }}
        >
          <div style={{ position: 'relative', display: 'flex' }}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 22, color: on ? INK : SUB }} />
            {n > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -9, background: WARN, color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 14, height: 14, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
                {n > 99 ? '99+' : n}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: on ? INK : SUB, fontWeight: on ? 600 : 400 }}>{t.label}</span>
        </button>
      );
    })}
  </div>
);
