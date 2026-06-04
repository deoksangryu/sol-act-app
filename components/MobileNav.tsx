import React from 'react';
import { ViewState } from '../types';

interface MobileNavProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
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
const FAINT = '#C4CCD4';

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onChangeView }) => (
  <div style={{ display: 'flex' }}>
    {TABS.map((t) => {
      const on = currentView === t.id;
      return (
        <button
          key={t.id}
          onClick={() => onChangeView(t.id)}
          style={{
            flex: 1, background: 'none', border: 'none', padding: '9px 2px 11px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer',
          }}
        >
          <i className={`ti ${t.icon}`} style={{ fontSize: 22, color: on ? INK : FAINT }} />
          <span style={{ fontSize: 10, color: on ? INK : FAINT, fontWeight: on ? 600 : 400 }}>{t.label}</span>
        </button>
      );
    })}
  </div>
);
