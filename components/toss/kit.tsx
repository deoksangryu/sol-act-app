import React from 'react';
import { TOSS } from '../../services/category';

/** 프로토타입(prototype-v8.html) 의 렌더 헬퍼(H/lb/rw/tg/bt/bH/sc/ic/av)를 그대로 옮긴 React 키트.
 *  스타일 값은 프로토타입과 1:1로 일치시킵니다. */

const { ink: I, sub: S, faint: F, surf: SF, line: L, blue: B } = TOSS;

// 화면 래퍼 (세로 플렉스, 전체 높이)
export const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
);

// 스크롤 영역 (sc) — flex:1 overflow-y-auto
export const Scroll: React.FC<{ children: React.ReactNode; className?: string }> = ({ children }) => (
  <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
);

// 큰 안내 타이틀 (H) — padding 14px 20px, 23px/700/1.34
export const BigTitle: React.FC<{ title: React.ReactNode; sub?: React.ReactNode }> = ({ title, sub }) => (
  <div style={{ padding: '14px 20px' }}>
    <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.34, letterSpacing: '-.02em', color: I }}>{title}</div>
    {sub && <div style={{ fontSize: 14, color: S, marginTop: 6 }}>{sub}</div>}
  </div>
);

// 섹션 라벨 (lb) — 13px/500/S, padding 18px 20px 6px
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 13, fontWeight: 500, color: S, padding: '18px 20px 6px' }}>{children}</div>
);

// 뒤로가기 헤더 (bH)
export const BackHeader: React.FC<{ title: string; onBack: () => void; right?: React.ReactNode }> = ({ title, onBack, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', flexShrink: 0 }}>
    <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', display: 'flex' }} aria-label="뒤로">
      <i className="ti ti-arrow-left" style={{ fontSize: 22, color: I }} />
    </button>
    <span style={{ fontSize: 16, fontWeight: 600, color: I }}>{title}</span>
    {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
  </div>
);

// 둥근 아이콘 칩 (ic) — width/height z, radius 13, bg
export const IconChip: React.FC<{ children?: React.ReactNode; bg?: string; size?: number }> = ({ children, bg = SF, size = 44 }) => (
  <div style={{ width: size, height: size, borderRadius: 13, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {children}
  </div>
);

// Tabler 아이콘을 칩 안에 (ic의 tabler 경로)
export const TablerChip: React.FC<{ icon: string; bg?: string; fg?: string; size?: number }> = ({ icon, bg = SF, fg = S, size = 44 }) => (
  <IconChip bg={bg} size={size}><i className={`ti ${icon}`} style={{ fontSize: Math.round(size * 0.47), color: fg }} /></IconChip>
);

// 작은 태그/뱃지 (tg)
export const Tag: React.FC<{ children: React.ReactNode; bg?: string; fg?: string }> = ({ children, bg = SF, fg = S }) => (
  <span style={{ fontSize: 12, fontWeight: 500, padding: '4px 9px', borderRadius: 7, background: bg, color: fg, whiteSpace: 'nowrap' }}>{children}</span>
);

export type TagTone = 'todo' | 'done' | 'pending' | 'info';
export function toneColors(tone: TagTone): { bg: string; fg: string } {
  switch (tone) {
    case 'done': return { bg: TOSS.successBg, fg: TOSS.success };
    case 'todo': return { bg: TOSS.warnBg, fg: TOSS.warn };
    case 'pending': return { bg: TOSS.warnBg, fg: TOSS.warn };
    default: return { bg: SF, fg: S };
  }
}

// 체브론 (ch)
export const Chevron: React.FC = () => (
  <i className="ti ti-chevron-right" style={{ fontSize: 18, color: F }} />
);

// 리스트 행 (rw) — flex gap13 padding 12px 20px
export const ListRow: React.FC<{
  left?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}> = ({ left, title, sub, right, onClick }) => (
  <div
    onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 20px', cursor: onClick ? 'pointer' : undefined }}
  >
    {left}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: I, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      {sub != null && sub !== '' && <div style={{ fontSize: 13, color: S, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
    {right ?? (onClick ? <Chevron /> : null)}
  </div>
);

// 하단 고정 CTA (bt) — padding 12px 20px 16px
export const Cta: React.FC<{ children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean }> = ({ children, onClick, disabled, loading }) => {
  const off = disabled || loading;
  return (
    <div style={{ padding: '12px 20px 16px', flexShrink: 0 }}>
      <button
        onClick={off ? undefined : onClick}
        disabled={off}
        style={{ width: '100%', background: off ? SF : B, color: off ? F : '#fff', border: 'none', borderRadius: 14, padding: 15, fontSize: 16, fontWeight: 600, cursor: off ? 'default' : 'pointer' }}
      >
        {loading ? '잠시만요…' : children}
      </button>
    </div>
  );
};

// 보조(아웃라인) 버튼
export const GhostButton: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <button onClick={onClick} style={{ width: '100%', background: '#fff', border: `1.5px solid ${B}`, color: B, borderRadius: 14, padding: '14px 6px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
    {children}
  </button>
);

// 빈 상태
export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: '40px 24px', textAlign: 'center', color: S, fontSize: 13 }}>{children}</div>
);

// 안내 박스
export const InfoBox: React.FC<{ children: React.ReactNode; tone?: 'info' | 'warn' | 'purple' | 'success' }> = ({ children, tone = 'info' }) => {
  const map = {
    info: { bg: SF, fg: I },
    warn: { bg: TOSS.warnBg, fg: TOSS.warn },
    purple: { bg: TOSS.purpleBg, fg: '#473A9E' },
    success: { bg: TOSS.successBg, fg: '#15662F' },
  }[tone];
  return <div style={{ background: map.bg, color: map.fg, borderRadius: 12, padding: '12px 13px', fontSize: 13, lineHeight: 1.6 }}>{children}</div>;
};

// 칩 선택 그룹
export const ChipSelect: React.FC<{
  options: { value: string; label: string }[];
  value?: string | null;
  onChange: (v: string) => void;
  wrap?: boolean;
}> = ({ options, value, onChange, wrap }) => (
  <div className="no-scrollbar" style={{ display: 'flex', gap: 7, flexWrap: wrap ? 'wrap' : 'nowrap', overflowX: wrap ? undefined : 'auto' }}>
    {options.map((o) => {
      const on = value === o.value;
      return (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{ flexShrink: 0, background: on ? I : '#fff', border: `1px solid ${on ? I : '#E5E8EB'}`, borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 500, color: on ? '#fff' : S, cursor: 'pointer' }}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// 아바타 (av) — 원형 이니셜
export const Avatar: React.FC<{ name: string; size?: number; bg?: string; fg?: string }> = ({ name, size = 36, bg = TOSS.blueBg, fg = B }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 600, flexShrink: 0 }}>
    {name?.charAt(0) || '?'}
  </div>
);
