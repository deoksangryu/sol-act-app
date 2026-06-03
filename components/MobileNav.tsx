import React from 'react';
import { ViewState } from '../types';

interface MobileNavProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

// v8 프로토타입 5탭 — 역할 무관 동일 (내용만 역할별 분기)
const TABS: { id: ViewState; label: string; icon: string }[] = [
  { id: 'classes', label: '수업', icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.42a12 12 0 01.34 5.84A12 12 0 0112 21a12 12 0 01-6.5-4.58 12 12 0 01.34-5.84L12 14z' },
  { id: 'assignments', label: '과제', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'video', label: '영상', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { id: 'diet', label: '식단', icon: 'M4 3v6a2 2 0 002 2h0a2 2 0 002-2V3M6 11v10M18 3c-1.66 0-3 2-3 5s1.34 4 3 4m0 0v9' },
  { id: 'music', label: '음악', icon: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z' },
];

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, onChangeView }) => (
  <div className="flex justify-between items-center h-16 px-3 pb-1">
    {TABS.map((item) => {
      const active = currentView === item.id;
      return (
        <button
          key={item.id}
          onClick={() => onChangeView(item.id)}
          className={`flex flex-col items-center justify-center w-full h-full gap-1 ${active ? 'text-toss-ink' : 'text-toss-faint'}`}
        >
          <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
          </svg>
          <span className={`text-[10px] ${active ? 'font-semibold' : 'font-normal'}`}>{item.label}</span>
        </button>
      );
    })}
  </div>
);
