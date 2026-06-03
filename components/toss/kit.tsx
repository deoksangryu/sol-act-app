import React from 'react';
import { TOSS } from '../../services/category';

/** 토스 스타일 공용 UI 키트 — 프로토타입 헬퍼(H/lb/rw/tg/bt/bH/sc) 대응 */

// 화면 래퍼: 세로 플렉스 + 전체 높이
export const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col h-full min-h-0">{children}</div>
);

// 스크롤 영역
export const Scroll: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`flex-1 overflow-y-auto no-scrollbar ${className}`}>{children}</div>
);

// 큰 안내 타이틀 (H) — title은 줄바꿈 포함 ReactNode 허용
export const BigTitle: React.FC<{ title: React.ReactNode; sub?: React.ReactNode }> = ({ title, sub }) => (
  <div className="px-1 py-3">
    <div className="text-[23px] font-bold leading-[1.34] tracking-[-0.02em] text-toss-ink">{title}</div>
    {sub && <div className="text-sm text-toss-sub mt-1.5">{sub}</div>}
  </div>
);

// 섹션 라벨 (lb)
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[13px] font-medium text-toss-sub pt-[18px] pb-1.5 px-1">{children}</div>
);

// 뒤로가기 헤더 (bH)
export const BackHeader: React.FC<{ title: string; onBack: () => void; right?: React.ReactNode }> = ({ title, onBack, right }) => (
  <div className="flex items-center gap-1.5 px-1 py-2 shrink-0">
    <button onClick={onBack} className="p-1.5 flex items-center" aria-label="뒤로">
      <svg className="w-[22px] h-[22px] text-toss-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
    </button>
    <span className="text-base font-semibold text-toss-ink">{title}</span>
    {right && <span className="ml-auto">{right}</span>}
  </div>
);

// 둥근 아이콘 칩 (ic) — icon은 ReactNode, bg 지정
export const IconChip: React.FC<{ children?: React.ReactNode; bg?: string; size?: number }> = ({ children, bg = TOSS.surf, size = 44 }) => (
  <div className="flex items-center justify-center shrink-0" style={{ width: size, height: size, borderRadius: 13, background: bg }}>
    {children}
  </div>
);

// 작은 태그/뱃지 (tg)
export const Tag: React.FC<{ children: React.ReactNode; bg?: string; fg?: string }> = ({ children, bg = TOSS.surf, fg = TOSS.sub }) => (
  <span className="text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap" style={{ background: bg, color: fg }}>{children}</span>
);

export type TagTone = 'todo' | 'done' | 'pending' | 'info';
export function toneColors(tone: TagTone): { bg: string; fg: string } {
  switch (tone) {
    case 'done': return { bg: TOSS.successBg, fg: TOSS.success };
    case 'todo': return { bg: TOSS.warnBg, fg: TOSS.warn };
    case 'pending': return { bg: TOSS.warnBg, fg: TOSS.warn };
    default: return { bg: TOSS.surf, fg: TOSS.sub };
  }
}

// 리스트 행 (rw)
export const ListRow: React.FC<{
  left?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}> = ({ left, title, sub, right, onClick }) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-3 px-1 py-3 ${onClick ? 'cursor-pointer active:bg-slate-50' : ''}`}
  >
    {left}
    <div className="flex-1 min-w-0">
      <div className="text-[15px] font-medium text-toss-ink truncate">{title}</div>
      {sub && <div className="text-[13px] text-toss-sub mt-0.5 truncate">{sub}</div>}
    </div>
    {right ?? (onClick && <Chevron />)}
  </div>
);

export const Chevron: React.FC = () => (
  <svg className="w-[18px] h-[18px] text-toss-faint shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
);

// 하단 고정 CTA (bt)
export const Cta: React.FC<{ children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean }> = ({ children, onClick, disabled, loading }) => {
  const off = disabled || loading;
  return (
    <div className="px-1 pt-3 pb-4 shrink-0">
      <button
        onClick={off ? undefined : onClick}
        disabled={off}
        className="w-full rounded-2xl py-[15px] text-base font-semibold transition-colors"
        style={{ background: off ? TOSS.surf : TOSS.blue, color: off ? TOSS.faint : '#fff', cursor: off ? 'default' : 'pointer' }}
      >
        {loading ? '잠시만요…' : children}
      </button>
    </div>
  );
};

// 보조(아웃라인) 버튼
export const GhostButton: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <button onClick={onClick} className="rounded-2xl py-[14px] px-3 text-sm font-semibold w-full border" style={{ borderColor: TOSS.blue, color: TOSS.blue }}>
    {children}
  </button>
);

// 빈 상태
export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-6 py-10 text-center text-[13px] text-toss-sub">{children}</div>
);

// 안내 박스
export const InfoBox: React.FC<{ children: React.ReactNode; tone?: 'info' | 'warn' | 'purple' | 'success' }> = ({ children, tone = 'info' }) => {
  const map = {
    info: { bg: TOSS.surf, fg: TOSS.ink },
    warn: { bg: TOSS.warnBg, fg: TOSS.warn },
    purple: { bg: TOSS.purpleBg, fg: '#473A9E' },
    success: { bg: TOSS.successBg, fg: '#15662F' },
  }[tone];
  return (
    <div className="rounded-xl p-3.5 text-[13px] leading-relaxed" style={{ background: map.bg, color: map.fg }}>
      {children}
    </div>
  );
};

// 칩 선택 그룹
export const ChipSelect: React.FC<{
  options: { value: string; label: string }[];
  value?: string | null;
  onChange: (v: string) => void;
  wrap?: boolean;
}> = ({ options, value, onChange, wrap }) => (
  <div className={`flex gap-1.5 ${wrap ? 'flex-wrap' : 'overflow-x-auto no-scrollbar'}`}>
    {options.map((o) => {
      const on = value === o.value;
      return (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="shrink-0 rounded-full px-3 py-2 text-[13px] font-medium border transition-colors"
          style={{
            background: on ? TOSS.ink : '#fff',
            borderColor: on ? TOSS.ink : '#E5E8EB',
            color: on ? '#fff' : TOSS.sub,
          }}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// 아바타 (이니셜)
export const Avatar: React.FC<{ name: string; size?: number; bg?: string; fg?: string }> = ({ name, size = 40, bg = TOSS.blueBg, fg = TOSS.blue }) => (
  <div className="flex items-center justify-center shrink-0 rounded-full font-semibold" style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.38) }}>
    {name?.charAt(0) || '?'}
  </div>
);
